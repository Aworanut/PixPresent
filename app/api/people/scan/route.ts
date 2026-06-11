/**
 * POST /api/people/scan
 *
 * Runs pending person_event_scans for the authenticated tenant as Server-Sent
 * Events. Same 60s resume pattern as /api/events/[id]/sync: one invocation
 * drains as many (person × event) units as fit in the window, then signals
 * `done` (all drained) or `continue` (more remain → client re-POSTs).
 *
 *   { type: 'progress',  units_processed, photos_matched }
 *   { type: 'done',      units_processed, photos_matched }   // fully drained
 *   { type: 'continue',  units_processed, photos_matched }   // resume me
 *   { type: 'error',     message }
 *
 * Gated to the business tier (person archive is a business capability).
 */
import { getCurrentTenant } from "@/lib/auth/current-tenant";
import { scanPendingUnits } from "@/lib/people/matching";

export const maxDuration = 60;

export async function POST() {
  const ctx = await getCurrentTenant();
  if (!ctx) return new Response("Unauthorized", { status: 401 });
  if (ctx.tenant.plan !== "business") return new Response("Forbidden", { status: 403 });

  const tenantId = ctx.tenant.id;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // controller already closed (client disconnected)
        }
      };

      try {
        // Reserve a few seconds before the 60s hard cap so the final writes land.
        const deadlineMs = Date.now() + 55_000;
        const result = await scanPendingUnits(tenantId, deadlineMs);

        const payload = {
          units_processed: result.unitsProcessed,
          photos_matched: result.photosMatched,
        };
        send({ type: "progress", ...payload });
        send({ type: result.drained ? "done" : "continue", ...payload });
      } catch (err) {
        console.error("[people-scan] Unhandled error:", err);
        send({ type: "error", message: err instanceof Error ? err.message : "Unknown error" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
