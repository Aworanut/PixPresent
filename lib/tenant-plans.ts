// lib/tenant-plans.ts
// Account-level tenant plans (tenants.plan). Pure + Next-free so Vitest can
// exercise it directly (mirrors lib/topup.ts / lib/credit-packages.ts).
// See ISSUES #B-06 and docs/adr/0004-photographer-customer-and-revenue-model.md.
//
// 'business' is the special tier. Its first unlocked feature is UNLIMITED data
// retention: its events are skipped by the cleanup-collections cron and never
// expire. More features (commerce gating, member seats) come later — and
// multi-member org/roles (ADR 0004 "Stage 2") is a separate, deferred change.

export const TENANT_PLANS = ["free", "starter", "pro", "business"] as const;
export type TenantPlan = (typeof TENANT_PLANS)[number];

// Plans whose events never expire (retention cleanup is skipped for them).
export const UNLIMITED_RETENTION_PLANS = ["business"] as const;

const UNLIMITED_SET: ReadonlySet<string> = new Set(UNLIMITED_RETENTION_PLANS);

/** True when a tenant's plan keeps its event data forever (no retention cleanup). */
export function hasUnlimitedRetention(plan: string | null | undefined): boolean {
  return !!plan && UNLIMITED_SET.has(plan);
}

export function isValidTenantPlan(value: string): value is TenantPlan {
  return (TENANT_PLANS as readonly string[]).includes(value);
}
