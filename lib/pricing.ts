// lib/pricing.ts
// DB-backed pricing/tier loaders with graceful fallback to the code constants.
// Matches the project's external-service-degradation convention and de-risks the
// money path: if the DB tables are empty or unreachable, callers get exactly the
// seeded constants (current behaviour). Server-only (service-role client).
//
// Per-request memoized via React `cache` (fresh across requests → no staleness
// after a super-admin edits a price; the tables are tiny so no further caching).

import { cache } from "react";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  TOPUP_PACKAGES,
  CUSTOM_TOPUP,
  type TopupPackage,
  type TopupPackageId,
} from "@/lib/payment-config";
import {
  TIER_CONFIG,
  EVENT_TIERS,
  type EventTier,
  type TierConfig,
} from "@/lib/credit-packages";

export type EventTierOption = TierConfig & { id: EventTier };

export const loadTopupPackages = cache(async (): Promise<TopupPackage[]> => {
  try {
    const admin = createServiceRoleClient();
    const { data, error } = await admin
      .from("topup_packages")
      .select("id, credits, price_thb, label, highlight, active, sort")
      .eq("active", true)
      .order("sort", { ascending: true });
    if (error || !data || data.length === 0) return TOPUP_PACKAGES;
    return data.map((r) => ({
      id: r.id as TopupPackageId,
      credits: r.credits,
      priceThb: r.price_thb,
      label: r.label,
      highlight: r.highlight || undefined,
    }));
  } catch {
    return TOPUP_PACKAGES;
  }
});

export const loadEventTierList = cache(async (): Promise<EventTierOption[]> => {
  const fallback = (): EventTierOption[] =>
    EVENT_TIERS.map((id) => ({ id, ...TIER_CONFIG[id] }));
  try {
    const admin = createServiceRoleClient();
    const { data, error } = await admin
      .from("event_tiers")
      .select(
        "id, credit_cost, storage_limit_gb, link_active_days, data_retention_days, label, description, active, sort",
      )
      .eq("active", true)
      .order("sort", { ascending: true });
    if (error || !data || data.length === 0) return fallback();
    return data.map((r) => ({
      id: r.id as EventTier,
      creditCost: r.credit_cost,
      storageLimitGb: r.storage_limit_gb,
      linkActiveDays: r.link_active_days,
      dataRetentionDays: r.data_retention_days,
      label: r.label,
      description: r.description,
    }));
  } catch {
    return fallback();
  }
});

/** Single tier config for the given id (used by event creation). */
export const loadTierConfig = cache(
  async (tier: EventTier): Promise<TierConfig> => {
    const found = (await loadEventTierList()).find((t) => t.id === tier);
    if (!found) return TIER_CONFIG[tier];
    return {
      creditCost: found.creditCost,
      storageLimitGb: found.storageLimitGb,
      linkActiveDays: found.linkActiveDays,
      dataRetentionDays: found.dataRetentionDays,
      label: found.label,
      description: found.description,
    };
  },
);

/** Custom top-up range. Still a code constant (rarely changes); exposed here so
 *  callers have a single pricing entry point. */
export function loadCustomTopupRange(): { minThb: number; maxThb: number } {
  return { minThb: CUSTOM_TOPUP.minThb, maxThb: CUSTOM_TOPUP.maxThb };
}
