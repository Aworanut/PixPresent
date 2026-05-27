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
- [ ] รัน `supabase start` แล้วได้ local Postgres + Studio + Auth บน Docker
- [ ] Next.js app เชื่อมกับ local Supabase ได้ (env vars แยก local/cloud)
- [ ] มี npm script เดียวที่รัน Supabase + Next.js dev พร้อมกัน
- [ ] README อธิบาย prerequisites (Docker Desktop, Supabase CLI), `supabase start`, `npm run dev`, การ reset DB
- [ ] เพิ่ม `.env.example` ที่ครอบ keys ทั้งหมด (AWS, R2, Drive, Omise placeholder)

**Blocked by:** None - can start immediately

---

### #2 — External Service Setup

**Type:** HITL

**What to build**

สมัครและตั้งค่า external services ทั้งหมดที่ Phase 1 ต้องใช้ + เก็บ credentials ใน `.env.local` (ห้าม commit). งานนี้ HITL เพราะคนต้องไปสมัคร account จริง ยืนยัน billing, generate API keys, และ config IAM permissions. **Omise ตัดออกจาก Phase 1 — ใช้ slip + credit แทน (ดู #13)**

**Acceptance criteria**
- [ ] AWS account + IAM user สำหรับ Rekognition + R2 (least-privilege policy)
- [ ] Cloudflare R2 bucket สร้างแล้ว + API token + custom domain (optional)
- [ ] Google Cloud project + OAuth 2.0 credentials สำหรับ Drive API (scope: `drive.readonly`)
- [ ] บัญชีธนาคาร / PromptPay ของ FaceFind สำหรับรับโอน + QR code static (ใช้ใน slip topup flow #13)
- [ ] เพิ่ม keys ทั้งหมดเข้า `.env.local` ตาม `.env.example`
- [ ] เอกสารบันทึก console URL ของแต่ละ service สำหรับทีม

**Blocked by:** None - can start immediately

---

### #3 — Database Schema + RLS Migration

**Type:** AFK

**What to build**

Supabase migration ตัวแรกที่สร้าง schema ทั้งหมดของ Phase 1 + nullable columns ที่เตรียมไว้สำหรับ Phase 2 (ตาม §11, §11.4, §12.4) เพื่อไม่ต้อง migrate ใหญ่ในอนาคต. รวม Row-Level Security policies ที่แยก tenant data ขาดจากกัน.

**Acceptance criteria**
- [ ] ตาราง Phase 1 ทั้ง 6 (core): `tenants`, `events`, `photographers`, `photos`, `face_blacklist`, `guest_sessions` (ตาม §4)
- [ ] ตาราง Phase 1 (credit system): `slip_uploads`, `credit_ledger` (ดู #13 สำหรับ schema detail)
- [ ] เพิ่ม column: `tenants.credit_balance INT default 0`, `events.activated_at TIMESTAMPTZ null`, `events.credits_used INT default 0`
- [ ] Phase 2 nullable columns ใน `photos`, `events`, `guest_sessions`, `tenants` ตาม §11 + §11.4 (price, watermark_url, commerce_enabled, reel_quota, highlight_reel_* ฯลฯ) — เก็บไว้รอ Phase 2 commerce/highlight reel
- [ ] **Defer ไป Phase 2:** `payments` table + subscription columns (ใช้เมื่อย้ายไป Omise — ดู #B-04)
- [ ] RLS policies: organizer เห็นเฉพาะ data ของ tenant ตัวเอง, guest session อ่าน photos ของ event ที่ session ผูกอยู่ + active เท่านั้น, super admin role bypass RLS สำหรับ slip verification
- [ ] Migration รันบน local stack สำเร็จด้วย `supabase db reset`
- [ ] TypeScript types generate จาก schema (`supabase gen types typescript`)

**Blocked by:** #1

---

### #4 — Organizer Auth + Tenant Provisioning

**Type:** AFK
**Feature:** F-01

**What to build**

End-to-end signup → auto-create tenant row → login → session ที่ persist ข้าม browser restart ตาม F-01. ใช้ Supabase Auth (Email + Password) + password reset flow. ต้องมี middleware ที่ guard protected routes.

**Acceptance criteria**
- [ ] หน้า signup รับ email + password + organization name → สร้าง auth user + tenant row (plan='free') + link กัน
- [ ] หน้า login + logout
- [ ] Password reset flow ผ่าน Supabase email
- [ ] Session คงอยู่หลังปิด/เปิด browser
- [ ] Middleware redirect ไป /login ถ้าเข้าหน้า dashboard โดยไม่ login
- [ ] หน้า dashboard เปล่าๆ ที่แสดงชื่อ tenant ของ user

**Blocked by:** #3

---

### #5 — Event CRUD + Multi-Folder

**Type:** AFK
**Feature:** F-02

**What to build**

หน้าจัดการ event ใน Organizer Dashboard: สร้าง / รายการ / แก้ไข / soft-delete. **Event ผูกกับ Google Drive folder ได้หลายอัน** (เช่น ทีมหลัก, ทีม Drone, ทีม Video) ผ่านตาราง `event_storage_folders` (label + folder_id). ตอนลบ event ต้อง cleanup Rekognition Collection (เรียก DeleteCollection). Storage provider ใน Phase 1 มีแค่ Google Drive (Dropbox ไป Phase 2 ตามที่ Q1 ตัดสินใจ).

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
- [ ] รองรับ 1,000 รูปต่อ event โดยไม่ timeout (NFR §8.1) — verify เมื่อมี credentials จาก #2

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
- [ ] Verify: ผลของ block/unblock มีผลทันทีกับ guest search ครั้งถัดไป — verify เมื่อ test E2E

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
- [ ] Latency ≤ 5 วินาที สำหรับ event 1,000 รูป (NFR §8.1) — verify เมื่อมีข้อมูลจริง (#7)

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
- [ ] Gallery load ≤ 2 วินาที (NFR §8.1) — verify เมื่อ load จริง

**Blocked by:** #10

---

### #12 — Credit Package Pricing

**Type:** HITL
**Related:** Q4, Q5

**What to build**

Decision gate: business ตัดสินใจ economics ของระบบ credit (แทน plan tier เดิม):

1. **Per-event cost** — 1 event ใช้กี่ credit (คงที่)
2. **Preset packages** — 3-4 packages เช่น Starter / Standard / Pro (จำนวน credit + ราคา THB)
3. **Custom amount range** — min/max ของ custom topup (เช่น 100-50,000 THB)
4. **Free trial credit** — tenant ใหม่ได้ credit ฟรีกี่ credit สำหรับลอง

Output เป็น config file ใน repo + บัญชีรับโอน + QR code

**Acceptance criteria**
- [ ] ประชุมตัดสินใจ — ก่อน Week 4 ตามเดิม
- [ ] 1 event = X credits (คงที่)
- [ ] Preset packages 3-4 ตัว + ราคา
- [ ] Custom amount range
- [ ] Free trial credit (optional — เผื่อ onboarding)
- [ ] เขียน config (เช่น `lib/credit-packages.ts`)
- [ ] บัญชีรับโอน + PromptPay QR เตรียมพร้อม (ผูกกับ #2)
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

**Acceptance criteria**
- [ ] Slip upload endpoint รับ multipart + เก็บ slip ใน R2 path `/slips/{tenant_id}/{slip_id}.jpg`
- [ ] Atomic transaction สำหรับ approve/reject + credit balance update (ใช้ Postgres transaction หรือ Supabase RPC)
- [ ] Atomic transaction สำหรับ event activation (กัน race condition)
- [ ] Credit ledger immutable (เป็น append-only — ไม่ allow update/delete ผ่าน RLS)
- [ ] API ดึง credit balance ปัจจุบัน + ledger history
- [ ] Notification ส่งไป super admin เมื่อมี slip pending ใหม่ (Phase 1: email พอ)
- [ ] Unit tests ครอบ edge cases: credit ไม่พอ, double activation, slip ที่ approve แล้ว approve ซ้ำ
- [ ] Integration test: signup → topup → approve → activate event end-to-end

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
4. **Event activation flow**:
   - Event card แสดง "Draft" badge ถ้ายังไม่ activate
   - ปุ่ม "Activate (X credits)" → confirm modal → deduct → status active
   - ถ้า credit ไม่พอ → modal ที่ link ไป top-up page โดยตรง

**Acceptance criteria**
- [ ] Credit indicator แสดงทุก authenticated page
- [ ] Top-up: preset + custom + QR + bank info + slip upload
- [ ] Credit history แสดง ledger + slip status
- [ ] Event activation ทำงาน — disabled feature (sync, blacklist, guest link) ถ้า event ยัง draft
- [ ] Real-time update (Supabase realtime หรือ refetch) เมื่อ admin approve slip
- [ ] Mobile responsive (organizer อาจเปิดบนมือถือเพื่ออัพ slip จาก app ธนาคาร)

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
- [ ] Legal review approve consent copy ภาษาไทย + อังกฤษ
- [ ] Modal/section บนหน้า guest ก่อน selfie upload
- [ ] Checkbox required → ไม่ติ๊กกดอัพไม่ได้
- [ ] บันทึก consent timestamp ใน guest_sessions (เพิ่ม column ถ้าจำเป็น)
- [ ] อัพเดท Q6 ใน facefind_spec.html เป็น resolved

**Blocked by:** #10

---

### #16 — Rekognition Collection Cleanup Policy

**Type:** HITL
**Related:** Q7

**What to build**

Decision: หลังงาน event จบจะเก็บ Rekognition Collection ไว้นานแค่ไหน? Trigger ลบจากอะไร — manual จาก organizer, scheduled job ตาม event_date + N วัน, หรือผูกกับ link expiry? Implement scheduled cleanup job (cron) หลัง decision เสร็จ.

**Acceptance criteria**
- [ ] Product ตัดสินใจ policy (เช่น "ลบ 30 วันหลัง event_date" หรือ "ลบเมื่อ link expire + 7 วัน")
- [ ] อัพเดท Q7 ใน facefind_spec.html เป็น resolved
- [ ] Implement scheduled job (Supabase cron / Vercel cron) ที่เช็คตาม policy + เรียก Rekognition DeleteCollection + clear `events.rekognition_collection_id`
- [ ] Logging + alert ถ้า delete fail

**Blocked by:** #7

---

### #17 — Supabase Cloud Migration + Production Deploy

**Type:** HITL

**What to build**

ตอน Phase 1 dev เสร็จแล้ว — migrate จาก local Supabase ไป Supabase cloud (อัพเกรด plan เพราะ free tier เต็ม — ตามที่ user ระบุไว้ตั้งแต่ต้น), deploy Next.js ไป Vercel, set env vars production, smoke test ทุก feature.

**Acceptance criteria**
- [ ] อัพเกรด Supabase cloud project (Pro tier หรือสูงกว่าตามจำเป็น) — confirm billing
- [ ] Push migration ทั้งหมดจาก local ไป cloud (`supabase db push`)
- [ ] Verify RLS policies + auth ทำงานบน cloud
- [ ] Deploy Next.js ไป Vercel + connect domain
- [ ] Set env vars production: Supabase cloud URL/key, AWS, R2, Drive OAuth, Omise live keys
- [ ] Smoke test: signup → create event → sync → guest search → download (ทุก feature)
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
- [ ] Admin auth แยก (อาจใช้ Supabase Auth แต่มี role check + RLS bypass หรือ separate auth flow)
- [ ] หน้ารายการ slip pending (filter status, sort by uploaded_at)
- [ ] รายการแสดง: tenant name, package, amount_thb, credits_claimed, slip thumbnail, uploaded_at
- [ ] กด row → modal/page เปิด slip image ขนาดใหญ่ + ข้อมูล tenant + payment details
- [ ] ปุ่ม Approve → atomic update (slip status + ledger insert + balance update)
- [ ] ปุ่ม Reject + ใส่ reason → notify organizer
- [ ] Audit log: ใครเป็นคน verify, เวลาไหน
- [ ] หน้ารายการ slip ทั้งหมด (history) + filter status
- [ ] Dashboard เล็กๆ: pending count, today's approved/rejected, total credits ออกในเดือนนี้

**Blocked by:** #13

---

## Phase 2 — Backlog

### #B-01 — Highlight Reel Render Pipeline

**Type:** AFK (หลัง Phase 1 launch)

**What to build**

Implement MP4 Highlight Reel feature ตาม §11.4. ใช้แนวทาง Remotion + Lambda ที่ตัดสินใจไว้แล้ว (Q8 resolved). สร้าง `ReelRenderer` interface (pattern เดียวกับ PaymentService) + RemotionLambdaProvider + queue system (Supabase background job หรือ SQS). Guest กดสร้าง → enqueue → render → upload MP4 ไป R2 path `/events/{id}/reels/{session_id}.mp4` → set `highlight_reel_status = ready`.

รวม quota deduction logic ตาม §11.4: quota → addon → per-clip purchase (เรียก PaymentService).

**Acceptance criteria**
- [ ] `ReelRenderer` interface + `RemotionLambdaProvider` implementation
- [ ] React composition (Remotion) ที่ใช้รูปจาก guest session + transition + เพลง default
- [ ] Background job queue + status update (`queued → processing → ready/failed`)
- [ ] Quota deduction logic ตามลำดับ §11.4 (quota → addon → per-clip + payment)
- [ ] Guest UI: ปุ่มสร้าง reel + progress + download
- [ ] Cost monitoring (จำนวน Lambda render ต่อ tenant)

**Blocked by:** #18 (Phase 1 pilot สำเร็จ), Plan tier ที่มี reel_quota define แล้ว

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

## Summary

| Category | Count |
|----------|-------|
| Phase 1 Total | 18 |
| Phase 1 AFK | 12 |
| Phase 1 HITL | 6 |
| Phase 2 Backlog | 4 |
| **Grand Total** | **22** |

**Critical path for MVP:** #1 → #3 → #4 → #5 → #7 → #8 → #9 → #10 → #11 → #13 → #14 → #19 → #17 → #18

**Key changes จาก plan เดิม:**
- ตัด Omise ออกจาก Phase 1 → ใช้ slip + credit (manual verify) แทน
- #12 เปลี่ยนจาก plan tier → credit package pricing (simpler decision)
- เพิ่ม #19 Super Admin Panel สำหรับ slip verification
- Omise ย้ายไป #B-04 Phase 2 backlog (รอ scale ก่อน)
- **ตัด #6 Photographer Management** → multi-folder per event ใน #5 แทน (workflow จริงคือ organizer share editor folder ให้ช่างทุกคน)
