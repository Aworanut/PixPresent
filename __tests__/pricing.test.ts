import { describe, it, expect } from "vitest";
import { validateTopupRequest } from "@/lib/topup";
import type { TopupPackage } from "@/lib/payment-config";

// Simulates DB-loaded packages after an admin edit: pack_499 has been repriced,
// and pack_999 has been removed from the active set — to prove validation tracks
// the injected set rather than the code constants.
const dbPackages: TopupPackage[] = [
  { id: "pack_199", credits: 199, priceThb: 199, label: "199" },
  { id: "pack_499", credits: 650, priceThb: 599, label: "499 repriced" },
];

describe("validateTopupRequest — injected (DB) packages", () => {
  it("accepts an injected package at its edited price + credits", () => {
    expect(
      validateTopupRequest("pack_499", 599, 650, { packages: dbPackages }).valid,
    ).toBe(true);
  });

  it("rejects the old constant price once the DB has repriced it", () => {
    expect(
      validateTopupRequest("pack_499", 499, 499, { packages: dbPackages }).valid,
    ).toBe(false);
  });

  it("rejects an id absent from the injected (active) set", () => {
    // pack_999 is a code-constant package but NOT in dbPackages
    expect(
      validateTopupRequest("pack_999", 999, 999, { packages: dbPackages }).valid,
    ).toBe(false);
  });

  it("uses an injected custom range", () => {
    const custom = { minThb: 500, maxThb: 1000 };
    expect(validateTopupRequest("custom", 600, 600, { custom }).valid).toBe(true);
    expect(validateTopupRequest("custom", 100, 100, { custom }).valid).toBe(false);
  });

  it("falls back to code constants when no opts are given (backward compat)", () => {
    expect(validateTopupRequest("pack_499", 499, 499).valid).toBe(true);
  });
});
