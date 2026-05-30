import { describe, it, expect } from "vitest";
import { normalizeDropboxFolderPath } from "@/lib/dropbox";

describe("normalizeDropboxFolderPath", () => {
  it("adds a leading slash", () => {
    expect(normalizeDropboxFolderPath("Events/Wedding")).toBe("/Events/Wedding");
  });
  it("keeps an already-rooted path", () => {
    expect(normalizeDropboxFolderPath("/Events/Wedding")).toBe("/Events/Wedding");
  });
  it("strips a trailing slash", () => {
    expect(normalizeDropboxFolderPath("/Events/Wedding/")).toBe("/Events/Wedding");
  });
  it("maps a bare slash (root) to empty string", () => {
    expect(normalizeDropboxFolderPath("/")).toBe("");
  });
  it("trims whitespace", () => {
    expect(normalizeDropboxFolderPath("  /Events  ")).toBe("/Events");
  });
  it("rejects http(s) share links (MVP: path-only)", () => {
    expect(normalizeDropboxFolderPath("https://www.dropbox.com/scl/fo/abc?rlkey=x")).toBe("");
  });
  it("returns empty for empty input", () => {
    expect(normalizeDropboxFolderPath("   ")).toBe("");
  });
});
