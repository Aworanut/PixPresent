# FaceFind — Issues

Vertical slices (tracer bullets) แตกจาก [facefind_spec.html](facefind_spec.html) (PRD v1.2).

**Conventions**
- `AFK` = ทำได้เลย ไม่ต้อง decision จากคน
- `HITL` = ต้องการ human input (decision / setup / review)
- `F-xx` = Feature ID จาก §5 ของสเปค
- `Q#` = Open Question จาก §13

---

## Phase 1 — MVP

### #1 — Local Dev Bootstrap

**Type:** AFK

**What to build**

ตั้ง Next.js project ใหม่พร้อม Supabase local stack (CLI + Docker) ให้ dev ทำงานบนเครื่องตัวเองได้ทั้งหมด ไม่ต้องพึ่ง Supabase cloud (เพราะ free tier เต็ม — รอ migrate ตอน production ที่ #17). ต้องมี dev script ที่รัน Supabase local + Next.js dev server พร้อมกัน, และ README ที่ engineer คนใหม่อ่านแล้วรันได้ภายใน 10 นาที.

**Acceptance criteria**
- [x] รัน `supabase start` แล้วได้ local Postgres + Studio + Auth บน Docker
- [x] Next.js app เชื่อมกับ local Supabase ได้ (env vars แยก local/cloud)
- [x] มี npm script เดียวที่รัน Supabase + Next.js dev พร้อมกัน
- [x] README อธิบาย prerequisites (Docker Desktop, Supabase CLI), `supabase start`, `npm run dev`, การ reset DB
- [x] เพิ่ม `.env.example` ที่ครอบ keys ทั้งหมด (AWS, R2, Drive, Omise placeholder)

**Blocked by:** None - can start immediately

---

### #2 — External Service Setup

**Type:** HITL

**What to build**

สมัครและตั้งค่า external services ทั้งหมดที่ Phase 1 ต้องใช้ + เก็บ credentials ใน `.env.local` (ห้าม commit). งานนี้ HITL เพราะคนต้องไปสมัคร account จริง ยืนยัน billing, generate API keys, และ config IAM permissions. **Omise ตัดออกจาก Phase 1 — ใช้ slip + credit แทน (ดู #13)**

**Acceptance criteria**
- [x] AWS account + IAM user สำหรับ Rekognition + R2 (least-privilege policy)
- [x] Cloudflare R2 bucket สร้างแล้ว + API token + custom domain (optional)
- [x] Google Cloud project + OAuth 2.0 credentials สำหรับ Drive API (scope: `drive.readonly`)
- [x] บัญชีธนาคาร / PromptPay ของ FaceFind สำหรับรับโอน + QR code static (ใช้ใน slip topup flow #13)
- [x] เพิ่ม keys ทั้งหมดเข้า `.env.local` ตาม `.env.example`
- [x] เอกสารบันทึก console URL ของแต่ละ service สำหรับทีม

**Blocked by:** None - can start immediately

---

### #3 — Database Schema + RLS Migration

**Type:** AFK

**What to build**

Supabase migration ตัวแรกที่สร้าง schema ทั้งหมดของ Phase 1 + nullable columns ที่เตรียมไว้สำหรับ Phase 2 (ตาม §11, §11.4, §12.4) เพื่อไม่ต้อง migrate ใหญ่ในอนาคต. รวม Row-Level Security policies ที่แยก tenant data ขาดจากกัน.

**Acceptance criteria**
- [x] ตาราง Phase 1 core: `tenants`, `events`, `event_storage_folders`, `photos`, `face_blacklist`, `guest_sessions` (หมายเหตุ: `photographers` ถูกตัดออก → ใช้ `event_storage_folders` แทน ดู #5)
- [x] ตาราง Phase 1 (credit system): `slip_uploads`, `credit_ledger` (ดู #13 สำหรับ schema detail)
- [x] เพิ่ม column: `tenants.credit_balance INT default 0`, `events.activated_at TIMESTAMPTZ null`, `events.credits_used INT default 0`
- [x] เพิ่ม column: `tenants.phone TEXT null` — เบอร์โทรสำหรับติดต่อ/การตลาด (optional)
- [x] Phase 2 nullable columns ใน `photos`, `events`, `guest_sessions`, `tenants` ตาม §11 + §11.4 (price, watermark_url, commerce_enabled, reel_quota, highlight_reel_* ฯลฯ) — เก็บไว้รอ Phase 2 commerce/highlight reel
- [ ] **Defer ไป Phase 2:** `payments` table + subscription columns (ใช้เมื่อย้ายไป Omise — ดู #B-04)
- [x] RLS policies: organizer เห็นเฉพาะ data ของ tenant ตัวเอง, guest session อ่าน photos ของ event ที่ session ผูกอยู่ + active เท่านั้น, super admin role bypass RLS สำหรับ slip verification
- [x] Migration รันบน local stack สำเร็จด้วย `supabase db reset`
- [x] TypeScript types generate จาก schema (`supabase gen types typescript`)

**Blocked by:** #1

---

### #4 — Organizer Auth + Tenant Provisioning

**Type:** AFK
**Feature:** F-01

**What to build**

End-to-end signup → auto-create tenant row → login → session ที่ persist ข้าม browser restart ตาม F-01. ใช้ Supabase Auth (Email + Password) + password reset flow. ต้องมี middleware ที่ guard protected routes.

**Acceptance criteria**
- [x] หน้า signup รับ email + password + organization name → สร้าง auth user + tenant row (plan='free') + link กัน
- [x] หน้า login + logout
- [x] Password reset flow ผ่าน Supabase email
- [x] Session คงอยู่หลังปิด/เปิด browser
- [x] Middleware redirect ไป /login ถ้าเข้าหน้า dashboard โดยไม่ login
- [x] หน้า dashboard เปล่าๆ ที่แสดงชื่อ tenant ของ user

**Blocked by:** #3

---

### #5 — Event CRUD + Multi-Folder

**Type:** AFK
**Feature:** F-02

**What to build**

หน้าจัดการ event ใน Organizer Dashboard: สร้าง / รายการ / แก้ไข / soft-delete. **Event ผูกกับ Google Drive folder ได้หลายอัน** (เช่น ทีมหลัก, ทีม Drone, ทีม Video) ผ่านตาราง `event_storage_folders` (label + folder_id). ตอนลบ event ต้อง cleanup Rekognition Collection (เรียก DeleteCollection). Storage provider ใน Phase 1 มี Google Drive + **Dropbox** (Dropbox ดึงเข้า Phase 1 แล้ว — ดู #20 + ADR 0003; Local upload ยังอยู่ Phase 2).

> **Note:** สเปคเดิมแยก sub-folder ต่อช่างภาพและมี `photographers` table — pivot แล้วเพราะ workflow จริงคือ organizer สร้าง folder กลางแล้ว share editor ให้ช่างทุกคน upload ตรง. Attribution ของช่างภาพมาจาก EXIF metadata + manual input บน commerce report ก็เพียงพอ. ตาราง `photographers` ถูกลบทิ้งใน migration `20260527134211_storage_folders_refactor`.

**Acceptance criteria**
- [x] Form สร้าง event: name, event_date, multi-folder rows (label + URL/ID, paste URL ของ Drive → extract folder ID อัตโนมัติ)
- [x] รายการ event แสดง status (not synced / synced) — link_active เพิ่มตอน #9
- [x] แก้ไข event ได้ — แสดง folder ทั้งหมด, เพิ่ม/ลบ/แก้ label ได้
- [x] Soft-delete (ตั้ง flag, ไม่ลบ physical row) + เรียก Rekognition DeleteCollection
- [x] RLS verify: organizer คนอื่นเข้า event นี้ไม่ได้

**Blocked by:** #4

---

### ~~#6 — Photographer Management~~ (ตัดออก)

ตัดออกจาก Phase 1 — replaced โดย multi-folder ใน #5. Attribution ทำผ่าน EXIF metadata หรือกรอกใน commerce report ตอน Phase 2.

---

### #7 — Sync & Index End-to-End

**Type:** AFK
**Feature:** F-04

**What to build**

Tracer bullet หลักของระบบ — ปุ่ม "Sync & Index" ใน event detail ที่ดึงรูปจาก **ทุก folder ของ event** (`event_storage_folders` rows) → upload ไป R2 (web-optimized + full resolution) → ส่งไป Rekognition index → บันทึก face_ids ลง DB. ใช้ background job + batch processing + exponential backoff สำหรับ Drive API rate limit (HTTP 429), retry สูงสุด 3 ครั้ง. ต้องมี progress bar ที่ไม่ block UI. รองรับ re-sync (process เฉพาะรูปใหม่).

OAuth flow: organizer connect Google account ครั้งเดียว → ทุก folder ต้องอยู่ใน Drive ของ organizer หรือ shared editor access.

**Acceptance criteria**
- [x] Organizer connect Google account ผ่าน OAuth → เก็บ refresh token ปลอดภัย — `/auth/google` + `/auth/google/callback` routes พร้อม
- [x] ปุ่ม Sync & Index ใน event page เริ่ม SSE stream (ไม่ block UI) — `_sync-button.tsx` + `/api/events/[id]/sync` route
- [x] Scan ทุก folder ใน `event_storage_folders` → list รูปที่ยังไม่ได้ index — `listImagesInFolder()` + `storage_file_id` dedup
- [x] Resize เป็น web-optimized (JPEG 85%, max 1920px) + full → upload ไป R2 path `/events/{id}/web/` และ `/events/{id}/full/` — `processImage()` + `uploadToR2()`
- [x] เรียก Rekognition IndexFaces → เก็บ face_ids ลง `photos.rekognition_face_ids` — code ready, requires #2 AWS creds
- [x] Batch processing + exponential backoff สำหรับ Drive 429 — `withRetry()` helper
- [x] Progress UI: แสดงจำนวนรูปที่ประมวลผลแล้ว / ทั้งหมด + progress bar — `_sync-button.tsx`
- [x] Re-sync: ข้ามรูปที่ index แล้ว (เช็คจาก storage_file_id) — dedup query in sync route
- [x] รองรับ 1,000 รูปต่อ event โดยไม่ timeout (NFR §8.1) — verified

**Blocked by:** #5, #2

---

### #8 — Blacklist Manager

**Type:** AFK
**Feature:** F-05

**What to build**

UI ให้ organizer เลือกรูปทีละใบ → ระบบวาด bounding box รอบใบหน้าทุกคนในรูป → คลิกใบหน้าเพื่อบล็อก (เพิ่ม face_id ใน face_blacklist). มีหน้ารายการ blacklist ทั้งหมด + ปลดบล็อกได้. Blacklist ทำงานที่ DB layer (filter query) เลยไม่ต้อง re-index ตอน unblock.

**Acceptance criteria**
- [x] หน้า viewer แสดงรูปจาก event พร้อม bounding box จาก Rekognition (ใช้ face_id + bounding box data)
- [x] คลิก bounding box → เพิ่ม row ใน `face_blacklist` (face_id + note optional)
- [x] หน้ารายการ blacklist ทั้งหมดของ event + ปุ่ม unblock
- [x] Unblock = delete row, ไม่ต้องเรียก Rekognition
- [x] Verify: ผลของ block/unblock มีผลทันทีกับ guest search ครั้งถัดไป — verified (smoke test)

**Blocked by:** #7

---

### #9 — Guest Link Generation

**Type:** AFK
**Feature:** F-06

**What to build**

หน้าใน event detail ให้ organizer generate token-based guest link (`facefind.app/e/{token}`) พร้อมตั้งอายุ (default 7 วัน). revoke + regenerate ได้. copy ไป clipboard ได้.

**Acceptance criteria**
- [x] ปุ่ม Generate Link → สร้าง token UUID เก็บใน event (หรือตาราง guest_link แยกถ้าจำเป็น) + แสดง URL
- [x] ปรับอายุ link ได้ (default 7 วัน) → คำนวณ expires_at
- [x] แสดงสถานะ Active / Expired
- [x] ปุ่ม Revoke (set expires_at เป็นอดีต) + ปุ่ม Regenerate
- [x] ปุ่ม Copy → clipboard

**Blocked by:** #5

---

### #10 — Guest Landing + Face Search

**Type:** AFK
**Features:** F-07, F-08

**What to build**

หน้า public ที่ guest เปิดผ่าน link: แสดง event name + branding + ปุ่มอัพ selfie. รับรูปจาก camera roll หรือถ่ายสด (mobile). ใช้ Largest Face strategy + 80% threshold. กรอง face_id ใน blacklist ออกก่อน return. สร้าง guest_session row + เก็บ matched_photo_ids. แสดงข้อความเหมาะสมเมื่อไม่พบรูปหรือ link หมดอายุ.

**Acceptance criteria**
- [x] Validate token จาก URL → ถ้า expired แสดง message + ไม่ให้ search
- [x] Landing page: event name, branding, ปุ่ม "ค้นหารูปของคุณ"
- [x] Selfie upload รองรับ camera roll + camera capture (mobile) — `input accept="image/*" capture="user"`
- [x] Validate selfie มีใบหน้า ≥ 1 → ถ้าหลายใบเลือก Largest Face — code ready, Rekognition stub when no creds
- [x] เรียก Rekognition SearchFacesByImage ด้วย threshold 80% — code ready, stubs when no AWS creds (รอ #7 set `rekognition_collection_id`)
- [x] Filter face_id ที่อยู่ใน blacklist ออกจาก match — code ready (รอ #8 มีข้อมูล)
- [x] สร้าง `guest_sessions` row + เก็บ selfie ใน R2 + matched_photo_ids — session insert done; R2 selfie key = stub รอ #7
- [x] Loading state ~2-5 วินาที
- [x] Empty state: "ไม่พบรูปของคุณในงานนี้"
- [x] Latency ≤ 5 วินาที สำหรับ event 1,000 รูป (NFR §8.1) — verified

**Blocked by:** #9, #8

---

### #11 — Photo Gallery + Download

**Type:** AFK
**Feature:** F-09

**What to build**

หลัง search สำเร็จ guest เห็น gallery รูปที่ match แบบ grid (responsive). คลิกดู full preview. ดาวน์โหลดรูปเดี่ยว (web หรือ full) หรือ ZIP ทั้งหมด (web-optimized). Session ผูกกับ browser ปัจจุบัน (เปลี่ยนเครื่อง = upload ใหม่ — shareable link ไป Phase 2). R2 URL serve ตรงผ่าน CDN ไม่ผ่าน Next.js server (§6).

**Acceptance criteria**
- [x] Grid layout แสดงรูป web-optimized จาก R2 (responsive)
- [x] คลิกรูป → full-size preview overlay (lightbox + keyboard nav)
- [x] ปุ่ม Download บนแต่ละรูป (via ZIP single-photo)
- [x] ปุ่ม Download all → ZIP (web-optimized) generate ใน server (`/api/download/zip`)
- [ ] Session persist ใน localStorage จนกว่า link จะหมดอายุ — defer Phase 2
- [x] Gallery load ≤ 2 วินาที (NFR §8.1) — verified

**Blocked by:** #10

---

### #12 — Credit Package Pricing

**Type:** AFK ✅ (decisions resolved 2026-05-28)
**Related:** Q4, Q5
**Spec:** [docs/superpowers/specs/2026-05-28-plan-tier-design.md](docs/superpowers/specs/2026-05-28-plan-tier-design.md)

**Decisions made**

- **1 credit = 1 THB** — transparent, ลูกค้าเข้าใจทันที
- **Tier อยู่ที่ระดับ event** (ไม่ใช่ tenant) — แต่ละงานเลือก tier อิสระ
- **3 tiers:** Starter (199) / Gallery (499) / Studio (999) credits
- **Welcome bonus:** 199 credits ฟรีตอน signup
- **No permanent free tier** — ทุก event จ่าย credit

| | Starter | Gallery | Studio |
|---|---|---|---|
| Storage | 5 GB | 20 GB | 50 GB |
| Link active | 3 วัน | 5 วัน | 7 วัน |
| Data retention | 7 วัน | 14 วัน | 30 วัน |
| Highlight reel | — | — | ✓ |
| **Credit cost** | **199** | **499** | **999** |

**Acceptance criteria**
- [x] ตัดสินใจ tier model (per-event, Starter/Gallery/Studio)
- [x] Credit cost ต่อ tier (199/499/999)
- [x] Welcome bonus (199 credits)
- [x] เขียน config `lib/credit-packages.ts` (tier limits + costs)
- [x] เพิ่ม migration: `events.tier`, `events.storage_limit_gb`, `events.link_active_days`, `events.data_retention_days`
- [x] Welcome bonus trigger ใน signup flow (#4)
- [x] บัญชีรับโอน + PromptPay QR เตรียมพร้อม (ผูกกับ #2)
- [ ] อัพเดท Q4 + Q5 ใน facefind_spec.html เป็น resolved

**Blocked by:** None - can start immediately

---

### #13 — Slip Upload + Credit Ledger

**Type:** AFK

**What to build**

ระบบ Manual Payment + Credit ที่ทดแทน payment gateway ใน Phase 1 (Omise ย้ายไป #B-04 Phase 2)

**Schema (ทำเสร็จใน #3 แต่ detail อยู่ที่นี่):**
```
slip_uploads
  id UUID PK
  tenant_id UUID FK
  package_id TEXT       -- 'starter' | 'standard' | 'pro' | 'custom'
  amount_thb NUMERIC    -- จำนวนเงินที่ organizer claim ว่าโอน
  credits_claimed INT   -- credit ที่จะได้ตาม package/custom
  slip_image_url TEXT   -- R2 URL ของรูป slip
  status TEXT           -- 'pending' | 'approved' | 'rejected'
  reject_reason TEXT
  uploaded_at TIMESTAMPTZ
  verified_at TIMESTAMPTZ
  verified_by UUID      -- super admin user id

credit_ledger          -- audit trail ของทุก credit movement
  id UUID PK
  tenant_id UUID FK
  delta INT             -- signed: +500 (topup) | -10 (activate event)
  balance_after INT     -- snapshot หลัง apply
  reason TEXT           -- 'topup_slip' | 'activate_event' | 'refund' | 'adjustment'
  ref_id UUID           -- slip_uploads.id หรือ events.id
  note TEXT
  created_at TIMESTAMPTZ
```

**Flow:**

1. **Organizer Top-up:**
   - เลือก preset package หรือใส่ custom amount
   - ระบบแสดง PromptPay QR + บัญชีธนาคาร + จำนวนเงิน
   - Organizer โอน → กลับมาแนบ slip image → submit
   - สร้าง row `slip_uploads` (status=pending) + upload slip ไป R2
   - Super Admin notify (อย่างน้อย email; LINE/Slack เป็น optional)

2. **Approval (จาก #19 Super Admin Panel):**
   - Admin approve → ทำ atomic transaction:
     - `slip_uploads.status = approved`
     - INSERT `credit_ledger` row (delta = +credits_claimed)
     - UPDATE `tenants.credit_balance += credits_claimed`
   - Admin reject → status=rejected + reject_reason (notify organizer)

3. **Event Activation:**
   - Organizer กด "Activate" บน event (status=draft)
   - ถ้า `credit_balance >= cost_per_event` → atomic:
     - `events.activated_at = now()`, `credits_used = cost`
     - INSERT `credit_ledger` row (delta = -cost)
     - UPDATE `tenants.credit_balance -= cost`
   - ถ้า credit ไม่พอ → redirect ไปหน้า top-up

**Decisions (2026-05-28):**
- ใช้ **SlipOK API** auto-verify slip แทน manual admin approval — ~1 บาท/slip, ไม่ต้อง merchant account
- Slip verify ผ่าน SlipOK → auto-approve + credit เพิ่มทันที (ไม่รอ admin)
- Admin ยังเห็น slip history ใน #19 แต่ไม่ต้อง manual approve แต่ละ slip
- Top-up packages: **199 / 499 / 999 / custom** (align กับ event tier)
- Payment info: KBank, นาย วรณัฐ อัครปรีดี, 070-8-10350-0, QR ไฟล์ `public/images/payment-qr.jpeg`
- Admin notification email: woranut.ak@gmail.com
- Customer notification: email organizer เมื่อ top-up success / rejected

**Acceptance criteria**
- [x] `lib/payment-config.ts` — bank info, top-up packages, QR image path
- [x] Slip upload endpoint รับ multipart + เก็บ slip ใน R2 path `/slips/{tenant_id}/{slip_id}.jpg`
- [x] เรียก SlipOK API verify slip → ถ้าผ่าน auto-approve + credit ledger insert (atomic)
- [x] Fallback: ถ้า SlipOK ไม่ available → slip status = pending รอ manual admin (ใน #19)
- [x] Atomic transaction approve + credit balance update (Postgres RPC)
- [x] Credit ledger immutable (append-only — ไม่ allow update/delete ผ่าน RLS)
- [x] API ดึง credit balance ปัจจุบัน + ledger history
- [x] Email admin เมื่อมี slip pending (fallback กรณี SlipOK fail) — ใช้ SUPER_ADMIN_EMAILS
- [x] Email organizer เมื่อ top-up approved / rejected (ใช้ Resend)
- [x] Unit tests: double top-up, SlipOK verify fail, credit ไม่พอตอนสร้าง event
- [x] Integration test: signup → topup → SlipOK verify → credit เพิ่ม → สร้าง event — verified (smoke test)

**Blocked by:** #4, #12

---

### #14 — Credit Balance UI + Event Activation

**Type:** AFK

**What to build**

UI ฝั่ง Organizer สำหรับระบบ credit:

1. **Top-bar credit indicator** — แสดง credit_balance ปัจจุบันทุกหน้า + ปุ่ม "Top-up"
2. **Top-up page** (`/billing/topup`):
   - Hybrid: preset packages (3-4 cards) + tab "Custom amount"
   - เลือก/กรอก amount → แสดง PromptPay QR + เลขบัญชี + จำนวนเงิน (copyable)
   - อัพ slip + submit → status pending + คำแนะนำว่า admin จะ verify ภายใน X ชม.
3. **Credit history page** (`/billing/history`):
   - Ledger entries (topup, deduct, refund) + filter
   - Slip status (pending/approved/rejected พร้อม reason)
4. **Event credit flow** (decisions resolved 2026-05-28):
   - **หักตอนสร้าง event** — organizer เลือก tier → confirm → หัก credit ทันที (ไม่มี "Activate" แยก)
   - ถ้า credit ไม่พอตอนสร้าง → block + redirect ไป top-up page
   - **Delete policy:** ลบได้เฉพาะก่อน Import ครั้งแรก → **auto-refund เต็มจำนวน ทันที** (no admin approve)
   - ลบหลัง Import แล้ว → ไม่คืน credit (Rekognition cost เกิดแล้ว)
   - Tier upgrade mid-event → Phase 2 (#B-08)

**Acceptance criteria**
- [x] Credit indicator แสดงทุก authenticated page
- [x] Top-up: preset + custom + QR + bank info + slip upload
- [x] Credit history แสดง ledger + slip status
- [x] หักเครดิตตอนสร้าง event (atomic: credit deduct + event insert)
- [x] ถ้า credit ไม่พอ → block create + redirect top-up
- [x] Delete ก่อน Import → auto-refund + delete event (atomic)
- [x] Delete หลัง Import → confirm dialog แจ้ง "ไม่สามารถคืนเครดิตได้" (`_delete-button.tsx` ตรวจ `hasStartedSync`)
- [x] Real-time update — revalidatePath ใน server action เพียงพอ; SlipOK auto-approve ทำให้ balance อัพเดตทันที
- [x] Mobile responsive — verified ผ่าน

**Blocked by:** #13

---

### #15 — PDPA Consent Notice (Guest)

**Type:** HITL
**Related:** Q6

**What to build**

Decision + implementation: ก่อน guest อัพ selfie ต้องมี consent gate ที่บอกชัดว่า:
- รูปจะถูกส่งไป AWS Rekognition (US/SG region)
- เก็บ selfie ชั่วคราว ลบหลัง session expire
- ไม่มีการเก็บข้อมูล biometric เพื่อ marketing

ต้องได้ legal review ของข้อความ + checkbox required ก่อน enable face search button.

**Acceptance criteria**
- [ ] Legal review approve consent copy ภาษาไทย + อังกฤษ (HITL)
- [x] Modal/section บนหน้า guest ก่อน selfie upload — consent step ใน `_face-search.tsx`
- [x] Checkbox required → ไม่ติ๊กกดอัพไม่ได้ (`disabled={!consentChecked}`)
- [x] บันทึก consent timestamp ใน guest_sessions (`consent_at` column)
- [ ] อัพเดท Q6 ใน facefind_spec.html เป็น resolved

**Blocked by:** #10

---

### #16 — Rekognition Collection Cleanup Policy

**Type:** AFK ✅ (decision resolved — ผูกกับ `data_retention_days` ของ tier)
**Related:** Q7

**What to build**

Policy ถูก resolve แล้วโดย #12 tier decision: ลบ Rekognition Collection เมื่อ `activated_at + data_retention_days + 7 วัน (grace period) < now()`

- **Data retention** (guest เข้าดูรูปได้): Starter 7 / Gallery 14 / Studio 30 วัน
- **Grace period** +7 วัน: buffer ให้ admin restore event ได้กรณีฉุกเฉิน
- หลังจากนั้น face embeddings ถูกลบถาวร — ต้อง re-sync ถ้าจะ reactivate

| Tier | Retention | Grace | ลบ collection หลัง activate |
|---|---|---|---|
| Starter | 7 วัน | +7 วัน | 14 วัน |
| Gallery | 14 วัน | +7 วัน | 21 วัน |
| Studio | 30 วัน | +7 วัน | 37 วัน |

**Implementation:**

```
Cron job รายวัน (เวลา 02:00 TH):
  SELECT id, rekognition_collection_id FROM events
  WHERE activated_at + (data_retention_days || ' days')::interval
                      + interval '7 days' < now()
    AND rekognition_collection_id IS NOT NULL
    AND deleted_at IS NULL

  → เรียก Rekognition DeleteCollection(rekognition_collection_id)
  → UPDATE events SET rekognition_collection_id = NULL
```

**Acceptance criteria**
- [x] Cron route `app/api/cron/cleanup-collections/route.ts` (Vercel cron) — schedule 02:00 TH ใน `vercel.json`
  - Query events ที่ `activated_at + data_retention_days` ผ่านแล้ว + ยังมี collection
  - เรียก `rekognition.deleteCollection()` ต่อ event
  - Set `rekognition_collection_id = NULL` หลังลบสำเร็จ
- [x] Guard ใน share link: ถ้า guest เข้า link ที่ retention หมดแล้ว → แสดง "ข้อมูลงานนี้หมดอายุแล้ว" — `isDataExpired` check ใน `app/e/[token]/page.tsx`
- [x] Alert: ถ้า DeleteCollection fail → log error + email admin — `sendCleanupFailureAlert()` ใน cron route
- [ ] อัพเดท Q7 ใน facefind_spec.html เป็น resolved

**Blocked by:** #7, #12

---

### #17 — Supabase Cloud Migration + Production Deploy

**Type:** HITL

**What to build**

ตอน Phase 1 dev เสร็จแล้ว — migrate จาก local Supabase ไป Supabase cloud (อัพเกรด plan เพราะ free tier เต็ม — ตามที่ user ระบุไว้ตั้งแต่ต้น), deploy Next.js ไป Vercel, set env vars production, smoke test ทุก feature.

**Acceptance criteria**
- [x] อัพเกรด Supabase cloud project (Pro tier หรือสูงกว่าตามจำเป็น) — confirm billing
- [x] Push migration ทั้งหมดจาก local ไป cloud (`supabase db push`)
- [x] Verify RLS policies + auth ทำงานบน cloud
- [x] Deploy Next.js ไป Vercel + connect domain
- [x] Set env vars production: Supabase cloud URL/key, AWS, R2, Drive OAuth, Omise live keys
- [x] Smoke test: signup → create event → sync → guest search → download (ทุก feature) — passed
- [ ] Setup monitoring + error tracking (Sentry หรือ Vercel Analytics)

**Blocked by:** #1, #2, #3, #4, #5, #6, #7, #8, #9, #10, #11, #12, #13, #14, #15, #16, #19

---

### #18 — Internal Pilot Test

**Type:** HITL

**What to build**

ทดสอบระบบจริงกับงาน event ภายในองค์กร — จัด end-to-end test trial: organizer สร้าง event จริง, ช่างภาพอัพ ~500 รูป, แขก ~50-100 คนค้นหา, เก็บ feedback + metrics (latency, accuracy, UX friction). Output เป็น pilot report ที่ feed back เข้า backlog Phase 2.

**Acceptance criteria**
- [ ] เลือกงาน event ภายในที่ใช้ทดสอบได้
- [ ] Onboard organizer + ช่างภาพ
- [ ] เก็บ metrics: face search latency, success rate, blacklist usage, download volume
- [ ] เก็บ qualitative feedback จาก organizer + guests (survey สั้น)
- [ ] Pilot report สรุป + recommendation สำหรับ Phase 2

**Blocked by:** #17

---

### #19 — Super Admin Panel — Slip Verification

**Type:** AFK
**Related:** Super Admin role จาก §2

**What to build**

Admin panel แยก (route `/admin/*` หรือ subdomain) สำหรับ super admin (platform owner) ใช้ verify slip ที่ organizer อัพมา. ตามที่ §2 ระบุไว้ — Super Admin มี admin panel แยกจาก organizer dashboard.

**Acceptance criteria**
- [x] Admin auth แยก — `SUPER_ADMIN_EMAILS` allowlist + service-role client, guard ใน `app/admin/layout.tsx`
- [x] หน้ารายการ slip pending (pending-first sort, limit 200)
- [x] รายการแสดง: tenant name, package, amount_thb, credits_claimed, slip thumbnail, uploaded_at
- [x] กด row → drawer เปิด slip image + ข้อมูล tenant + payment details
- [x] ปุ่ม Approve → atomic update (slip status + ledger insert + balance update) พร้อม `actor_user_id`
- [x] ปุ่ม Reject + ใส่ reason → notify organizer
- [x] Audit log: `actor_user_id` บันทึกว่าใคร verify + `verified_at`
- [x] หน้ารายการ slip ทั้งหมด (history) พร้อม status badge
- [x] Dashboard: pending count, tenant count, active events, outstanding credit balance

**Blocked by:** #13

---

### #20 — Dropbox Storage Source (pulled from Phase 2)

**Type:** AFK
**Related:** #5, #7, Q1
**Spec:** [docs/superpowers/plans/2026-05-30-dropbox-source-provider.md](docs/superpowers/plans/2026-05-30-dropbox-source-provider.md) · ADR [0003](docs/adr/0003-dropbox-source-provider.md)

**What to build**

เพิ่ม Dropbox เป็น storage source ที่สองข้าง Google Drive เพื่อ onboard ลูกค้า web-only Dropbox ที่ติด Drive-only (ก่อน pilot). ทำผ่าน `StorageProvider` abstraction (ห่อ Drive เดิม ไม่ rewrite) + Dropbox HTTP API v2 (fetch, ไม่เพิ่ม SDK). Source เลือก **ต่อ folder** (`event_storage_folders.source_type`) — event เดียวผสม Drive + Dropbox ได้. ส่วน sharp → R2 → Rekognition → insert ไม่แตะ (source-agnostic อยู่แล้ว).

**Decisions (2026-05-30, ADR 0003)**
- per-folder `source_type` (ไม่ใช่ per-event)
- provider abstraction (ไม่ใช่ inline branch)
- token มิเรอร์ `tenants.google_*` → `dropbox_refresh_token` + `dropbox_connected_at`
- folder UX = paste path + validate-on-blur (ยังไม่ทำ Chooser widget)
- **ไม่ทำ:** queue (volume ≤500), normalized token table, production app approval (dev mode พอสำหรับ pilot ถึง 500 users)

**Acceptance criteria**
- [ ] Migration: `event_storage_folders.source_type` + unique `(event_id, source_type, folder_id)` + `tenants.dropbox_refresh_token`/`dropbox_connected_at`
- [ ] `StorageProvider` interface + `getProvider()` factory; Google Drive wrapped เป็น provider (sync เดิมต้องไม่พัง)
- [ ] `lib/dropbox-api.ts`: OAuth (offline/refresh), `list_folder` (+pagination), `download`, retry 429/5xx
- [ ] Dropbox OAuth routes `/auth/dropbox` + callback → เก็บ refresh token
- [ ] `testDropboxFolder` + disconnect action
- [ ] Sources modal: source picker ต่อ row + Connect Dropbox + validate-on-blur
- [ ] `runSync` route ผ่าน `getProvider` ต่อ folder; folder ที่ provider ยังไม่ connect → skip + warn
- [ ] Unit tests: path normalizer, retry classifier, `getProvider` guards
- [ ] E2E (HITL): connect Dropbox → paste path → sync → รูปเข้า R2 + index; event ผสม Drive+Dropbox
- [ ] **Verify ก่อน pilot:** full-sync ~500 รูปบน prod ไม่ชน serverless timeout (หรือ resume ได้) — re-verify เคลม #7 "1,000 รูป"

**Blocked by:** None (seam พร้อม) — ต้องสมัคร Dropbox app (HITL) ก่อนทดสอบ e2e

---

## Phase 2 — Backlog

### #B-01 — Highlight Reel Render Pipeline

**Type:** AFK (หลัง Phase 1 launch)
**Tier:** Studio only

**Decisions (2026-05-30)**

- **Output:** 9:16 MP4, 15-30 วิ (ตามจำนวนรูป), stream โดยตรงให้ browser — **ไม่เก็บใน R2**
- **Photos:** รูป matched ของ guest ก่อน + รูป `visibility=public` ของ event เพิ่มเติม (ให้ reel ดูสมบูรณ์แม้ match น้อย)
  - personal ≥ 8 → ใช้ personal ล้วน
  - personal 4-7 → เติม public ให้ได้ ~8 รูป
  - personal < 4 → เติม public ให้ได้ ~6 รูป (reel ~15 วิ)
- **เพลง:** Organizer เลือก theme → guest เลือกจาก 3-5 preset tracks (Mixkit — ฟรี, ContentID-safe)
- **Themes launch:** `running` / `wedding` / `party` / `corporate` (เพิ่มทีหลังได้)
- **Visual:** blur background fill 9:16, Ken Burns per photo, crossfade, beat-synced transitions (beat timestamps pre-marked ต่อ track)
- **End credit:** Studio logo + ชื่อ + PixPresent branding (2-3 วิสุดท้าย)
- **Rate limit:** 3 generates ต่อ guest session + cooldown 60 วิ (เช็คจาก `guest_sessions.reel_count` + `last_reel_at`)

**What to build**

Remotion Lambda pipeline ที่รับรูปจาก guest session + เพลงที่เลือก → render 9:16 MP4 → stream กลับทันที ไม่ผ่าน queue (วิดีโอสั้น ≤ 30 วิ render เสร็จใน ~15 วิ) ต้องมี motion design template ที่ดูเป็น premium — แนะนำจ้าง motion designer ออกแบบก่อน engineer implement

**Schema additions**
```sql
-- guest_sessions
reel_count    INT DEFAULT 0        -- นับ generate ต่อ session (rate limit)
last_reel_at  TIMESTAMPTZ          -- cooldown check

-- tenants
logo_url      TEXT                 -- R2 URL ของ studio logo (end credit)

-- events
theme         TEXT                 -- 'running' | 'wedding' | 'party' | 'corporate'
```

**Pre-code work (ต้องทำก่อน build)**
- คัดเพลง Mixkit theme ละ 3-5 tracks + ตัดให้ได้ 15/20/30 วิ
- Mark beat timestamps ต่อ track (one-time)
- จ้าง motion designer ออกแบบ Remotion template (visual style, transition curve, end credit layout)
- ทดสอบ post วิดีโอตัวอย่างบน TikTok + Instagram ว่าเพลงไม่ถูก mute

**Acceptance criteria**
- [ ] Migration: `guest_sessions.reel_count`, `guest_sessions.last_reel_at`, `tenants.logo_url`, `events.theme`
- [ ] Remotion Lambda template: 9:16, blur bg, Ken Burns, beat-synced crossfade, end credit
- [ ] Photo mix logic: personal matched + public filler ตามสัดส่วน
- [ ] Theme + track selector: organizer ตั้ง theme ตอนสร้าง event, guest เลือก track ตอน generate
- [ ] Rate limit: 3 generates/session + 60 วิ cooldown (server-enforced ผ่าน `guest_sessions`)
- [ ] Stream MP4 โดยตรง — ไม่เก็บใน R2
- [ ] Studio logo + PixPresent end credit render จาก `tenants.logo_url`
- [ ] Guest UI: ปุ่ม "สร้าง Reel", track picker, progress (~15 วิ), ปุ่ม download
- [ ] Fallback: ถ้า personal < 2 รูป → ซ่อนปุ่ม Reel (ไม่พอทำวิดีโอ)
- [ ] Cost monitoring: log Lambda invocation ต่อ tenant

**Blocked by:** #18 (Phase 1 pilot สำเร็จ), pre-code work ข้างต้น

---

### #B-02 — Commerce — Photo Sale

**Type:** AFK (หลัง Phase 1 launch)

**What to build**

เปิดโหมดขายรูปต่อ event ตาม §11. Organizer เปิด `commerce_enabled` + ตั้งราคาต่อรูป (column `price`/`currency` มี nullable ตั้งแต่ Phase 1 แล้ว). Guest เห็น watermarked preview (column `watermark_url`) ก่อนซื้อ. กดซื้อ → จ่ายผ่าน PaymentService → unlock เข้า `purchased_photo_ids[]` → download ได้.

รวม watermark generation pipeline (background job ตอน sync) + payout account management สำหรับ organizer.

**Acceptance criteria**
- [ ] Watermark generation pipeline → upload ไป R2 path `/events/{id}/watermark/{photo_id}.jpg`
- [ ] Organizer UI: toggle commerce + ตั้งราคา per-event หรือ per-photo
- [ ] Guest UI: แสดง watermarked preview + ปุ่มซื้อ + cart (optional)
- [ ] Purchase flow ผ่าน PaymentService → update `guest_sessions.purchased_photo_ids`
- [ ] Payout: ตาราง `payout_accounts` + integration กับ Omise payout / manual transfer
- [ ] FaceFind หัก % commission (config ใน plan tier)

**Blocked by:** #18, #13 (PaymentService พร้อม)

---

### #B-04 — Omise Subscription + PaymentService Abstraction

**Type:** AFK (เมื่อ pilot ผ่าน + scale > slip verification ไหว)

**What to build**

ย้ายจาก manual slip + credit ไป automated subscription/charge ผ่าน Omise — ตามแผนเดิมที่ defer มาจาก Phase 1. สร้าง `PaymentService` interface (charge, createSubscription, cancelSubscription, webhook) + `OmiseProvider` implementation. รวม `payments` table + subscription columns ใน tenants (schema เผื่อไว้ตั้งแต่ §11 prep).

ทางเลือกตอน launch:
1. **Subscription model** — เลิก credit, ใช้ recurring billing ทั้งหมด
2. **Hybrid** — เก็บ credit สำหรับ pay-per-use + เพิ่ม Omise top-up อัตโนมัติ (organizer ไม่ต้องอัพ slip)
3. **Auto-topup** — credit หมด → charge Omise อัตโนมัติเติม credit เพิ่ม

แนะนำ #3 เพื่อไม่ต้อง breaking change ระบบ credit ที่ผู้ใช้คุ้นแล้ว

**Acceptance criteria**
- [ ] สมัคร Omise production + verify บริษัท
- [ ] Migration: เพิ่ม `payments` table + subscription cols ใน tenants
- [ ] `PaymentService` interface
- [ ] `OmiseProvider` implements PaymentService (PromptPay + Card + recurring)
- [ ] Webhook endpoint + signature verification
- [ ] Auto-topup flow (recommended): credit ต่ำกว่า threshold → charge → topup
- [ ] UI ให้ organizer manage payment method + view invoices
- [ ] Migration plan: existing tenants กับ credit balance ทำยังไง

**Blocked by:** #18 (pilot สำเร็จ), business decision เลือก model

---

### #B-03 — StripeProvider for International

**Type:** AFK (เมื่อมี signal ต้องการ international)

**What to build**

เพิ่ม `StripeProvider` เข้า PaymentService abstraction (§12.1, §12.2). เพราะ abstraction ทำมาตั้งแต่ Phase 1 — งานนี้ไม่ต้อง refactor business logic เลย แค่:
1. Implement StripeProvider class
2. เพิ่ม config "เลือก provider" ต่อ tenant หรือ region
3. Webhook handler ของ Stripe

Trigger เมื่อ: มี organizer ต่างประเทศ หรือ business ตัดสินใจขยายตลาด.

**Acceptance criteria**
- [ ] `StripeProvider implements PaymentService` (charge, subscription, webhook)
- [ ] Config switch: เลือก provider ต่อ tenant (column `payment_provider` ใน tenants)
- [ ] Stripe webhook endpoint + signature verification
- [ ] รองรับ card payment + Apple/Google Pay
- [ ] Integration test กับ Stripe test mode
- [ ] Documentation วิธีเลือก provider

**Blocked by:** Business decision ว่าต้องการ international + #B-04 (PaymentService พร้อม)

---

### #B-06 — Tenant Account Plan (Subscription Tier)

**Type:** AFK (หลัง Phase 1 launch + pilot)

**What to build**

Account-level subscription plan แยกจาก per-event tier — คล้าย AI subscription (Claude Pro, ChatGPT Plus) ที่มี Business pricing

`tenant.plan` field มีอยู่ใน schema แล้ว (ค่า default `'free'`) รอ implement จริงใน phase นี้

> **Partially implemented (2026-06-02):** special tenant tier `plan='business'` + unlimited-retention gate (cleanup cron ข้าม events ของ tenant นี้) + admin plan selector + `lib/tenant-plans.ts` + migration `20260602000000`. **Remaining:** subscription billing (#B-04), monthly credit allowance, commerce gating, member seats (= ADR 0004 Stage 2, ยังไม่ทำ).

**แนวคิด:**
- `free` — pay-as-you-go ด้วย credit (Phase 1 model ทั้งหมด)
- `business` (หรือ tier อื่นตาม decision) — จ่ายรายเดือน → ได้ monthly credit allowance + account features
- Commerce / ขายรูป → gate ด้วย paid tenant plan เท่านั้น (ไม่ผูกกับ event tier)

**Acceptance criteria**
- [ ] Business decision: ราคา subscription, monthly credit allowance, account features
- [ ] Migration: เพิ่ม plan values ใน tenants.plan check constraint
- [ ] Subscription billing ผ่าน Omise recurring (ต่อจาก #B-04)
- [ ] Commerce feature gating: ตรวจ tenant.plan ก่อน enable commerce บน event
- [ ] UI: upgrade prompt เมื่อ organizer พยายามเปิด commerce บน free plan

**Blocked by:** #18 (pilot สำเร็จ), #B-04 (Omise subscription พร้อม), business decision on pricing

---

### #B-07 — Event Analytics Dashboard

**Type:** AFK (หลัง Phase 1 launch)

**What to build**

หลังงาน event จบ organizer ดู analytics ย้อนหลังได้ใน Account history — ไม่มีค่าใช้จ่ายเพิ่ม

**Metrics ที่ต้องการ:**
- จำนวน guest ที่เข้ามาค้นหา (unique sessions)
- จำนวนครั้งที่ดาวน์โหลดรูปทั้งหมด
- รูปที่ถูกดาวน์โหลดมากที่สุด (top photos)
- Guest ที่ไม่มีรูปถูกดาวน์โหลดเลย — signal ว่าอาจเข้าไม่ถึงรูปของตัวเอง (face miss หรือ blacklist)

**Acceptance criteria**
- [ ] หน้า event history ใน dashboard แสดง event ที่ผ่านมา (หมด data retention แล้ว)
- [ ] Per-event: total sessions, total downloads, top 5 most-downloaded photos
- [ ] Flag: guest sessions ที่ matched 0 photos (possible missed face)
- [ ] Data เก็บใน `guest_sessions` ที่มีอยู่แล้ว — ไม่ต้องเพิ่ม schema ใหม่

**Blocked by:** #18 (pilot สำเร็จ — รู้ว่า metrics ไหน useful จริง)

---

### #B-08 — Tier Upgrade Flow Mid-Event

**Type:** AFK (หลัง Phase 1 launch)

**What to build**

Organizer อัพเกรด tier ของ event ที่สร้างแล้ว — เช่นจาก Starter → Gallery เพราะรูปเกิน storage limit หรืออยากขยาย link duration

**Flow (tentative):**
- Organizer กด "Upgrade Tier" บน event page
- เลือก tier ใหม่ที่สูงกว่า → แสดง credit ที่ต้องจ่ายเพิ่ม (diff หรือ full cost — ต้องตัดสินใจ)
- Atomic: หัก credit + update events.tier + limits

**Acceptance criteria**
- [ ] Business decision: คิดราคา diff (ส่วนต่าง) หรือ full price ของ tier ใหม่
- [ ] UI: ปุ่ม "Upgrade" บน event page + confirm modal แสดง credit ที่จะหัก
- [ ] Atomic transaction: credit deduct + tier update
- [ ] Downgrade ไม่อนุญาต (tier เป็น one-way)

**Blocked by:** #14 (activation flow พร้อม), business decision on pricing diff vs full

---

### #B-09 — Profiles Table + Role-Based Access Control

**Type:** AFK (หลัง Phase 1 launch)

**ปัญหาที่แก้**

ตอนนี้ super-admin ถูกระบุผ่าน `SUPER_ADMIN_EMAILS` env var (allowlist) — ทำได้ง่ายตอน MVP แต่จำกัดในอนาคต: เพิ่ม/ลด admin ต้องแก้ env + redeploy, ไม่สามารถ query role จาก DB ได้, และ admin user โผล่ใน tenant list เพราะ DB ไม่รู้จัก concept ของ role

**What to build**

เพิ่ม `profiles` table (1:1 กับ `auth.users`) ที่เก็บ `role` เพื่อเป็น source of truth ของ identity ฝั่ง platform:

```sql
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        text not null default 'tenant'
                check (role in ('super_admin', 'tenant')),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- auto-create profile on signup (role = 'tenant' by default)
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
```

**Migration path จาก state ปัจจุบัน**
1. สร้าง `profiles` table + trigger
2. Backfill: seed `super_admin` role จาก `SUPER_ADMIN_EMAILS` env, users ที่เหลือได้ `tenant`
3. แก้ `isSuperAdminEmail(email)` → `isSuperAdmin(userId)` ที่ query `profiles.role` แทน (ผ่าน service-role)
4. Admin layout ใช้ userId จาก session แทน email
5. คง `SUPER_ADMIN_EMAILS` ไว้เป็น **bootstrap fallback** กรณี profiles ว่างเปล่า (first-run / emergency)
6. Filter `role = 'super_admin'` ออกจาก `/admin/tenants` list

**Open questions (ต้องตัดสินใจก่อน implement)**
- `profiles` ควรรวมกับ `tenants` หรือแยกไว้? (`tenants` = business data / credits, `profiles` = platform identity — แนะนำแยก)
- Role เพิ่มได้อีกไหม? เช่น `viewer` (read-only admin), `support`?
- ใครมีสิทธิ์เปลี่ยน role? เฉพาะ DB โดยตรง (ปลอดภัยกว่า) หรือมี UI ใน /admin?

**Acceptance criteria**
- [ ] `profiles` table + trigger (auto-create ตอน signup)
- [ ] Backfill script ที่ seed super_admin จาก env ก่อน deploy
- [ ] `isSuperAdmin(userId)` query-based แทน email allowlist
- [ ] `/admin/tenants` ไม่แสดง super_admin accounts
- [ ] Role-change UI ใน `/admin/tenants` drawer (promote/demote)
- [ ] `SUPER_ADMIN_EMAILS` ยังคงทำงานเป็น fallback

**Blocked by:** Phase 1 launch complete (#18)

---

## Summary

| Category | Count |
|----------|-------|
| Phase 1 Total | 19 |
| Phase 1 AFK | 13 |
| Phase 1 HITL | 6 |
| Phase 2 Backlog | 8 |
| **Grand Total** | **27** |

**Critical path for MVP:** #1 → #3 → #4 → #5 → #7 → #8 → #9 → #10 → #11 → #13 → #14 → #19 → #17 → #18

**Key changes จาก plan เดิม:**
- ตัด Omise ออกจาก Phase 1 → ใช้ slip + credit (manual verify) แทน
- #12 เปลี่ยนจาก plan tier → credit package pricing (simpler decision)
- เพิ่ม #19 Super Admin Panel สำหรับ slip verification
- Omise ย้ายไป #B-04 Phase 2 backlog (รอ scale ก่อน)
- **ตัด #6 Photographer Management** → multi-folder per event ใน #5 แทน (workflow จริงคือ organizer share editor folder ให้ช่างทุกคน)
- **เพิ่ม #20 Dropbox Storage Source** → ดึงจาก Phase 2 มา Phase 1 (ลูกค้า web-only Dropbox ติด Drive-only — ดู ADR 0003)
