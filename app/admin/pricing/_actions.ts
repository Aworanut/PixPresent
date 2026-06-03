"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export type SaveResult = { error?: string };

export async function updateTopupPackage(
  id: string,
  fields: {
    credits: number;
    price_thb: number;
    label: string;
    highlight: boolean;
    active: boolean;
  },
): Promise<SaveResult> {
  if (!Number.isInteger(fields.credits) || fields.credits <= 0)
    return { error: "credits ต้องเป็นจำนวนเต็มบวก" };
  if (!Number.isInteger(fields.price_thb) || fields.price_thb <= 0)
    return { error: "ราคาต้องเป็นจำนวนเต็มบวก" };
  if (!fields.label.trim()) return { error: "ต้องมี label" };

  const admin = createServiceRoleClient();
  const { error } = await admin
    .from("topup_packages")
    .update({
      credits: fields.credits,
      price_thb: fields.price_thb,
      label: fields.label.trim(),
      highlight: fields.highlight,
      active: fields.active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/admin/pricing");
  return {};
}

export async function updateEventTier(
  id: string,
  fields: {
    credit_cost: number;
    storage_limit_gb: number;
    link_active_days: number;
    data_retention_days: number;
    label: string;
    description: string;
    active: boolean;
  },
): Promise<SaveResult> {
  const positives: [string, number][] = [
    ["credit cost", fields.credit_cost],
    ["storage", fields.storage_limit_gb],
    ["link days", fields.link_active_days],
    ["retention days", fields.data_retention_days],
  ];
  for (const [name, value] of positives) {
    if (!Number.isInteger(value) || value <= 0)
      return { error: `${name} ต้องเป็นจำนวนเต็มบวก` };
  }
  if (!fields.label.trim()) return { error: "ต้องมี label" };

  const admin = createServiceRoleClient();
  const { error } = await admin
    .from("event_tiers")
    .update({
      credit_cost: fields.credit_cost,
      storage_limit_gb: fields.storage_limit_gb,
      link_active_days: fields.link_active_days,
      data_retention_days: fields.data_retention_days,
      label: fields.label.trim(),
      description: fields.description.trim(),
      active: fields.active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/admin/pricing");
  return {};
}
