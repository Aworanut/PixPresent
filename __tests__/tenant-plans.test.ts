import { describe, it, expect } from "vitest";
import {
  hasUnlimitedRetention,
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
