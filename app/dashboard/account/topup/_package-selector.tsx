"use client";

import { useState } from "react";
import { TOPUP_PACKAGES, CUSTOM_TOPUP, type TopupPackage } from "@/lib/payment-config";

type SelectedPackage = { id: string; priceThb: number; credits: number };

type Props = {
  onSelect: (pkg: SelectedPackage | null) => void;
};

export function PackageSelector({ onSelect }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [customValue, setCustomValue] = useState<string>("");
  const [customError, setCustomError] = useState<string | null>(null);

  function selectPreset(pkg: TopupPackage) {
    setSelected(pkg.id);
    setCustomError(null);
    onSelect({ id: pkg.id, priceThb: pkg.priceThb, credits: pkg.credits });
  }

  function selectCustom() {
    setSelected("custom");
    // If there's already a valid custom value, emit it; otherwise emit null
    const num = parseInt(customValue, 10);
    if (
      !isNaN(num) &&
      num >= CUSTOM_TOPUP.minThb &&
      num <= CUSTOM_TOPUP.maxThb
    ) {
      onSelect({ id: "custom", priceThb: num, credits: num });
    } else {
      onSelect(null);
    }
  }

  function handleCustomBlur() {
    const num = parseInt(customValue, 10);
    if (!customValue) {
      setCustomError(null);
      onSelect(null);
      return;
    }
    if (isNaN(num) || num < CUSTOM_TOPUP.minThb || num > CUSTOM_TOPUP.maxThb) {
      setCustomError(`กรุณากรอก ${CUSTOM_TOPUP.minThb.toLocaleString()} – ${CUSTOM_TOPUP.maxThb.toLocaleString()} THB`);
      onSelect(null);
    } else {
      setCustomError(null);
      onSelect({ id: "custom", priceThb: num, credits: num });
    }
  }

  function handleCustomChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setCustomValue(val);
    setCustomError(null);
    const num = parseInt(val, 10);
    if (
      !isNaN(num) &&
      num >= CUSTOM_TOPUP.minThb &&
      num <= CUSTOM_TOPUP.maxThb
    ) {
      onSelect({ id: "custom", priceThb: num, credits: num });
    } else {
      onSelect(null);
    }
  }

  const cardBase =
    "relative cursor-pointer rounded-xl border p-4 transition-all select-none";
  const cardIdle =
    "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-400 dark:hover:border-zinc-600";
  const cardActive =
    "border-zinc-900 dark:border-zinc-100 bg-white dark:bg-zinc-900 ring-2 ring-zinc-900 dark:ring-zinc-100";

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {TOPUP_PACKAGES.map((pkg) => (
        <button
          key={pkg.id}
          type="button"
          onClick={() => selectPreset(pkg)}
          className={[cardBase, selected === pkg.id ? cardActive : cardIdle].join(" ")}
        >
          {pkg.highlight && (
            <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-zinc-900 dark:bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-50 dark:text-zinc-900 whitespace-nowrap">
              แนะนำ
            </span>
          )}
          <p className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
            {pkg.credits.toLocaleString()}
          </p>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">Credits</p>
          <p className="mt-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            ฿{pkg.priceThb.toLocaleString()}
          </p>
        </button>
      ))}

      {/* Custom card */}
      <div
        role="button"
        tabIndex={0}
        onClick={selectCustom}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") selectCustom(); }}
        className={[cardBase, selected === "custom" ? cardActive : cardIdle].join(" ")}
      >
        <p className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Custom</p>
        <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">กำหนดเอง</p>
        {selected === "custom" && (
          <div className="mt-3" onClick={(e) => e.stopPropagation()}>
            <input
              type="number"
              aria-label="จำนวนเงิน (THB)"
              aria-invalid={!!customError}
              aria-describedby={customError ? "custom-amount-error" : undefined}
              min={CUSTOM_TOPUP.minThb}
              max={CUSTOM_TOPUP.maxThb}
              step={1}
              value={customValue}
              onChange={handleCustomChange}
              onBlur={handleCustomBlur}
              placeholder={`${CUSTOM_TOPUP.minThb.toLocaleString()} – ${CUSTOM_TOPUP.maxThb.toLocaleString()} THB`}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-2.5 py-1.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
              autoFocus
            />
            {customError && (
              <p id="custom-amount-error" className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                {customError}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
