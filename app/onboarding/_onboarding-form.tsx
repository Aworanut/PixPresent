"use client";

import { useActionState } from "react";
import { completeOnboarding } from "@/lib/actions/onboarding";
import { isStoredAvatarUrl } from "@/lib/avatar-url";
import { ImageCropField } from "@/components/image-crop-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { OnboardingDefaults } from "@/lib/auth/onboarding";

type Props = {
  defaults: OnboardingDefaults;
};

export function OnboardingForm({ defaults }: Props) {
  const [state, action, pending] = useActionState(completeOnboarding, undefined);
  const storedAvatarUrl = isStoredAvatarUrl(defaults.avatarUrl)
    ? defaults.avatarUrl
    : null;

  return (
    <form action={action} className="space-y-6">
      <input
        type="hidden"
        name="existing_avatar_url"
        value={storedAvatarUrl ?? ""}
      />

      <ImageCropField
        inputName="avatar"
        cropPrefix="avatar_crop"
        aspect={1}
        label="Profile Photo"
        initialUrl={storedAvatarUrl}
        variant="avatar"
        emptyHint="แตะเพื่ออัปโหลด — JPG, PNG, WEBP, GIF"
      />

      <div className="grid grid-cols-2 gap-4">
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
            defaultValue={defaults.firstName}
            placeholder="สมชาย"
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
            defaultValue={defaults.lastName}
            placeholder="ใจดี"
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
          defaultValue={defaults.displayName}
          placeholder="ชื่อที่แสดงบนแดชบอร์ด"
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
          placeholder="0812345678"
        />
      </div>

      {state?.error && (
        <p className="text-sm text-rose-600 dark:text-rose-400">{state.error}</p>
      )}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "กำลังบันทึก..." : "Complete profile"}
      </Button>
    </form>
  );
}
