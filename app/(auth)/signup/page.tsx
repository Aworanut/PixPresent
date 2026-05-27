"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signUp } from "@/lib/actions/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function SignupPage() {
  const [state, action, pending] = useActionState(signUp, undefined);

  return (
    <>
      <header className="mb-6 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          สร้างบัญชี Organizer
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          เริ่มจัดการ event แรกในไม่กี่นาที
        </p>
      </header>

      <form action={action} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="organization_name">ชื่อองค์กร / สตูดิโอ</Label>
          <Input
            id="organization_name"
            name="organization_name"
            type="text"
            autoComplete="organization"
            required
            placeholder="Acme Studio"
          />
        </div>

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
          <Label htmlFor="password">Password</Label>
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
          {pending ? "กำลังสร้างบัญชี..." : "Create account"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
        มีบัญชีอยู่แล้ว?{" "}
        <Link
          href="/login"
          className="font-medium text-zinc-900 dark:text-zinc-100 hover:underline"
        >
          เข้าสู่ระบบ
        </Link>
      </p>
    </>
  );
}
