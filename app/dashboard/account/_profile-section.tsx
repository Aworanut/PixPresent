"use client";

import { useActionState, useRef, useState } from "react";
import { PencilSquareIcon, PhoneIcon } from "@heroicons/react/24/outline";
import { Line, Tiktok } from "@thesvg/react";
import { updateProfile } from "@/lib/actions/account";
import { isStoredAvatarUrl } from "@/lib/avatar-url";
import type { TenantProfile } from "@/lib/auth/current-tenant";
import { ImageCropField } from "@/components/image-crop-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ─── Minimal Custom SVG Icons ──────────────────────────────────────────────────

// Instagram keeps a monochrome outline mark — thesvg only ships the full-colour
// gradient logo, which would clash with this card's unified gold treatment.
function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

// Facebook as a filled gold badge with the "f" knocked out (transparent), so the
// letter shows the card background on both light and dark themes. We render only
// thesvg.org's circle silhouette path — dropping its separate solid-"f" path
// turns the letter into a cutout instead of a same-colour fill.
function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 666.667 666.667" fill="currentColor">
      <g transform="matrix(1.33333 0 0 -1.33333 -133.333 800)">
        <path
          d="M0 0c0 138.071-111.929 250-250 250S-500 138.071-500 0c0-117.245 80.715-215.622 189.606-242.638v166.242h-51.552V0h51.552v32.919c0 85.092 38.508 124.532 122.048 124.532 15.838 0 43.167-3.105 54.347-6.211V81.986c-5.901.621-16.149.932-28.882.932-40.993 0-56.832-15.528-56.832-55.9V0h81.659l-14.028-76.396h-67.631v-171.773C-95.927-233.218 0-127.818 0 0"
          transform="translate(600 350)"
        />
      </g>
    </svg>
  );
}

// ─── Studio Name Field with In-place Edit ──────────────────────────────────────

type StudioNameProps = {
  value: string;
  onChange: (val: string) => void;
  fallbackName: string;
};

function StudioNameField({ value, onChange, fallbackName }: StudioNameProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);

  function startEdit() {
    setEditing(true);
    requestAnimationFrame(() => {
      const input = inputRef.current;
      if (!input) return;
      input.focus();
      input.select();
    });
  }

  function stopEdit() {
    setEditing(false);
  }

  return (
    <div className="w-full border-t border-zinc-150 dark:border-zinc-800/60 pt-4">
      <div className="group relative flex justify-center min-w-0 px-1">
        <input
          ref={inputRef}
          id="display_name"
          name="display_name"
          type="text"
          maxLength={120}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={fallbackName || "ชื่อสตูดิโอ"}
          readOnly={!editing}
          onBlur={stopEdit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              inputRef.current?.blur();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              stopEdit();
            }
          }}
          onClick={() => {
            if (!editing) startEdit();
          }}
          className={cn(
            "w-full min-w-0 bg-transparent text-center text-lg font-semibold font-heading text-zinc-950 dark:text-zinc-50 outline-none truncate transition-colors",
            editing
              ? "border-b border-[#D4AF37] pb-0.5 cursor-text"
              : "border-b border-transparent cursor-pointer group-hover:text-[#D4AF37]/90",
          )}
        />
        {!editing && (
          <button
            type="button"
            onClick={startEdit}
            aria-label="แก้ไขชื่อสตูดิโอ"
            className="absolute right-0 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-400 opacity-0 transition-all duration-200 hover:text-[#D4AF37] focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] group-hover:opacity-100 group-focus-within:opacity-100"
          >
            <PencilSquareIcon className="h-4 w-4" strokeWidth={1.5} />
          </button>
        )}
      </div>
    </div>
  );
}

type Props = {
  tenant: TenantProfile;
  email: string;
};

// ─── Main Component ────────────────────────────────────────────────────────────

