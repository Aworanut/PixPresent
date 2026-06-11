"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowPathIcon } from "@heroicons/react/24/outline";

type Phase = "idle" | "running" | "done" | "error";

// Runs the person-archive matching engine via /api/people/scan, resuming across
// 60s windows (POST again on `continue`) until the queue drains — same pattern
// as the photo sync toolbar.
export function PeopleScanRunner({ pendingCount }: { pendingCount: number }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [matched, setMatched] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  // One POST = one 60s pass. Returns the terminal signal for that pass.
  const runPass = async (): Promise<{ kind: "done" | "continue" | "error"; matched: number }> => {
    const res = await fetch("/api/people/scan", { method: "POST" });
    if (!res.ok || !res.body) {
      setMessage(`HTTP ${res.status}`);
      return { kind: "error", matched: 0 };
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let kind: "done" | "continue" | "error" = "continue";
    let passMatched = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split("\n\n");
      buffer = chunks.pop() ?? "";
      for (const chunk of chunks) {
        const line = chunk.split("\n").find((l) => l.startsWith("data: "));
        if (!line) continue;
        try {
          const ev = JSON.parse(line.slice(6));
          if (typeof ev.photos_matched === "number") passMatched = ev.photos_matched;
          if (ev.type === "done") kind = "done";
          else if (ev.type === "continue") kind = "continue";
          else if (ev.type === "error") {
            kind = "error";
            setMessage(String(ev.message ?? "scan error"));
          }
        } catch {
          /* ignore parse errors */
        }
      }
    }
    return { kind, matched: passMatched };
  };

  const run = async () => {
    if (phase === "running") return;
    setPhase("running");
    setMessage(null);
    setMatched(0);

    let total = 0;
    // Guard against a non-terminating resume loop.
    for (let pass = 0; pass < 40; pass++) {
      const outcome = await runPass();
      total += outcome.matched;
      setMatched(total);
      if (outcome.kind === "error") {
        setPhase("error");
        return;
      }
      router.refresh(); // surface newly-matched photos as they land
      if (outcome.kind === "done") {
        setPhase("done");
        return;
      }
    }
    // Hit the pass guard with work still pending.
    setMessage("ค้นยังไม่จบ — กดสแกนอีกครั้งเพื่อทำต่อ");
    setPhase("idle");
  };

  if (pendingCount === 0 && phase === "idle") return null;

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-[rgba(212,175,55,0.3)] bg-[#F5EEDC]/40 dark:bg-zinc-800/60">
      <ArrowPathIcon
        className={`h-4 w-4 text-[#D4AF37] ${phase === "running" ? "animate-spin" : ""}`}
      />
      <span className="text-xs text-zinc-600 dark:text-zinc-400">
        {phase === "running"
          ? `กำลังค้นใบหน้า… เจอเพิ่ม ${matched} รูป`
          : phase === "done"
            ? `ค้นเสร็จ — เพิ่ม ${matched} รูป`
            : phase === "error"
              ? `เกิดข้อผิดพลาด: ${message ?? ""}`
              : `มีงานค้นค้างอยู่ ${pendingCount} รายการ`}
      </span>
      {(phase === "idle" || phase === "error") && (
        <button
          type="button"
          onClick={run}
          className="ml-auto px-3 py-1 rounded text-xs font-mono tracking-wider font-semibold bg-[#D4AF37] text-black hover:bg-[#c49f2e] transition-all"
        >
          เริ่มค้นหา
        </button>
      )}
    </div>
  );
}
