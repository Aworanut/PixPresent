import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { PricingEditor } from "./_pricing-editor";

export default async function AdminPricingPage() {
  const admin = createServiceRoleClient();
  const [pkgRes, tierRes] = await Promise.all([
    admin
      .from("topup_packages")
      .select("id, credits, price_thb, label, highlight, active, sort")
      .order("sort"),
    admin
      .from("event_tiers")
      .select(
        "id, credit_cost, storage_limit_gb, link_active_days, data_retention_days, label, description, active, sort",
      )
      .order("sort"),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 sm:py-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Pricing
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          แก้ราคา / ฟีเจอร์ tier — มีผลกับงานที่สร้าง
          <span className="font-medium">ใหม่</span>เท่านั้น (งานเดิม snapshot
          ค่าไว้แล้ว ไม่กระทบย้อนหลัง)
        </p>
      </div>
      <PricingEditor packages={pkgRes.data ?? []} tiers={tierRes.data ?? []} />
    </div>
  );
}
