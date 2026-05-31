"use client";

import { useEffect, useState } from "react";
import {
  isInAppBrowser,
  isLineBrowser,
  withExternalBrowserParam,
} from "@/lib/line-browser";

/**
 * Nudge guests who opened the link inside an in-app browser (LINE / Facebook /
 * Instagram) to switch to the system browser, where the camera works reliably.
 * The selfie *camera* already degrades to gallery today, but the future
 * liveness scan has no fallback — so surfacing this early is worth it.
 */
export function InAppBrowserNotice() {
  const [state, setState] = useState<{ show: boolean; line: boolean }>({
    show: false,
    line: false,
  });

  useEffect(() => {
    const ua = navigator.userAgent;
    if (isInAppBrowser(ua)) {
      // One-shot client-only detection: navigator is unavailable during SSR, so
      // this must run after mount. It fires once, not a render cascade.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState({ show: true, line: isLineBrowser(ua) });
    }
  }, []);

  if (!state.show) return null;

  const openExternal = () => {
    // LINE honours this param to bounce out to the system browser.
    window.location.href = withExternalBrowserParam(window.location.href);
  };

  return (
    <div className="rounded-lg border border-amber-300/60 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/30 px-4 py-3">
      <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
        คุณกำลังเปิดในแอป (LINE/Facebook) — กล้องอาจใช้งานไม่ได้
        แนะนำให้เปิดในเบราว์เซอร์ (Safari/Chrome) เพื่อค้นหารูปได้เต็มที่
      </p>
      <div className="mt-2 flex items-center gap-3">
        {state.line && (
          <button
            type="button"
            onClick={openExternal}
            className="inline-flex items-center rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 transition-colors"
          >
            เปิดในเบราว์เซอร์
          </button>
        )}
        <button
          type="button"
          onClick={() => setState((s) => ({ ...s, show: false }))}
          className="text-xs text-amber-700/80 dark:text-amber-400/80 underline underline-offset-2"
        >
          ปิด
        </button>
      </div>
    </div>
  );
}
