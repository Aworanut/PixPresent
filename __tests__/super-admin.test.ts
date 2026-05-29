import { describe, it, expect, afterEach } from "vitest";
import {
  isSuperAdminEmail,
  getPrimaryAdminEmail,
  getSuperAdminEmails,
} from "@/lib/auth/super-admin";

describe("super-admin allowlist", () => {
  const original = process.env.SUPER_ADMIN_EMAILS;
  afterEach(() => {
    process.env.SUPER_ADMIN_EMAILS = original;
  });

  it("returns false when env unset", () => {
    delete process.env.SUPER_ADMIN_EMAILS;
    expect(isSuperAdminEmail("a@b.com")).toBe(false);
  });

  it("matches a single configured email case-insensitively", () => {
    process.env.SUPER_ADMIN_EMAILS = "Owner@Example.com";
    expect(isSuperAdminEmail("owner@example.com")).toBe(true);
    expect(isSuperAdminEmail("OWNER@EXAMPLE.COM")).toBe(true);
  });

  it("matches any email in a comma-separated list", () => {
    process.env.SUPER_ADMIN_EMAILS = "a@x.com, b@y.com ,c@z.com";
    expect(getSuperAdminEmails()).toEqual(["a@x.com", "b@y.com", "c@z.com"]);
    expect(isSuperAdminEmail("b@y.com")).toBe(true);
    expect(isSuperAdminEmail("d@w.com")).toBe(false);
  });

  it("returns false for null/undefined/empty email", () => {
    process.env.SUPER_ADMIN_EMAILS = "a@x.com";
    expect(isSuperAdminEmail(null)).toBe(false);
    expect(isSuperAdminEmail(undefined)).toBe(false);
    expect(isSuperAdminEmail("")).toBe(false);
  });

  it("primary admin email is the first entry", () => {
    process.env.SUPER_ADMIN_EMAILS = "first@x.com,second@y.com";
    expect(getPrimaryAdminEmail()).toBe("first@x.com");
  });
});
