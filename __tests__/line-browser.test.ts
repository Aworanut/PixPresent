import { describe, expect, it } from "vitest";
import {
  isInAppBrowser,
  isLineBrowser,
  withExternalBrowserParam,
} from "@/lib/line-browser";

// Representative real-world UA fragments.
const LINE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Line/13.5.0";
const FB_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 [FBAN/FBIOS;FBAV/400.0.0]";
const IG_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Instagram 250.0.0";
const SAFARI_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const CHROME_UA =
  "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

describe("isLineBrowser", () => {
  it("detects the LINE in-app browser", () => {
    expect(isLineBrowser(LINE_UA)).toBe(true);
  });

  it("is false for other in-app browsers and real browsers", () => {
    expect(isLineBrowser(FB_UA)).toBe(false);
    expect(isLineBrowser(SAFARI_UA)).toBe(false);
    expect(isLineBrowser(CHROME_UA)).toBe(false);
  });

  it("does not false-positive on words containing 'line'", () => {
    expect(isLineBrowser("SomeApp Baseline/2.0 Online")).toBe(false);
  });

  it("handles null/empty", () => {
    expect(isLineBrowser(null)).toBe(false);
    expect(isLineBrowser(undefined)).toBe(false);
    expect(isLineBrowser("")).toBe(false);
  });
});

describe("isInAppBrowser", () => {
  it("detects LINE, Facebook, Instagram", () => {
    expect(isInAppBrowser(LINE_UA)).toBe(true);
    expect(isInAppBrowser(FB_UA)).toBe(true);
    expect(isInAppBrowser(IG_UA)).toBe(true);
  });

  it("is false for real browsers (Safari, Chrome)", () => {
    expect(isInAppBrowser(SAFARI_UA)).toBe(false);
    expect(isInAppBrowser(CHROME_UA)).toBe(false);
  });

  it("handles null/empty", () => {
    expect(isInAppBrowser(null)).toBe(false);
    expect(isInAppBrowser("")).toBe(false);
  });
});

describe("withExternalBrowserParam", () => {
  it("appends ?openExternalBrowser=1 when no query string", () => {
    expect(withExternalBrowserParam("https://x.com/e/abc")).toBe(
      "https://x.com/e/abc?openExternalBrowser=1",
    );
  });

  it("appends with & when a query string already exists", () => {
    expect(withExternalBrowserParam("https://x.com/e/abc?foo=1")).toBe(
      "https://x.com/e/abc?foo=1&openExternalBrowser=1",
    );
  });

  it("is idempotent — never duplicates the param", () => {
    const once = withExternalBrowserParam("https://x.com/e/abc");
    expect(withExternalBrowserParam(once)).toBe(once);
    expect(
      withExternalBrowserParam("https://x.com/e/abc?openExternalBrowser=1"),
    ).toBe("https://x.com/e/abc?openExternalBrowser=1");
  });

  it("keeps the param before any #fragment", () => {
    expect(withExternalBrowserParam("https://x.com/e/abc#top")).toBe(
      "https://x.com/e/abc?openExternalBrowser=1#top",
    );
  });

  it("returns empty input unchanged", () => {
    expect(withExternalBrowserParam("")).toBe("");
  });
});
