import { describe, it, expect } from "vitest";
import {
  hasUnlimitedRetention,
  isRetentionExpired,
  isValidTenantPlan,
  TENANT_PLANS,
} from "@/lib/tenant-plans";

describe("tenant plans", () => {
  it("business (special tier) has unlimited retention", () => {
    expect(hasUnlimitedRetention("business")).toBe(true);
  });

  it("free / starter / pro do not have unlimited retention", () => {
    expect(hasUnlimitedRetention("free")).toBe(false);
    expect(hasUnlimitedRetention("starter")).toBe(false);
    expect(hasUnlimitedRetention("pro")).toBe(false);
  });

  it("null / undefined / empty / unknown plans are not unlimited", () => {
    expect(hasUnlimitedRetention(null)).toBe(false);
    expect(hasUnlimitedRetention(undefined)).toBe(false);
    expect(hasUnlimitedRetention("")).toBe(false);
    expect(hasUnlimitedRetention("enterprise")).toBe(false);
  });

  it("validates plan values against the allowed set", () => {
    for (const p of TENANT_PLANS) expect(isValidTenantPlan(p)).toBe(true);
    expect(isValidTenantPlan("nope")).toBe(false);
    expect(isValidTenantPlan("")).toBe(false);
  });
});

describe("isRetentionExpired", () => {
  const now = new Date("2026-06-11T12:00:00Z");

  it("never expires for an unlimited-retention plan, no matter how old", () => {
    expect(
      isRetentionExpired({
        plan: "business",
        activatedAt: "2020-01-01T00:00:00Z",
        dataRetentionDays: 7,
        now,
      }),
    ).toBe(false);
  });

  it("expires for a limited plan once retention + 7-day grace has passed", () => {
    // activated 30 days ago, retention 7 (+7 grace = 14) → expired
    expect(
      isRetentionExpired({
        plan: "free",
        activatedAt: "2026-05-12T12:00:00Z",
        dataRetentionDays: 7,
        now,
      }),
    ).toBe(true);
  });

  it("not expired while inside the window", () => {
    // activated 5 days ago, retention 7 (+7 grace = 14) → still live
    expect(
      isRetentionExpired({
        plan: "free",
        activatedAt: "2026-06-06T12:00:00Z",
        dataRetentionDays: 7,
        now,
      }),
    ).toBe(false);
  });

  it("treats a missing activated_at as not expired (never activated)", () => {
    expect(
      isRetentionExpired({ plan: "free", activatedAt: null, dataRetentionDays: 7, now }),
    ).toBe(false);
  });

  it("falls back to 7-day retention when dataRetentionDays is null", () => {
    // activated 15 days ago, fallback 7 (+7 grace = 14) → expired by 1 day
    expect(
      isRetentionExpired({
        plan: "free",
        activatedAt: "2026-05-27T12:00:00Z",
        dataRetentionDays: null,
        now,
      }),
    ).toBe(true);
  });
});
