import { describe, expect, it } from "vitest";
import {
  downloadPhotoFilename,
  uniqueDownloadFilenames,
} from "@/lib/download-filename";

describe("downloadPhotoFilename", () => {
  it("uses original stem with jpg extension", () => {
    expect(downloadPhotoFilename("DSC_1234.NEF", "fallback")).toBe(
      "DSC_1234.jpg",
    );
  });

  it("strips path segments", () => {
    expect(downloadPhotoFilename("folder/sub/IMG_001.png", "fallback")).toBe(
      "IMG_001.jpg",
    );
  });

  it("falls back when missing", () => {
    expect(downloadPhotoFilename(null, "photo-abc")).toBe("photo-abc.jpg");
  });
});

describe("uniqueDownloadFilenames", () => {
  it("dedupes collisions", () => {
    expect(
      uniqueDownloadFilenames([
        { originalFilename: "A.jpg", fallbackStem: "p1" },
        { originalFilename: "A.jpg", fallbackStem: "p2" },
      ]),
    ).toEqual(["A.jpg", "A (2).jpg"]);
  });
});
