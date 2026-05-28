import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/account/credits
 *
 * Returns the user's credit balance, ledger history, and recent slip uploads.
 * Requires authentication.
 *
 * Response shape:
 * {
 *   balance: number;
 *   ledger: Array<{
 *     id: string;
 *     delta: number;
 *     balance_after: number;
 *     reason: string;
 *     ref_id: string | null;
 *     note: string | null;
 *     created_at: string;
 *   }>; // 50 most recent entries, newest first
 *   slips: Array<{
 *     id: string;
 *     package_id: string;
 *     amount_thb: number;
 *     credits_claimed: number;
 *     slip_image_url: string;
 *     status: string;
 *     reject_reason: string | null;
 *     uploaded_at: string;
 *     verified_at: string | null;
 *   }>; // 20 most recent slips
 * }
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  // 1. Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Get tenant
  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .select("id, credit_balance")
    .eq("owner_user_id", user.id)
    .single();

  if (tenantError || !tenant) {
    return Response.json({ error: "Tenant not found" }, { status: 404 });
  }

  // 3. Get ledger (50 most recent, newest first)
  const { data: ledger, error: ledgerError } = await supabase
    .from("credit_ledger")
    .select("id, delta, balance_after, reason, ref_id, note, created_at")
    .eq("tenant_id", tenant.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (ledgerError) {
    return Response.json({ error: "Failed to fetch ledger" }, { status: 500 });
  }

  // 4. Get slips (20 most recent, newest first)
  const { data: slips, error: slipsError } = await supabase
    .from("slip_uploads")
    .select(
      "id, package_id, amount_thb, credits_claimed, slip_image_url, status, reject_reason, uploaded_at, verified_at",
    )
    .eq("tenant_id", tenant.id)
    .order("uploaded_at", { ascending: false })
    .limit(20);

  if (slipsError) {
    return Response.json({ error: "Failed to fetch slips" }, { status: 500 });
  }

  // 5. Return combined response
  return Response.json({
    balance: tenant.credit_balance,
    ledger: ledger || [],
    slips: slips || [],
  });
}
