"use client";

import { useActionState } from "react";
import { updatePassword } from "@/lib/actions/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function ResetPasswordPage() {
  const [state, action, pending] = useActionState(updatePassword, undefined);

  return (
    <>
      <header className="mb-6 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          ตั้งรหัสผ่านใหม่
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          กรอกรหัสผ่านใหม่สำหรับบัญชีของคุณ
        </p>
      </header>

      <form action={action} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="อย่างน้อย 8 ตัวอักษร"
          />
        </div>

        {state?.error && (
          <p className="text-sm text-rose-600 dark:text-rose-400">
            {state.error}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "กำลังบันทึก..." : "Update password"}
        </Button>
      </form>
    </>
  );
}
