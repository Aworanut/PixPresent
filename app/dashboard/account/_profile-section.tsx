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
      <form action={action} className="space-y-5">
        <div className="space-y-4">
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
