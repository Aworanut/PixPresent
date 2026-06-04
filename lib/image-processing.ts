/**
 * Image processing utilities using sharp.
 * Used by the sync job (#7) to convert Drive originals → web-optimized + full-res JPEG.
 *
 * Strategy (§11.2):
 *  - Web:  JPEG 85%, max 1920px long edge, strip EXIF (privacy)
 *  - Full: JPEG 90%, max 4000px (no upscale), keep EXIF for commercial use
 */

import sharp from "sharp";
import exifReader from "exif-reader";
import { clampCropToImage, type CropPixels } from "@/lib/crop";

export type ProcessedImage = {
  web: Buffer; // ~300-800 KB
  full: Buffer; // ~0.5-2 MB
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
        width: 4000,
        height: 4000,
        fit: "inside",
        withoutEnlargement: true,
      })
      // q90 libjpeg (mozjpeg off): mozjpeg's trellis quantisation dominated
      // sync CPU (~62% of per-photo time at 8000px/q95) for marginal size gains.
      .jpeg({ quality: 90, mozjpeg: false })
      .withMetadata() // keep EXIF
      .toBuffer(),
  ]);

  return { web, full, artist, copyright, takenAt };
}

/** Supabase avatars bucket limit (2 MB). */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

/** Long edge for profile photos — enough for 2× retina at 96px display. */
export const AVATAR_MAX_EDGE = 512;

export type ProcessedAvatar = {
  buffer: Buffer;
  contentType: "image/jpeg";
};

async function compressToJpeg(
  pipeline: sharp.Sharp,
  maxBytes: number,
  sizes: { width: number; height: number }[],
): Promise<Buffer> {
  for (const size of sizes) {
    for (let quality = 85; quality >= 50; quality -= 10) {
      const buffer = await pipeline
        .clone()
        .resize({
          width: size.width,
          height: size.height,
          fit: "cover",
          withoutEnlargement: true,
        })
        .jpeg({ quality, mozjpeg: true })
        .withMetadata({ exif: {} })
        .toBuffer();

      if (buffer.length <= maxBytes) {
        return buffer;
      }
    }
  }

  throw new Error("IMAGE_TOO_LARGE");
}

/**
 * Crop (EXIF-aware) then resize/compress for profile avatars.
 */
export async function processCroppedAvatar(
  input: Buffer,
  crop: CropPixels,
  maxBytes: number = AVATAR_MAX_BYTES,
): Promise<ProcessedAvatar> {
  const meta = await sharp(input, { failOn: "error", animated: false })
    .rotate()
    .metadata();
  const imageWidth = meta.width ?? 1;
  const imageHeight = meta.height ?? 1;
  const region = clampCropToImage(crop, imageWidth, imageHeight);

  const cropped = sharp(input, { failOn: "error", animated: false })
    .rotate()
    .extract(region);
  const buffer = await compressToJpeg(cropped, maxBytes, [
    { width: AVATAR_MAX_EDGE, height: AVATAR_MAX_EDGE },
    { width: 384, height: 384 },
    { width: 256, height: 256 },
  ]);

  return { buffer, contentType: "image/jpeg" };
}

/**
 * Resize and compress without crop (legacy / fallback).
 */
export async function processAvatarImage(
  input: Buffer,
  maxBytes: number = AVATAR_MAX_BYTES,
): Promise<ProcessedAvatar> {
  const fullImage = sharp(input, { failOn: "error", animated: false }).rotate();
  const meta = await fullImage.metadata();
  const w = meta.width ?? AVATAR_MAX_EDGE;
  const h = meta.height ?? AVATAR_MAX_EDGE;
  const size = Math.min(w, h, AVATAR_MAX_EDGE);

  return processCroppedAvatar(
    input,
    {
      x: Math.round((w - size) / 2),
      y: Math.round((h - size) / 2),
      width: size,
      height: size,
    },
    maxBytes,
  );
}

/** Supabase cover photo size limit (5 MB). */
export const COVER_MAX_BYTES = 5 * 1024 * 1024;

/** Max width for cover photo banner. */
export const COVER_MAX_WIDTH = 1920;
export const COVER_MAX_HEIGHT = 1080;

export type ProcessedCover = {
  buffer: Buffer;
  contentType: "image/jpeg";
};

/**
 * Crop (EXIF-aware) then resize/compress for event cover banners (16:9).
 */
export async function processCroppedCover(
  input: Buffer,
  crop: CropPixels,
  maxBytes: number = COVER_MAX_BYTES,
): Promise<ProcessedCover> {
  const meta = await sharp(input, { failOn: "error", animated: false })
    .rotate()
    .metadata();
  const imageWidth = meta.width ?? 1;
  const imageHeight = meta.height ?? 1;
  const region = clampCropToImage(crop, imageWidth, imageHeight);

  const cropped = sharp(input, { failOn: "error", animated: false })
    .rotate()
    .extract(region);
  const buffer = await compressToJpeg(cropped, maxBytes, [
    { width: COVER_MAX_WIDTH, height: COVER_MAX_HEIGHT },
    { width: 1440, height: 810 },
    { width: 1024, height: 576 },
  ]);

  return { buffer, contentType: "image/jpeg" };
}

/**
 * Resize and compress without explicit crop (center 16:9 fallback).
 */
export async function processCoverImage(
  input: Buffer,
  maxBytes: number = COVER_MAX_BYTES,
): Promise<ProcessedCover> {
  const oriented = sharp(input, { failOn: "error", animated: false }).rotate();
  const meta = await oriented.metadata();
  const w = meta.width ?? COVER_MAX_WIDTH;
  const h = meta.height ?? COVER_MAX_HEIGHT;
  const targetAspect = COVER_MAX_WIDTH / COVER_MAX_HEIGHT;
  const imageAspect = w / h;

  let crop: CropPixels;
  if (imageAspect > targetAspect) {
    const cropW = Math.round(h * targetAspect);
    crop = {
      x: Math.round((w - cropW) / 2),
      y: 0,
      width: cropW,
      height: h,
    };
  } else {
    const cropH = Math.round(w / targetAspect);
    crop = {
      x: 0,
      y: Math.round((h - cropH) / 2),
      width: w,
      height: cropH,
    };
  }

  return processCroppedCover(input, crop, maxBytes);
}
