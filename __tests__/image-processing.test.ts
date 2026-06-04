import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { processImage } from "@/lib/image-processing";

/** Build a JPEG larger than both variant caps so the resize is exercised. */
async function makeJpeg(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 120, g: 80, b: 40 } },
  })
    .jpeg()
    .toBuffer();
}

describe("processImage", () => {
  it("caps web at 1920px and full at 4000px long edge", async () => {
    const original = await makeJpeg(5000, 3000);
    const { web, full } = await processImage(original);

    const webMeta = await sharp(web).metadata();
    const fullMeta = await sharp(full).metadata();

    expect(webMeta.format).toBe("jpeg");
    expect(fullMeta.format).toBe("jpeg");

    // fit: "inside" → long edge is the cap.
    expect(Math.max(webMeta.width ?? 0, webMeta.height ?? 0)).toBeLessThanOrEqual(1920);
    expect(Math.max(fullMeta.width ?? 0, fullMeta.height ?? 0)).toBeLessThanOrEqual(4000);

    // Full keeps more resolution than web (not collapsed to the web size).
    expect(fullMeta.width ?? 0).toBeGreaterThan(webMeta.width ?? 0);
  }, 30000);

  it("does not upscale a small original", async () => {
    const original = await makeJpeg(800, 600);
    const { web, full } = await processImage(original);

    const webMeta = await sharp(web).metadata();
    const fullMeta = await sharp(full).metadata();

    expect(webMeta.width).toBe(800);
    expect(fullMeta.width).toBe(800);
  }, 30000);
});
