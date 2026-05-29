// Read+parse at call time (not module load) so behavior tracks env in tests
// and across server invocations.
export function getSuperAdminEmails(): string[] {
  return (process.env.SUPER_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isSuperAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getSuperAdminEmails().includes(email.toLowerCase());
}

export function getPrimaryAdminEmail(): string {
  return getSuperAdminEmails()[0] ?? "";
}
