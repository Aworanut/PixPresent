# Admin access via env email allowlist, not is_super_admin() JWT/RLS

**Status:** accepted

The schema ships an `is_super_admin()` function and RLS policies that grant a super admin cross-tenant reads on `tenants`, `events`, `slip_uploads`, and `credit_ledger` (it reads `app_metadata.is_super_admin` from the JWT). The `/admin` panel does **not** use that path: it guards access by checking the signed-in user's email against a `SUPER_ADMIN_EMAILS` environment allowlist in `app/admin/layout.tsx`, and reads data through the service-role client (which bypasses RLS entirely).

We chose this because there is a single admin (the platform owner) before pilot, and the env approach needs no per-user `app_metadata` provisioning, no grant step, and no token-refresh dance — adding or removing an admin is an env-var change. The privileged write RPCs (`approve_topup_credit`, `reject_topup`, `adjust_credit`) remain service-role-only.

**Considered and rejected:** wiring the panel to `is_super_admin()` (JWT + RLS). Rejected for now as over-engineered for one admin; it requires server-side granting of `app_metadata` and the JWT only carries the flag after a fresh login.

**Consequence:** the `is_super_admin()` RLS path is currently dormant (defense-in-depth only). Revisit it if we need true multi-admin RBAC or DB-enforced admin reads rather than app-layer guarding.
