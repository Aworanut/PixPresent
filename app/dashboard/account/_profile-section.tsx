"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { updateTenantName } from "@/lib/actions/account";

type Props = {
  tenant: { id: string; name: string };
  email: string;
};

export function ProfileSection({ tenant, email }: Props) {
  const [state, action, pending] = useActionState(updateTenantName, undefined);

  return (
    <div className="space-y-8">
      <form action={action} className="space-y-6">
        <div className="space-y-6">
          {/* Company Logo / Branding Monogram Preview */}
          <div className="flex items-center gap-4 pb-2 border-b border-zinc-100 dark:border-zinc-800/60">
            <div className="h-16 w-16 rounded-none bg-white dark:bg-zinc-900 border border-[#D4AF37]/50 flex items-center justify-center text-2xl font-bold font-mono text-[#D4AF37] select-none shadow-sm">
              {tenant.name.charAt(0).toUpperCase()}
            </div>
            <div className="space-y-0.5">
              <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-50 font-mono tracking-widest uppercase">
                Company Logo / Monogram
              </h3>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 max-w-sm leading-relaxed">
                ตราสัญลักษณ์องค์กรประณีตของคุณ แสดงผลบนแถบนำทางของระบบแดชบอร์ดหลัก
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="name">ชื่อองค์กร</Label>
            <Input
              id="name"
              name="name"
              defaultValue={tenant.name}
              maxLength={120}
              required
              className="max-w-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-zinc-500 dark:text-zinc-400">อีเมล</Label>
            <p className="text-sm text-zinc-700 dark:text-zinc-300 py-2">
              {email}
            </p>
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              เปลี่ยนอีเมลผ่าน Supabase dashboard
            </p>
          </div>
        </div>

        {state && "error" in state && (
          <p className="text-sm text-rose-600 dark:text-rose-400">{state.error}</p>
        )}
        {state && "ok" in state && (
          <p className="text-sm text-emerald-600 dark:text-emerald-400">✓ บันทึกแล้ว</p>
        )}

        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "กำลังบันทึก..." : "บันทึก"}
        </Button>
      </form>
    </div>
  );
}
