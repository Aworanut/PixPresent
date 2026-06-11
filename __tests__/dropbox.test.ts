import { describe, it, expect } from "vitest";
import { normalizeDropboxFolderPath, isDropboxShareLink } from "@/lib/dropbox";
import { isDropboxRetryable, mapDropboxEntry, type DropboxEntry } from "@/lib/dropbox-api";

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

describe("isDropboxShareLink", () => {
  it("detects a modern scl/fo share link", () => {
    expect(isDropboxShareLink("https://www.dropbox.com/scl/fo/abc/xyz?rlkey=k&dl=0")).toBe(true);
  });
  it("detects a legacy sh share link", () => {
    expect(isDropboxShareLink("https://www.dropbox.com/sh/abc/xyz?dl=0")).toBe(true);
  });
  it("detects without www and with http", () => {
    expect(isDropboxShareLink("http://dropbox.com/scl/fo/abc?rlkey=k")).toBe(true);
  });
  it("trims surrounding whitespace before matching", () => {
    expect(isDropboxShareLink("  https://www.dropbox.com/scl/fo/abc?rlkey=k  ")).toBe(true);
  });
  it("is false for a plain path", () => {
    expect(isDropboxShareLink("/Events/Wedding")).toBe(false);
  });
  it("is false for a non-dropbox url", () => {
    expect(isDropboxShareLink("https://drive.google.com/drive/folders/abc")).toBe(false);
  });
  it("is false for empty input", () => {
    expect(isDropboxShareLink("   ")).toBe(false);
  });
});

describe("isDropboxRetryable", () => {
  it("retries on 429 and 5xx", () => {
    expect(isDropboxRetryable(429)).toBe(true);
    expect(isDropboxRetryable(500)).toBe(true);
    expect(isDropboxRetryable(503)).toBe(true);
  });
  it("does not retry on 4xx (except 429)", () => {
    expect(isDropboxRetryable(400)).toBe(false);
    expect(isDropboxRetryable(401)).toBe(false);
    expect(isDropboxRetryable(409)).toBe(false);
  });
});

describe("mapDropboxEntry", () => {
  it("maps a file entry to SourceFile with id + client_modified", () => {
    const entry: DropboxEntry = {
      ".tag": "file",
      id: "id:abc123",
      name: "DSC_0001.JPG",
      path_lower: "/events/dsc_0001.jpg",
      size: 4096,
      client_modified: "2026-05-01T10:00:00Z",
    };
    expect(mapDropboxEntry(entry)).toEqual({
      id: "id:abc123",
      name: "DSC_0001.JPG",
      mimeType: "image/jpeg",
      size: 4096,
      modifiedTime: "2026-05-01T10:00:00Z",
      relativePath: "",
    });
  });

  it("carries a provided relativePath", () => {
    const entry: DropboxEntry = {
      ".tag": "file",
      id: "id:abc123",
      name: "DSC_0001.JPG",
      size: 4096,
      client_modified: "2026-05-01T10:00:00Z",
    };
    expect(mapDropboxEntry(entry, "morning/early").relativePath).toBe("morning/early");
  });
});
