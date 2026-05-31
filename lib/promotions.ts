// lib/promotions.ts
// Pure promotion logic (no Next imports → Vitest-testable, mirrors lib/topup.ts).
// Bonus-credit promos applied at top-up: percent of the transferred amount, or a
// fixed number of bonus credits.

export type PromoKind = "percent" | "fixed";

export type Promotion = {
  id: string;
  code: string;
  kind: PromoKind;
  value: number;
  minTopupThb: number;
  maxRedemptions: number | null;
  perTenantLimit: number;
  redeemedCount: number;
  startsAt: string | null;
  endsAt: string | null;
  active: boolean;
};

export type PromoContext = {
  amountThb: number;
  /** ISO timestamp to evaluate the window against (injected → deterministic). */
  nowIso: string;
  /** How many times THIS tenant has already redeemed THIS promo. */
  tenantRedemptions: number;
};

export type PromoCheck =
  | { ok: true; bonusCredits: number }
  | { ok: false; reason: string };

/** Normalize a user-entered code (trim + uppercase) for lookup/storage. */
export function normalizePromoCode(raw: string): string {
  return raw.trim().toUpperCase();
}

export function computeBonusCredits(promo: Promotion, amountThb: number): number {
  if (promo.kind === "percent") {
    return Math.max(0, Math.floor((amountThb * promo.value) / 100));
  }
  return promo.value; // fixed
}

/** Full eligibility check; returns the bonus when eligible. */
export function checkPromoEligibility(
  promo: Promotion,
  ctx: PromoContext,
): PromoCheck {
  if (!promo.active) return { ok: false, reason: "โปรโมชั่นนี้ปิดอยู่" };

  const now = new Date(ctx.nowIso).getTime();
  if (promo.startsAt && new Date(promo.startsAt).getTime() > now) {
    return { ok: false, reason: "ยังไม่ถึงเวลาเริ่มโปรโมชั่น" };
  }
  if (promo.endsAt && new Date(promo.endsAt).getTime() < now) {
    return { ok: false, reason: "โปรโมชั่นหมดอายุแล้ว" };
  }
  if (ctx.amountThb < promo.minTopupThb) {
    return {
      ok: false,
      reason: `ต้องเติมขั้นต่ำ ${promo.minTopupThb.toLocaleString()} บาทเพื่อใช้โปรนี้`,
    };
  }
  if (promo.maxRedemptions !== null && promo.redeemedCount >= promo.maxRedemptions) {
    return { ok: false, reason: "โควตาโปรโมชั่นเต็มแล้ว" };
  }
  if (ctx.tenantRedemptions >= promo.perTenantLimit) {
    return { ok: false, reason: "คุณใช้สิทธิ์โปรนี้ครบแล้ว" };
  }

  const bonusCredits = computeBonusCredits(promo, ctx.amountThb);
  if (bonusCredits <= 0) return { ok: false, reason: "โปรนี้ไม่มีเครดิตโบนัส" };

  return { ok: true, bonusCredits };
}
