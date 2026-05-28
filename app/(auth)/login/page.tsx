"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn } from "@/lib/actions/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const [state, action, pending] = useActionState(signIn, undefined);

  return (
    <>
      <header className="mb-6 space-y-1">
        <h1 className="text-2xl font-medium tracking-tight text-zinc-900 dark:text-zinc-50 font-heading">
          Welcome back
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          เข้าสู่ระบบเพื่อจัดการ event
        </p>
      </header>

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

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              href="/forgot-password"
              className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              ลืมรหัสผ่าน?
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            minLength={8}
          />
        </div>

        {state?.error && (
          <p className="text-sm text-rose-600 dark:text-rose-400">
            {state.error}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "กำลังเข้าสู่ระบบ..." : "Sign in"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
        ยังไม่มีบัญชี?{" "}
        <Link
          href="/signup"
          className="font-medium text-zinc-900 dark:text-zinc-100 hover:underline"
        >
          สมัครใช้งาน
        </Link>
      </p>
    </>
  );
}
