"use server";
import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export async function approveSlip(
  slipId: string,
): Promise<{ error?: string }> {
  const admin = createServiceRoleClient();
  const { error } = await admin.rpc("approve_topup_credit", {
    p_slip_id: slipId,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/slips");
  return {};
}

export async function rejectSlip(
  slipId: string,
  reason: string,
): Promise<{ error?: string }> {
  if (!reason.trim()) return { error: "กรุณากรอกเหตุผล" };
  const admin = createServiceRoleClient();
  const { error } = await admin.rpc("reject_topup", {
    p_slip_id: slipId,
    p_reason: reason.trim(),
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/slips");
  return {};
}
