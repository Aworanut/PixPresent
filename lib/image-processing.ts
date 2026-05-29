/**
 * Image processing utilities using sharp.
 * Used by the sync job (#7) to convert Drive originals → web-optimized + full-res JPEG.
 *
 * Strategy (§11.2):
 *  - Web:  JPEG 85%, max 1920px long edge, strip EXIF (privacy)
 *  - Full: JPEG 95%, max 8000px (no upscale), keep EXIF for commercial use
 */

import sharp from "sharp";
import exifReader from "exif-reader";

export type ProcessedImage = {
  web: Buffer; // ~300-800 KB
  full: Buffer; // ~2-8 MB
  artist?: string;
  copyright?: string;
  takenAt?: string;
};

/**
 * Process a raw image buffer into web-optimized and full-resolution variants.
 * Strips EXIF from web variant (facial recognition data, GPS).
 * Preserves EXIF on full variant (attribution data for commerce in Phase 2).
 */
export async function processImage(input: Buffer): Promise<ProcessedImage> {
  const pipeline = sharp(input, { failOn: "error" });

  const metadata = await pipeline.metadata();
  let artist: string | undefined;
  let copyright: string | undefined;
  let takenAt: string | undefined;

  if (metadata.exif) {
    try {
      const exifData = exifReader(metadata.exif);
      if (exifData.Image) {
        if (typeof exifData.Image.Artist === "string" && exifData.Image.Artist.trim()) {
          artist = exifData.Image.Artist.trim();
        }
        if (typeof exifData.Image.Copyright === "string" && exifData.Image.Copyright.trim()) {
          copyright = exifData.Image.Copyright.trim();
        }
      }
      if (exifData.Photo && exifData.Photo.DateTimeOriginal instanceof Date) {
        takenAt = exifData.Photo.DateTimeOriginal.toISOString();
      }
    } catch (err) {
      console.error("[exif] Failed to parse EXIF metadata:", err);
    }
  }

  const [web, full] = await Promise.all([
    pipeline
      .clone()
      .rotate() // auto-rotate from EXIF orientation before strip
      .resize({
        width: 1920,
        height: 1920,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 85, mozjpeg: true })
      .withMetadata({ exif: {} }) // strip EXIF
      .toBuffer(),

    pipeline
      .clone()
      .rotate() // auto-rotate from EXIF orientation
      .resize({
        width: 8000,
        height: 8000,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 95, mozjpeg: true })
      .withMetadata() // keep EXIF
      .toBuffer(),
  ]);

  return { web, full, artist, copyright, takenAt };
}
