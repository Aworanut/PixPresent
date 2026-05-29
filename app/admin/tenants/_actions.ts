"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export type LedgerEntry = {
  id: string;
  delta: number;
  balance_after: number;
  reason: string;
  note: string | null;
  created_at: string;
};

export async function getTenantLedger(tenantId: string): Promise<LedgerEntry[]> {
  const admin = createServiceRoleClient();
  const { data } = await admin
    .from("credit_ledger")
    .select("id, delta, balance_after, reason, note, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(20)
    .returns<LedgerEntry[]>();
  return data ?? [];
}

export async function adjustCredit(
  tenantId: string,
  delta: number,
  note: string,
): Promise<{ error?: string }> {
  if (!Number.isInteger(delta) || delta === 0)
    return { error: "จำนวนต้องเป็นจำนวนเต็มที่ไม่ใช่ 0" };
  if (!note.trim()) return { error: "กรุณากรอกเหตุผล" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "unauthorized" };

  const admin = createServiceRoleClient();
  const { error } = await admin.rpc("adjust_credit", {
    p_tenant_id: tenantId,
    p_delta: delta,
    p_note: note.trim(),
    p_actor: user.id,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/tenants");
  revalidatePath("/admin");
  return {};
}
