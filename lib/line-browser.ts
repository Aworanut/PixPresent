// Pure helpers for handling in-app browsers (webviews) — especially LINE — that
// frequently block `getUserMedia` (the camera). This breaks the selfie *capture*
// flow today and will hard-break the future liveness scan, where there is no
// gallery fallback. See docs/adr/0002-liveness-restricted-distribution.md.
//
// No Next/React imports on purpose — unit-testable via Vitest (node env).

// In-app browser (webview) user-agent signatures. LINE is the one we care about
// most for Thai guests; the rest commonly break camera access too.
const IN_APP_BROWSER_PATTERNS: RegExp[] = [
  /\bLine\/\d/i, // LINE in-app browser — UA contains e.g. "Line/13.1.0"
  /\bFBAN\b|\bFBAV\b|\bFB_IAB\b/i, // Facebook app
  /\bMessenger\b/i, // Facebook Messenger
  /\bInstagram\b/i, // Instagram
  /\bTikTok\b|musical_ly/i, // TikTok
];

/** LINE's in-app browser specifically — the only one `openExternalBrowser=1` can escape. */
export function isLineBrowser(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  return /\bLine\/\d/i.test(userAgent);
}

/** Any known in-app browser likely to block the camera / liveness flow. */
export function isInAppBrowser(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  return IN_APP_BROWSER_PATTERNS.some((re) => re.test(userAgent));
}

/**
 * Append LINE's `openExternalBrowser=1` param so that tapping the link inside a
 * LINE chat opens it in the system browser (where the camera / liveness works).
 * Harmless to every other browser — it is just an ignored query param.
 *
 * Idempotent (won't duplicate the param) and hash-safe (keeps any `#fragment`
 * after the query string).
 */
export function withExternalBrowserParam(url: string): string {
  if (!url) return url;
  if (/[?&]openExternalBrowser=1(?:&|#|$)/.test(url)) return url;

  const hashIndex = url.indexOf("#");
  const base = hashIndex === -1 ? url : url.slice(0, hashIndex);
  const hash = hashIndex === -1 ? "" : url.slice(hashIndex);
  const sep = base.includes("?") ? "&" : "?";

  return `${base}${sep}openExternalBrowser=1${hash}`;
}
