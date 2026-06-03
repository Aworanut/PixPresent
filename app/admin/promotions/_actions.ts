"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { normalizePromoCode } from "@/lib/promotions";

export type PromoActionResult = { error?: string };

export type CreatePromoInput = {
  code: string;
  description: string;
  kind: "percent" | "fixed";
  value: number;
  minTopupThb: number;
  maxRedemptions: number | null;
  perTenantLimit: number;
  startsAt: string | null;
  endsAt: string | null;
};

export async function createPromotion(
  input: CreatePromoInput,
): Promise<PromoActionResult> {
  const code = normalizePromoCode(input.code);
  if (!code) return { error: "ต้องมีโค้ดโปรโมชั่น" };
  if (!Number.isInteger(input.value) || input.value <= 0)
    return { error: "ค่าโบนัสต้องเป็นจำนวนเต็มบวก" };
  if (input.kind === "percent" && input.value > 100)
    return { error: "เปอร์เซ็นต์ต้องไม่เกิน 100" };
  if (!Number.isInteger(input.perTenantLimit) || input.perTenantLimit <= 0)
    return { error: "ลิมิตต่อผู้ใช้ต้องเป็นจำนวนเต็มบวก" };

  const admin = createServiceRoleClient();
  const { error } = await admin.from("promotions").insert({
    code,
    description: input.description.trim(),
    kind: input.kind,
    value: input.value,
    min_topup_thb: Math.max(0, input.minTopupThb || 0),
    max_redemptions: input.maxRedemptions,
    per_tenant_limit: input.perTenantLimit,
    starts_at: input.startsAt,
    ends_at: input.endsAt,
  });
  if (error) {
    return {
      error: /duplicate|unique/i.test(error.message)
        ? "โค้ดนี้มีอยู่แล้ว"
        : error.message,
    };
  }
  revalidatePath("/admin/promotions");
  return {};
}

export async function setPromotionActive(
  id: string,
  active: boolean,
): Promise<PromoActionResult> {
  const admin = createServiceRoleClient();
  const { error } = await admin
    .from("promotions")
    .update({ active })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/promotions");
  return {};
}

export async function deletePromotion(id: string): Promise<PromoActionResult> {
  const admin = createServiceRoleClient();
  const { error } = await admin.from("promotions").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/promotions");
  return {};
}
