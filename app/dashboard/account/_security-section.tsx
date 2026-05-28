"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { changePassword } from "@/lib/actions/account";

export function SecuritySection() {
  return (
    <div className="space-y-10">
      <ChangePasswordForm />
    </div>
  );
}

function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changePassword, undefined);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          เปลี่ยนรหัสผ่าน
        </h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
          อย่างน้อย 8 ตัวอักษร
        </p>
      </div>

      <form action={action} className="space-y-3 max-w-sm">
        <div className="space-y-1.5">
          <Label htmlFor="password">รหัสผ่านใหม่</Label>
          <Input
            id="password"
            name="password"
            type="password"
            minLength={8}
            required
            autoComplete="new-password"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm">ยืนยันรหัสผ่าน</Label>
          <Input
            id="confirm"
            name="confirm"
            type="password"
            minLength={8}
            required
            autoComplete="new-password"
          />
        </div>

        {state && "error" in state && (
          <p className="text-sm text-rose-600 dark:text-rose-400">{state.error}</p>
        )}
        {state && "ok" in state && (
          <p className="text-sm text-emerald-600 dark:text-emerald-400">
            ✓ เปลี่ยนรหัสผ่านแล้ว
          </p>
        )}

        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "กำลังบันทึก..." : "บันทึก"}
        </Button>
      </form>
    </div>
  );
}
