import { describe, it, expect } from "vitest";
import { dropboxRelativePath } from "@/lib/dropbox-api";

describe("dropboxRelativePath", () => {
  it("returns '' for a file directly in the connected folder", () => {
    expect(dropboxRelativePath("/สงกรานต์2024", "/สงกรานต์2024/img.jpg")).toBe("");
  });

  it("returns the one-level subfolder", () => {
    expect(dropboxRelativePath("/สงกรานต์2024", "/สงกรานต์2024/พิธีเช้า/img.jpg")).toBe("พิธีเช้า");
  });

  it("returns nested subfolders joined with /", () => {
    expect(
      dropboxRelativePath("/สงกรานต์2024", "/สงกรานต์2024/พิธีเช้า/ช่วงเช้า/img.jpg"),
    ).toBe("พิธีเช้า/ช่วงเช้า");
  });

  it("matches the root case-insensitively but preserves child case", () => {
    expect(dropboxRelativePath("/Event", "/event/Morning/img.jpg")).toBe("Morning");
  });

  it("tolerates a trailing slash on the root", () => {
    expect(dropboxRelativePath("/Event/", "/Event/Sub/img.jpg")).toBe("Sub");
  });
});
