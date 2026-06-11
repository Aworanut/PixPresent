import { describe, it, expect, vi, beforeEach } from "vitest";
import sharp from "sharp";

// service-role is only reached by enrollPerson/addReferenceFace, not by the
// cropFaceToR2 unit under test — mock it so importing the module is hermetic.
vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: vi.fn(),
}));

// Capture what cropFaceToR2 uploads, and feed it a real JPEG to crop.
let lastUpload: { key: string; body: Buffer } | null = null;
const downloadMock = vi.fn();

vi.mock("@/lib/r2", () => ({
  downloadFromR2: (key: string) => downloadMock(key),
  uploadToR2: vi.fn(async (key: string, body: Buffer) => {
    lastUpload = { key, body: Buffer.from(body) };
    return { ok: true, url: `https://cdn.example.com/${key}` };
  }),
  r2Paths: {
    photoWeb: (e: string, p: string) => `events/${e}/web/${p}.jpg`,
    personRefFace: (t: string, p: string, r: string) =>
      `tenants/${t}/ref-faces/${p}/${r}.jpg`,
  },
}));

async function makeJpeg(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 110, g: 90, b: 70 } },
  })
    .jpeg()
    .toBuffer();
}

beforeEach(() => {
  vi.clearAllMocks();
  lastUpload = null;
});

describe("cropFaceToR2", () => {
  it("crops the padded face region (30% padding, clamped) and uploads it", async () => {
    const img = await makeJpeg(800, 600);
    downloadMock.mockResolvedValue(img);
    const { cropFaceToR2 } = await import("@/lib/people/enrollment");

    const key = await cropFaceToR2(
      "events/e1/web/p1.jpg",
      { left: 0.3, top: 0.3, width: 0.2, height: 0.2 },
      "tenant-1",
      "person-1",
    );

    // Reads the photo by its web R2 key, writes a ref-face crop under the person.
    expect(downloadMock).toHaveBeenCalledWith("events/e1/web/p1.jpg");
    expect(key).toMatch(/^tenants\/tenant-1\/ref-faces\/person-1\/.+\.jpg$/);

    // 800x600 image, bbox .3/.3/.2/.2 → face 160x120, pad 48x36 → 256x192 crop.
    expect(lastUpload).not.toBeNull();
    const meta = await sharp(lastUpload!.body).metadata();
    expect(meta.width).toBe(256);
    expect(meta.height).toBe(192);
  });

  it("clamps the crop to image bounds when the face is at the edge", async () => {
    const img = await makeJpeg(400, 400);
    downloadMock.mockResolvedValue(img);
    const { cropFaceToR2 } = await import("@/lib/people/enrollment");

    // Face flush to the top-left corner — padding must not push left/top negative.
    await cropFaceToR2(
      "events/e1/web/p2.jpg",
      { left: 0, top: 0, width: 0.25, height: 0.25 },
      "tenant-1",
      "person-1",
    );

    const meta = await sharp(lastUpload!.body).metadata();
    // face 100x100, pad 30. left/top clamp to 0; width/height keep the full
    // padded size faceW + padX*2 = 100+60 = 160 (fits within the 400px image).
    expect(meta.width).toBe(160);
    expect(meta.height).toBe(160);
  });

  it("throws when R2 has no creds (download returns null)", async () => {
    downloadMock.mockResolvedValue(null);
    const { cropFaceToR2 } = await import("@/lib/people/enrollment");

    await expect(
      cropFaceToR2("k", { left: 0, top: 0, width: 0.1, height: 0.1 }, "t", "p"),
    ).rejects.toThrow(/R2 credentials/);
  });
});
