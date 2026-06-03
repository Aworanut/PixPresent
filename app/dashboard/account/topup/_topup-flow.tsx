"use client";

import { useState } from "react";
import type { TopupPackage } from "@/lib/payment-config";
import { PackageSelector } from "./_package-selector";
import { PaymentPanel } from "./_payment-panel";

type SelectedPackage = { id: string; priceThb: number; credits: number };

export function TopupFlow({
  packages,
  custom,
}: {
  packages: TopupPackage[];
  custom: { minThb: number; maxThb: number };
}) {
  const [selected, setSelected] = useState<SelectedPackage | null>(null);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
          เลือกแพ็กเกจ
        </h2>
        <PackageSelector packages={packages} custom={custom} onSelect={setSelected} />
      </div>

      {selected && (
        <div>
          <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
            ชำระเงิน
          </h2>
          <div className="max-w-sm">
            <PaymentPanel selected={selected} />
          </div>
        </div>
      )}
    </div>
  );
}