export function ProfileSection({ tenant, email }: Props) {
  const [state, action, pending] = useActionState(updateProfile, undefined);
  const storedAvatarUrl = isStoredAvatarUrl(tenant.avatar_url)
    ? tenant.avatar_url
    : null;

  // Form states for Live-Preview
  const [firstName, setFirstName] = useState(tenant.first_name ?? "");
  const [lastName, setLastName] = useState(tenant.last_name ?? "");
  const [displayName, setDisplayName] = useState(tenant.display_name ?? tenant.name ?? "");
  const [phone, setPhone] = useState(tenant.phone ?? "");
  const [lineId, setLineId] = useState(tenant.line_id ?? "");
  const [instagram, setInstagram] = useState(tenant.instagram_username ?? "");
  const [facebook, setFacebook] = useState(tenant.facebook_url ?? "");
  const [tiktok, setTiktok] = useState(tenant.tiktok_username ?? "");

  const fallbackName = [firstName, lastName]
    .filter(Boolean)
    .join(" ")
    .trim() || tenant.name;

  return (
    <div className="space-y-8">
      <form action={action} className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <input
          type="hidden"
          name="existing_avatar_url"
          value={storedAvatarUrl ?? ""}
        />

        {/* Left Column - Vertical Business Card Preview */}
        <div className="flex flex-col items-center text-center p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/80 rounded-none shadow-sm h-fit space-y-5 min-w-0 w-full">
          <ImageCropField
            inputName="avatar"
            cropPrefix="avatar_crop"
            aspect={1}
            label="Profile Photo"
            initialUrl={storedAvatarUrl}
            variant="avatar"
            emptyHint="อัปโหลดรูปโปรไฟล์"
          />

          <StudioNameField
            value={displayName}
            onChange={setDisplayName}
            fallbackName={fallbackName}
          />

          {/* Social Links Preview List - Stacked vertically */}
          {(phone || lineId || instagram || facebook || tiktok) && (
            <div className="w-full pt-4 border-t border-zinc-150 dark:border-zinc-800/60 space-y-3 text-left">
              {/* Phone */}
              {phone && (
                <div className="flex items-center gap-2.5 text-xs text-zinc-600 dark:text-zinc-400">
                  <PhoneIcon className="h-4 w-4 stroke-[1.5] text-[#D4AF37] flex-shrink-0" />
                  <span className="font-mono truncate">{phone}</span>
                </div>
              )}
              
              {/* Line ID */}
              {lineId && (
                <div className="flex items-center gap-2.5 text-xs text-zinc-600 dark:text-zinc-400">
                  <Line fill="currentColor" className="h-4 w-4 text-[#D4AF37] flex-shrink-0" />
                  <span className="font-mono truncate">@{lineId.replace(/^@/, "")}</span>
                </div>
              )}
              
              {/* Instagram */}
              {instagram && (
                <div className="flex items-center gap-2.5 text-xs text-zinc-600 dark:text-zinc-400">
                  <InstagramIcon className="h-4 w-4 text-[#D4AF37] flex-shrink-0" />
                  <span className="font-mono truncate">@{instagram.replace(/^@/, "")}</span>
                </div>
              )}
              
              {/* Facebook */}
              {facebook && (
                <div className="flex items-center gap-2.5 text-xs text-zinc-600 dark:text-zinc-400 min-w-0">
                  <FacebookIcon className="h-4 w-4 text-[#D4AF37] flex-shrink-0" />
                  <span className="font-mono truncate" title={facebook}>
                    {facebook.replace(/^https?:\/\/(www\.)?facebook\.com\//, "")}
                  </span>
                </div>
              )}
              
              {/* TikTok */}
              {tiktok && (
                <div className="flex items-center gap-2.5 text-xs text-zinc-600 dark:text-zinc-400">
                  <Tiktok fill="currentColor" className="h-4 w-4 text-[#D4AF37] flex-shrink-0" />
                  <span className="font-mono truncate">@{tiktok.replace(/^@/, "")}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column - Form Fields (2/3 width on md) */}
        <div className="md:col-span-2 space-y-6">
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
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full"
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
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="phone">เบอร์โทรศัพท์</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              maxLength={30}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0812345678"
              className="w-full"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="line_id">Line ID</Label>
            <Input
              id="line_id"
              name="line_id"
              type="text"
              maxLength={80}
              value={lineId}
              onChange={(e) => setLineId(e.target.value)}
              placeholder="@yourstudio"
              className="w-full font-mono text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="instagram_username">Instagram Account</Label>
            <Input
              id="instagram_username"
              name="instagram_username"
              type="text"
              maxLength={80}
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
              placeholder="yourstudio.weddings"
              className="w-full font-mono text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="facebook_url">Facebook Page URL</Label>
            <Input
              id="facebook_url"
              name="facebook_url"
              type="url"
              maxLength={200}
              value={facebook}
              onChange={(e) => setFacebook(e.target.value)}
              placeholder="https://facebook.com/yourstudio"
              className="w-full font-mono text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tiktok_username">TikTok Account</Label>
            <Input
              id="tiktok_username"
              name="tiktok_username"
              type="text"
              maxLength={80}
              value={tiktok}
              onChange={(e) => setTiktok(e.target.value)}
              placeholder="yourstudio.tiktok"
              className="w-full font-mono text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bio">คำแนะนำตัว / Studio Bio</Label>
            <textarea
              id="bio"
              name="bio"
              maxLength={500}
              defaultValue={tenant.bio ?? ""}
              placeholder="บริการถ่ายภาพงานแต่งงาน งานอีเวนต์ แนว Minimalist Editorial..."
              rows={4}
              className="flex w-full rounded-none border border-zinc-200 bg-white px-3 py-2 text-xs font-sans ring-offset-white placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:placeholder:text-zinc-600 dark:focus-visible:ring-[#D4AF37] text-zinc-900 dark:text-zinc-50"
            />
          </div>

          <div className="space-y-1.5 border-t border-zinc-150 dark:border-zinc-800/60 pt-4">
            <Label className="text-zinc-500 dark:text-zinc-400">Email</Label>
            <p className="text-sm text-zinc-700 dark:text-zinc-300 py-1 font-mono">
              {email}
            </p>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 opacity-65">
              เปลี่ยนอีเมลผ่าน Supabase dashboard
            </p>
          </div>

          {state && "error" in state && (
            <p className="text-sm text-rose-600 dark:text-rose-400">{state.error}</p>
          )}
          {state && "ok" in state && (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">
              บันทึกเรียบร้อยแล้ว
            </p>
          )}

          <div className="pt-2 flex justify-end">
            <Button type="submit" size="sm" disabled={pending} className="w-full sm:w-auto">
              {pending ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
