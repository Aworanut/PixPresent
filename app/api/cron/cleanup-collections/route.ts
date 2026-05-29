import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { deleteRekognitionCollection } from "@/lib/aws/rekognition";
import { sendCleanupFailureAlert } from "@/lib/email/notifications";

export const runtime = "nodejs";

// Invoked daily at 02:00 TH (19:00 UTC) — schedule set in vercel.json.
// Vercel automatically sends `Authorization: Bearer <CRON_SECRET>` when
// triggering cron jobs. The same header is required for manual invocation.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createServiceRoleClient();

  // Fetch events that have an active Rekognition collection and have been
  // activated (i.e., organizer has paid and synced at least once).
  const { data: events, error } = await admin
    .from("events")
    .select("id, name, rekognition_collection_id, activated_at, data_retention_days")
    .not("rekognition_collection_id", "is", null)
    .not("activated_at", "is", null)
    .is("deleted_at", null);

  if (error) {
    console.error("[cleanup-collections] query failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const now = new Date();

  // Filter to events whose retention window + 7-day grace period has elapsed.
  // Trigger: activated_at + data_retention_days + 7 days < now
  const toClean = (events ?? []).filter((e) => {
    const cutoff = new Date(e.activated_at!);
    cutoff.setDate(cutoff.getDate() + e.data_retention_days + 7);
    return cutoff < now;
  });

  if (toClean.length === 0) {
    console.log("[cleanup-collections] nothing to clean");
    return NextResponse.json({ cleaned: 0, failed: 0 });
  }

  console.log(`[cleanup-collections] ${toClean.length} collection(s) due for deletion`);

  const results = await Promise.allSettled(
    toClean.map(async (event) => {
      const { ok, skipped } = await deleteRekognitionCollection(
        event.rekognition_collection_id,
      );

      if (!ok) {
        throw new Error(
          `DeleteCollection failed for event "${event.name}" (${event.id})`,
        );
      }

      // Null out the collection ID so this event is never retried.
      const { error: updateErr } = await admin
        .from("events")
        .update({ rekognition_collection_id: null })
        .eq("id", event.id);

      if (updateErr) {
        // Log but don't rethrow — collection is gone, the DB update is
        // non-critical and will be retried on the next cron run (idempotent).
        console.warn(
          `[cleanup-collections] DB update failed for ${event.id}:`,
          updateErr.message,
        );
      }

      console.log(
        `[cleanup-collections] cleaned event "${event.name}"` +
          (skipped ? ` (${skipped})` : ""),
      );

      return event.id;
    }),
  );

  const failures = results
    .filter((r): r is PromiseRejectedResult => r.status === "rejected")
    .map((r) => String(r.reason?.message ?? r.reason));

  const cleaned = results.filter((r) => r.status === "fulfilled").length;

  if (failures.length > 0) {
    console.error("[cleanup-collections] failures:", failures);
    await sendCleanupFailureAlert({ failures });
  }

  return NextResponse.json({ cleaned, failed: failures.length });
}
