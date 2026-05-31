"use client";

import { useState, useTransition } from "react";
import { updateTopupPackage, updateEventTier } from "./_actions";

export type PackageRow = {
  id: string;
  credits: number;
  price_thb: number;
  label: string;
  highlight: boolean;
  active: boolean;
  sort: number;
};

export type TierRow = {
  id: string;
  credit_cost: number;
  storage_limit_gb: number;
  link_active_days: number;
  data_retention_days: number;
  label: string;
  description: string;
  active: boolean;
  sort: number;
};

const inputCls =
  "rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-sm tabular-nums dark:border-zinc-700 dark:bg-zinc-800";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="text-zinc-400">{label}</span>
      {children}
    </label>
  );
}

function SaveButton({ pending }: { pending: boolean }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-3 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
    >
      {pending ? "กำลังบันทึก…" : "บันทึก"}
    </button>
  );
}

function RowHeader({ id, msg }: { id: string; msg: string | null }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <span className="font-mono text-xs text-zinc-400">{id}</span>
      {msg && <span className="text-xs text-zinc-500">{msg}</span>}
    </div>
  );
}

function PackageCard({ pkg }: { pkg: PackageRow }) {
  const [label, setLabel] = useState(pkg.label);
  const [credits, setCredits] = useState(String(pkg.credits));
  const [price, setPrice] = useState(String(pkg.price_thb));
  const [highlight, setHighlight] = useState(pkg.highlight);
  const [active, setActive] = useState(pkg.active);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    start(async () => {
      const r = await updateTopupPackage(pkg.id, {
        credits: parseInt(credits, 10),
        price_thb: parseInt(price, 10),
        label,
        highlight,
        active,
      });
      setMsg(r.error ? `❌ ${r.error}` : "✓ บันทึกแล้ว");
    });
  };

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
    >
      <RowHeader id={pkg.id} msg={msg} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Label">
          <input className={inputCls} value={label} onChange={(e) => setLabel(e.target.value)} />
        </Field>
        <Field label="Credits">
          <input className={inputCls} type="number" value={credits} onChange={(e) => setCredits(e.target.value)} />
        </Field>
        <Field label="ราคา (THB)">
          <input className={inputCls} type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
        </Field>
        <div className="flex items-end gap-3 text-xs">
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={highlight} onChange={(e) => setHighlight(e.target.checked)} /> แนะนำ
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> active
          </label>
        </div>
      </div>
      <SaveButton pending={pending} />
    </form>
  );
}

function TierCard({ tier }: { tier: TierRow }) {
  const [label, setLabel] = useState(tier.label);
  const [cost, setCost] = useState(String(tier.credit_cost));
  const [storage, setStorage] = useState(String(tier.storage_limit_gb));
  const [linkDays, setLinkDays] = useState(String(tier.link_active_days));
  const [retention, setRetention] = useState(String(tier.data_retention_days));
  const [desc, setDesc] = useState(tier.description);
  const [active, setActive] = useState(tier.active);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    start(async () => {
      const r = await updateEventTier(tier.id, {
        credit_cost: parseInt(cost, 10),
        storage_limit_gb: parseInt(storage, 10),
        link_active_days: parseInt(linkDays, 10),
        data_retention_days: parseInt(retention, 10),
        label,
        description: desc,
        active,
      });
      setMsg(r.error ? `❌ ${r.error}` : "✓ บันทึกแล้ว");
    });
  };

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
    >
      <RowHeader id={tier.id} msg={msg} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Field label="Label">
          <input className={inputCls} value={label} onChange={(e) => setLabel(e.target.value)} />
        </Field>
        <Field label="Credit cost">
          <input className={inputCls} type="number" value={cost} onChange={(e) => setCost(e.target.value)} />
        </Field>
        <Field label="Storage (GB)">
          <input className={inputCls} type="number" value={storage} onChange={(e) => setStorage(e.target.value)} />
        </Field>
        <Field label="Link (วัน)">
          <input className={inputCls} type="number" value={linkDays} onChange={(e) => setLinkDays(e.target.value)} />
        </Field>
        <Field label="Retention (วัน)">
          <input className={inputCls} type="number" value={retention} onChange={(e) => setRetention(e.target.value)} />
        </Field>
        <label className="flex items-end gap-1.5 text-xs">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> active
        </label>
      </div>
      <div className="mt-3">
        <Field label="Description">
          <input className={`${inputCls} w-full`} value={desc} onChange={(e) => setDesc(e.target.value)} />
        </Field>
      </div>
      <SaveButton pending={pending} />
    </form>
  );
}

export function PricingEditor({
  packages,
  tiers,
}: {
  packages: PackageRow[];
  tiers: TierRow[];
}) {
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Top-up Packages
        </h2>
        <div className="space-y-3">
          {packages.map((p) => (
            <PackageCard key={p.id} pkg={p} />
          ))}
        </div>
      </section>
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Event Tiers
        </h2>
        <div className="space-y-3">
          {tiers.map((t) => (
            <TierCard key={t.id} tier={t} />
          ))}
        </div>
      </section>
    </div>
  );
}
