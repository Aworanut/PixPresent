"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addToBlacklist(eventId: string, faceId: string, note?: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("face_blacklist")
    .upsert({ event_id: eventId, face_id: faceId, note: note ?? null },
             { onConflict: "event_id,face_id", ignoreDuplicates: true });
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/events/${eventId}/blacklist`);
}

export async function removeFromBlacklist(eventId: string, faceId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("face_blacklist")
    .delete()
    .eq("event_id", eventId)
    .eq("face_id", faceId);
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/events/${eventId}/blacklist`);
}
