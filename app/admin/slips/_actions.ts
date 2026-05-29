"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

// Returns string | undefined (not null): the RPC's p_actor is optional, so an
// absent actor omits the arg and the SQL `default null` applies.
async function getActorId(): Promise<string | undefined> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id;
}

export async function approveSlip(slipId: string): Promise<{ error?: string }> {
  const actor = await getActorId();
  const admin = createServiceRoleClient();
  const { error } = await admin.rpc("approve_topup_credit", {
    p_slip_id: slipId,
    p_actor: actor,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/slips");
  revalidatePath("/admin");
  return {};
}

export async function rejectSlip(
  slipId: string,
  reason: string,
): Promise<{ error?: string }> {
  if (!reason.trim()) return { error: "กรุณากรอกเหตุผล" };
  const actor = await getActorId();
  const admin = createServiceRoleClient();
  const { error } = await admin.rpc("reject_topup", {
    p_slip_id: slipId,
    p_reason: reason.trim(),
    p_actor: actor,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/slips");
  revalidatePath("/admin");
  return {};
}
