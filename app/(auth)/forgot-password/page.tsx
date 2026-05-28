"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset } from "@/lib/actions/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState(
    requestPasswordReset,
    undefined,
  );
  // empty error string = success signal from server action
  const sent = state?.error === "";

  return (
    <>
      <header className="mb-6 space-y-1">
        <h1 className="text-2xl font-medium tracking-tight text-zinc-900 dark:text-zinc-50 font-heading">
          ลืมรหัสผ่าน
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          กรอกอีเมลเพื่อรับลิงก์ตั้งรหัสผ่านใหม่
        </p>
      </header>

      {sent ? (
        <div className="space-y-3">
          <p className="text-sm text-emerald-600 dark:text-emerald-400">
            ส่งลิงก์ไปยังอีเมลของคุณแล้ว — ตรวจสอบ Mailpit ที่{" "}
            <a
              href="http://127.0.0.1:54324"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              localhost:54324
            </a>{" "}
            (สำหรับ local dev)
          </p>
        </div>
      ) : (
        <form action={action} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
            />
          </div>

          {state?.error && (
            <p className="text-sm text-rose-600 dark:text-rose-400">
              {state.error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "กำลังส่ง..." : "Send reset link"}
          </Button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
        จำรหัสได้แล้ว?{" "}
        <Link
          href="/login"
          className="font-medium text-zinc-900 dark:text-zinc-100 hover:underline"
        >
          กลับไปเข้าสู่ระบบ
        </Link>
      </p>
    </>
  );
}
