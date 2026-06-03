"use client";

import { useState, useTransition } from "react";
import {
  createPromotion,
  setPromotionActive,
  deletePromotion,
} from "./_actions";

export type PromoRow = {
  id: string;
  code: string;
  description: string;
  kind: "percent" | "fixed";
  value: number;
  min_topup_thb: number;
  max_redemptions: number | null;
  per_tenant_limit: number;
  redeemed_count: number;
  starts_at: string | null;
  ends_at: string | null;
  active: boolean;
};

const inputCls =
  "rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="text-zinc-400">{label}</span>
      {children}
    </label>
  );
}

function CreateForm() {
  const [code, setCode] = useState("");
  const [kind, setKind] = useState<"percent" | "fixed">("percent");
  const [value, setValue] = useState("20");
  const [minTopup, setMinTopup] = useState("0");
  const [perTenant, setPerTenant] = useState("1");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    start(async () => {
      const r = await createPromotion({
        code,
        description: "",
        kind,
        value: parseInt(value, 10),
        minTopupThb: parseInt(minTopup, 10) || 0,
        maxRedemptions: maxRedemptions ? parseInt(maxRedemptions, 10) : null,
        perTenantLimit: parseInt(perTenant, 10) || 1,
        startsAt: null,
        endsAt: endsAt ? new Date(endsAt).toISOString() : null,
      });
      if (r.error) {
        setMsg(`❌ ${r.error}`);
      } else {
        setMsg("✓ สร้างโปรแล้ว");
        setCode("");
        setValue("20");
        setMinTopup("0");
        setPerTenant("1");
        setMaxRedemptions("");
        setEndsAt("");
      }
    });
  };

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          สร้างโปรโมชั่น
        </h2>
        {msg && <span className="text-xs text-zinc-500">{msg}</span>}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="โค้ด">
          <input
            className={inputCls}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="NEWYEAR"
          />
        </Field>
        <Field label="ชนิด">
          <select
            className={inputCls}
            value={kind}
            onChange={(e) => setKind(e.target.value as "percent" | "fixed")}
          >
            <option value="percent">% โบนัส</option>
            <option value="fixed">โบนัสคงที่ (credits)</option>
          </select>
        </Field>
        <Field label={kind === "percent" ? "เปอร์เซ็นต์" : "credits"}>
          <input
            className={inputCls}
            type="number"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </Field>
        <Field label="เติมขั้นต่ำ (THB)">
          <input
            className={inputCls}
            type="number"
            value={minTopup}
            onChange={(e) => setMinTopup(e.target.value)}
          />
        </Field>
        <Field label="ลิมิต/ผู้ใช้">
          <input
            className={inputCls}
            type="number"
            value={perTenant}
            onChange={(e) => setPerTenant(e.target.value)}
          />
        </Field>
        <Field label="ใช้ได้รวม (ว่าง=ไม่จำกัด)">
          <input
            className={inputCls}
            type="number"
            value={maxRedemptions}
            onChange={(e) => setMaxRedemptions(e.target.value)}
          />
        </Field>
        <Field label="หมดเขต (optional)">
          <input
            className={inputCls}
            type="date"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
          />
        </Field>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {pending ? "กำลังสร้าง…" : "สร้างโปร"}
      </button>
    </form>
  );
}

function PromoListItem({ promo }: { promo: PromoRow }) {
  const [pending, start] = useTransition();
  const bonus =
    promo.kind === "percent" ? `+${promo.value}%` : `+${promo.value} cr`;
  const used =
    promo.max_redemptions != null
      ? `${promo.redeemed_count}/${promo.max_redemptions}`
      : `${promo.redeemed_count}`;

  return (
    <tr className="bg-white dark:bg-zinc-900">
      <td className="px-4 py-3 font-mono text-xs font-medium text-zinc-900 dark:text-zinc-100">
        {promo.code}
      </td>
      <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{bonus}</td>
      <td className="hidden px-4 py-3 text-zinc-500 sm:table-cell">
        {promo.min_topup_thb > 0 ? `≥฿${promo.min_topup_thb.toLocaleString()}` : "—"}
      </td>
      <td className="px-4 py-3 tabular-nums text-zinc-500">{used}</td>
      <td className="px-4 py-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => start(async () => { await setPromotionActive(promo.id, !promo.active); })}
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            promo.active
              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400"
              : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
          }`}
        >
          {promo.active ? "active" : "ปิด"}
        </button>
      </td>
      <td className="px-4 py-3 text-right">
        <button
          type="button"
          disabled={pending}
          onClick={() => start(async () => { await deletePromotion(promo.id); })}
          className="text-xs text-rose-500 hover:text-rose-700 disabled:opacity-50 dark:hover:text-rose-300"
        >
          ลบ
        </button>
      </td>
    </tr>
  );
}

export function PromotionsManager({ promos }: { promos: PromoRow[] }) {
  return (
    <div className="space-y-6">
      <CreateForm />

      {promos.length === 0 ? (
        <p className="text-sm text-zinc-500">ยังไม่มีโปรโมชั่น</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-400 dark:bg-zinc-900/60">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Code</th>
                <th className="px-4 py-2.5 text-left font-medium">โบนัส</th>
                <th className="hidden px-4 py-2.5 text-left font-medium sm:table-cell">
                  ขั้นต่ำ
                </th>
                <th className="px-4 py-2.5 text-left font-medium">ใช้ไป</th>
                <th className="px-4 py-2.5 text-left font-medium">สถานะ</th>
                <th className="px-4 py-2.5 text-right font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {promos.map((p) => (
                <PromoListItem key={p.id} promo={p} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
