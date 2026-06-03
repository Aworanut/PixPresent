import { describe, it, expect } from "vitest";
import {
  normalizePromoCode,
  computeBonusCredits,
  checkPromoEligibility,
  type Promotion,
} from "@/lib/promotions";

const base: Promotion = {
  id: "p1",
  code: "NEWYEAR",
  kind: "percent",
  value: 20,
  minTopupThb: 0,
  maxRedemptions: null,
  perTenantLimit: 1,
  redeemedCount: 0,
  startsAt: null,
  endsAt: null,
  active: true,
};

const ctx = (over: Partial<{ amountThb: number; nowIso: string; tenantRedemptions: number }> = {}) => ({
  amountThb: 1000,
  nowIso: "2026-06-01T00:00:00.000Z",
  tenantRedemptions: 0,
  ...over,
});

describe("normalizePromoCode", () => {
  it("trims and uppercases", () => {
    expect(normalizePromoCode("  newyear ")).toBe("NEWYEAR");
  });
});

describe("computeBonusCredits", () => {
  it("percent floors the bonus", () => {
    expect(computeBonusCredits({ ...base, kind: "percent", value: 20 }, 999)).toBe(199);
  });
  it("fixed returns the flat value", () => {
    expect(computeBonusCredits({ ...base, kind: "fixed", value: 100 }, 999)).toBe(100);
  });
});

describe("checkPromoEligibility", () => {
  it("grants bonus when eligible", () => {
    const r = checkPromoEligibility(base, ctx());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.bonusCredits).toBe(200);
  });

  it("rejects inactive promos", () => {
    expect(checkPromoEligibility({ ...base, active: false }, ctx()).ok).toBe(false);
  });

  it("respects the start/end window", () => {
    expect(
      checkPromoEligibility({ ...base, startsAt: "2026-07-01T00:00:00Z" }, ctx()).ok,
    ).toBe(false);
    expect(
      checkPromoEligibility({ ...base, endsAt: "2026-05-01T00:00:00Z" }, ctx()).ok,
    ).toBe(false);
  });

  it("enforces the minimum top-up", () => {
    expect(
      checkPromoEligibility({ ...base, minTopupThb: 2000 }, ctx({ amountThb: 1000 })).ok,
    ).toBe(false);
  });

  it("enforces global + per-tenant redemption limits", () => {
    expect(
      checkPromoEligibility({ ...base, maxRedemptions: 5, redeemedCount: 5 }, ctx()).ok,
    ).toBe(false);
    expect(
      checkPromoEligibility({ ...base, perTenantLimit: 1 }, ctx({ tenantRedemptions: 1 })).ok,
    ).toBe(false);
  });
});
