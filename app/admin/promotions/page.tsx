import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { PromotionsManager, type PromoRow } from "./_promotions-manager";

export default async function AdminPromotionsPage() {
  const admin = createServiceRoleClient();
  const { data } = await admin
    .from("promotions")
    .select(
      "id, code, description, kind, value, min_topup_thb, max_redemptions, per_tenant_limit, redeemed_count, starts_at, ends_at, active",
    )
    .order("created_at", { ascending: false })
    .returns<PromoRow[]>();

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 sm:py-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Promotions
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          โบนัสเครดิตตอนเติมเงิน · การจ่ายโบนัสจริง (redemption) ยังรอ wire เข้า
          money path — ดู spec
        </p>
      </div>
      <PromotionsManager promos={data ?? []} />
    </div>
  );
}
