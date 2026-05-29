"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { CameraIcon } from "@heroicons/react/24/outline";
import { updateProfile } from "@/lib/actions/account";
import type { TenantProfile } from "@/lib/auth/current-tenant";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type Props = {
  tenant: TenantProfile;
  email: string;
};

export function ProfileSection({ tenant, email }: Props) {
  const [state, action, pending] = useActionState(updateProfile, undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    tenant.avatar_url,
  );
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (objectUrl) URL.revokeObjectURL(objectUrl);
    const nextObjectUrl = URL.createObjectURL(file);
    setObjectUrl(nextObjectUrl);
    setPreviewUrl(nextObjectUrl);
  }

  const initials =
    `${(tenant.first_name ?? tenant.name).charAt(0)}${(tenant.last_name ?? "").charAt(0)}`.toUpperCase() ||
    tenant.name.charAt(0).toUpperCase();

  return (
    <div className="space-y-8">
      <form action={action} className="space-y-6">
        <input
          type="hidden"
          name="existing_avatar_url"
          value={tenant.avatar_url ?? ""}
        />

        <div className="flex flex-col items-start gap-3 pb-2 border-b border-zinc-100 dark:border-zinc-800/60 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-none border border-[#D4AF37]/50 bg-white dark:bg-zinc-900 shadow-sm transition-all duration-500 hover:border-[#D4AF37] hover:shadow-[0_0_10px_rgba(212,175,55,0.2)]"
            aria-label="เลือกรูปโปรไฟล์"
          >
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt="รูปโปรไฟล์"
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-xl font-bold font-mono text-[#D4AF37]">
                {initials}
              </span>
            )}
            <span className="absolute inset-0 flex items-center justify-center bg-zinc-900/0 opacity-0 transition-all duration-300 group-hover:bg-zinc-900/40 group-hover:opacity-100">
              <CameraIcon className="h-5 w-5 text-white" />
            </span>
          </button>
          <div className="space-y-0.5">
            <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-50 font-mono tracking-widest uppercase">
              Profile Photo
            </h3>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 opacity-60 max-w-sm leading-relaxed">
              แตะเพื่อเปลี่ยนรูป — ระบบจะบีบอัดให้พอดีอัตโนมัติ
            </p>
          </div>
          <input
            ref={fileInputRef}
            id="avatar"
            name="avatar"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            onChange={handleAvatarChange}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="first_name">
              ชื่อ <span className="text-[#D4AF37]">*</span>
            </Label>
            <Input
              id="first_name"
              name="first_name"
              type="text"
              autoComplete="given-name"
              required
              maxLength={80}
              defaultValue={tenant.first_name ?? ""}
              className="max-w-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="last_name">
              นามสกุล <span className="text-[#D4AF37]">*</span>
            </Label>
            <Input
              id="last_name"
              name="last_name"
              type="text"
              autoComplete="family-name"
              required
              maxLength={80}
              defaultValue={tenant.last_name ?? ""}
              className="max-w-sm"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="display_name">Display name</Label>
          <Input
            id="display_name"
            name="display_name"
            type="text"
            autoComplete="nickname"
            maxLength={120}
            defaultValue={tenant.display_name ?? ""}
            placeholder="ชื่อที่แสดงบนแดชบอร์ด"
            className="max-w-sm"
          />
          <p className="text-xs text-zinc-400 dark:text-zinc-500 opacity-60">
            ถ้าไม่กรอก จะใช้ชื่อ + นามสกุล
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="phone">เบอร์โทรศัพท์</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            maxLength={30}
            defaultValue={tenant.phone ?? ""}
            placeholder="0812345678"
            className="max-w-sm"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-zinc-500 dark:text-zinc-400">Email</Label>
          <p className="text-sm text-zinc-700 dark:text-zinc-300 py-2">
            {email}
          </p>
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            เปลี่ยนอีเมลผ่าน Supabase dashboard
          </p>
        </div>

        {state && "error" in state && (
          <p className="text-sm text-rose-600 dark:text-rose-400">{state.error}</p>
        )}
        {state && "ok" in state && (
          <p className="text-sm text-emerald-600 dark:text-emerald-400">
            บันทึกแล้ว
          </p>
        )}

        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "กำลังบันทึก..." : "บันทึก"}
        </Button>
      </form>
    </div>
  );
}
