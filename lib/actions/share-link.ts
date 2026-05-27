"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function setShareLink(eventId: string, days: number) {
  const safeDays = Math.max(1, Math.min(365, Math.floor(days || 7)));
  const supabase = await createClient();

  const { error } = await supabase
    .from("events")
    .update({
      share_token: randomUUID(),
      share_token_expires_at: new Date(Date.now() + safeDays * DAY_MS).toISOString(),
      share_link_expires_days: safeDays,
    })
    .eq("id", eventId);

  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/events/${eventId}`);
}

export async function revokeShareLink(eventId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("events")
    .update({
      // 1s ago — token row stays for audit, but any guest request reads as expired
      share_token_expires_at: new Date(Date.now() - 1000).toISOString(),
    })
    .eq("id", eventId);

  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/events/${eventId}`);
}
