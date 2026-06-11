# Person Archive — Cross-Event Face Search (Design Spec)

- **Date:** 2026-06-03
- **Status:** Approved (design) — pending implementation plan
- **Scope:** PixPresent · internal-facing capability · gated behind **business** tier
- **Related:** ADR 0004 (multi-member org — stays deferred), ISSUES #21 (sync hardening / background-job rearchitecture)

---

## Background / Problem

(TH) องค์กรของผู้ใช้จัดงานอีเวนต์ **ภายใน** หลายครั้งต่อปี สะสมรูปถ่ายมา **หลายปี** บน Personal Dropbox กลางที่ตอนนี้ **เต็มแล้ว** ปัญหาหลักคือ **การสืบค้น** — เวลาจะหารูปของบุคคลใดบุคคลหนึ่ง ต้องนั่งไล่จากความทรงจำ และช่างภาพมีเข้ามีออก

เป้าหมาย: เปลี่ยน PixPresent ให้เป็น **คลังภาพกลางขององค์กรที่ค้นด้วยใบหน้าได้ ข้ามทุกงานทุกปี** โดยฟีเจอร์แจกรูปให้แขก (guest distribution) เดิมยังอยู่เหมือนเดิมเป็นชั้นบน

> ดู background รวมของเป้าหมายนี้ใน memory `internal-photo-archive-goal`

## Goals

1. ลงทะเบียน "คน" ในองค์กร (roster) ด้วย **ชื่อ + ใบหน้าอ้างอิง** (หลายใบหน้าต่อคนได้)
2. ค้น **"รูปทั้งหมดของคนนี้" ข้ามทุก event/ปี** ได้รวดเร็ว (พิมพ์ชื่อ → เห็นรูป)
3. รูปที่ **sync เข้ามาใหม่ ถูกจับคู่กับ roster โดยอัตโนมัติ** (ไม่ต้องสั่ง rescan มือ) — *requirement หลัก*
4. เป็นเครื่องมือ **ภายใน** (dashboard) แยกชั้นจาก guest flow

## Non-Goals (this slice)

- **Timeline / สารบัญเวลา** — ตัดออก (ผู้ใช้จัดโฟลเดอร์ตามเวลาเองอยู่แล้ว)
- **Multi-user login / RBAC** — ไม่ทำ (ADR 0004 ยังเลื่อน)
- **Multi-account source** (Drive/Dropbox หลาย account ต่อ tenant) — เฟสถัดไป
- **Direct / local upload** (เลิก Dropbox) — เฟสอนาคต รออนุมัติองค์กร
- **Auto-clustering** ใบหน้าแบบไม่ระบุชื่อ — ไม่ทำ (ใช้ roster ที่ลงทะเบียนเอง)

## Architecture Decision

**Modular monolith** — แอปเดียว, Supabase project เดียว, schema เดียว แต่โดเมน person-archive เป็น **โมดูลแยกสะอาด** (`lib/people/*` + ตารางของตัวเอง) ที่ extract ออกภายหลังได้

| ชั้น | แยก? | เหตุผล |
|---|---|---|
| โค้ด/แอป | ❌ | reuse pipeline เดิม (sync / R2 / Rekognition / image-processing) |
| Domain/โมดูล | ✅ | `lib/people/*` + ตารางของตัวเอง เป็น bounded context แยกจาก guest/event |
| DB schema | ❌ | `photo_people` อ้าง `photos`/`events` ตรงๆ |
| DB project (Supabase) | ❌ (ตอนนี้) | lean — ภายในก่อน, extract/isolate ทีหลังถ้ามี driver จริง (governance/scale) |

- **Gate ด้วย business-tier** — เป็น capability ที่ business tenant ใด ๆ ใช้ได้ (org ผู้ใช้ = dogfood คนแรก) ออกแบบเป็นโมดูลทั่วไป **ไม่ hardcode org เดียว**
- **ไม่แตะ guest flow** — per-event Rekognition collection + guest `SearchFacesByImage` คงเดิมทุกอย่าง

### Rejected alternatives
- **Single org-wide Rekognition collection** (รวมทุก event) → พัง isolation ของแขก (selfie แขกจะ match ข้ามงานที่ไม่ได้รับเชิญ = หลุด privacy)
- **On-demand search ทุกครั้ง ไม่เก็บผล** → ช้า/แพง ต้องยิงทุก collection ทุกครั้งที่ค้น
- **Separate app / separate Supabase project (ตอนนี้)** → duplicate pipeline + ops เพิ่ม โดยยังไม่มี driver

## Prerequisite (already shipped)

Cross-event search เป็นไปได้เพราะ **Rekognition collection ไม่ถูกลบ** = unlimited retention ของ business tier (cron `cleanup-collections` ข้าม business tenant) ซึ่ง ship แล้ว (`lib/tenant-plans.ts`, `app/api/cron/cleanup-collections/route.ts`). ฟีเจอร์นี้จึง **บังคับใช้ business tier** โดยปริยาย

## Data Model (new — `lib/people` domain)

ทุกตารางมี `tenant_id` + RLS isolation by tenant (ตามแพตเทิร์นเดิม)

### `people` — the roster
- `id` uuid pk
- `tenant_id` uuid → tenants(id), not null
- `name` text not null
- `note` text null
- `created_at`, `updated_at` timestamptz

### `person_reference_faces` — ใบหน้าอ้างอิง (หลายใบ/คน)
- `id` uuid pk
- `tenant_id` uuid (denorm for RLS)
- `person_id` uuid → people(id) on delete cascade
- `source` text check in (`'tagged'`, `'uploaded'`)
- `source_photo_id` uuid null → photos(id)  — กรณี tagged
- `bbox` jsonb null — face region จาก `photos.face_details` (กรณี tagged)
- `r2_key` text not null — รูป crop/อัปโหลด ที่ใช้เป็น reference image ตอน search
- `created_at` timestamptz

### `photo_people` — the index (หัวใจการค้น)
- `id` uuid pk
- `tenant_id` uuid (RLS)
- `person_id` uuid → people(id) on delete cascade
- `photo_id` uuid → photos(id) on delete cascade
- `event_id` uuid → events(id)  — denorm สำหรับ filter/perf
- `confidence` real — similarity score จาก Rekognition (0–100)
- `matched_by` text check in (`'scan'`, `'manual'`)
- `status` text check in (`'confirmed'`, `'pending'`) — match ก้ำกึ่งเข้า pending ให้รีวิว
- `created_at` timestamptz
- **unique(person_id, photo_id)** — idempotent upsert

### `person_event_scans` — work cursor (resumable)
- `id` uuid pk
- `tenant_id` uuid
- `person_id` uuid → people(id) on delete cascade
- `event_id` uuid → events(id) on delete cascade
- `status` text check in (`'pending'`, `'running'`, `'done'`, `'error'`)
- `photos_matched` int default 0
- `error` text null
- `last_run_at` timestamptz null
- **unique(person_id, event_id)**

## Enrollment Flow — "จิ้มหน้าจากรูปที่มี" (primary) + upload (fallback)

1. ใน dashboard ผู้ใช้คลิกใบหน้าในรูป (กรอบหน้าได้จาก `photos.face_details` ที่ index ไว้แล้ว)
2. เลือก **ตั้งชื่อคนใหม่** หรือ **ผูกกับคนที่มีอยู่**
3. Crop บริเวณใบหน้าจากรูปต้นฉบับใน R2 (ใช้ `sharp` + bbox) → เก็บ crop ลง R2 → สร้าง `person_reference_faces` (`source='tagged'`)
4. สร้าง `photo_people` ของรูปต้นทางทันที (`matched_by='manual'`, `status='confirmed'`, confidence สูง)
5. **Enqueue backfill:** upsert `person_event_scans` ของ (person × ทุก event) เป็น `pending` → matching engine ทำงาน
6. (Fallback) ปุ่ม **อัปรูปอ้างอิง** → upload รูป → `person_reference_faces` (`source='uploaded'`) → enqueue backfill เช่นกัน
7. เพิ่มใบหน้าอ้างอิงได้เรื่อย ๆ (จิ้มหน้าเดิมในงานอื่น) → recall ดีขึ้น (สำคัญกับคลังหลายปีที่หน้าคนเปลี่ยน)

## Matching Engine — "scan" (resumable background)

ใช้ **แพตเทิร์น resume 60 วิ ของ sync เดิม** (`maxDuration=60` + client auto-resume) ไม่สร้าง infra ใหม่

**หน่วยงาน = คู่ (person × event)** จาก `person_event_scans` ที่ `status='pending'`:
1. สำหรับแต่ละ ref face ของ person → `SearchFacesByImage(event.rekognition_collection_id, refImageBytes, FaceMatchThreshold=80)` → รวม matched `FaceId` (union ข้าม ref faces). *(80 = เท่า guest search ปัจจุบัน; ปรับได้)*
2. หา photos ใน event นั้นที่ `rekognition_face_ids && matchedFaceIds` (PostgreSQL array overlap — แพตเทิร์นเดียวกับ guest search ใน `lib/actions/face-search.ts`)
3. upsert `photo_people` (confidence = similarity สูงสุด, `matched_by='scan'`, `status` = confidence ≥ 90 ? `'confirmed'` : `'pending'`). On conflict (มีอยู่แล้ว) **ห้าม downgrade** แถวที่เป็น `matched_by='manual'` / `status='confirmed'`
4. mark unit `done`, บันทึก `photos_matched`
5. ทำทีละ batch จนหมดเวลา 60 วิ → client auto-resume → จนไม่มี unit `pending`

**Triggers (สร้าง/รีเซ็ต units):**
- ลงทะเบียนคนใหม่ / เพิ่ม ref face → (person × ทุก event) = `pending`  *(backfill)*
- **sync เพิ่มรูปใหม่เข้า event E เสร็จ → (ทุก person × E) = `pending`**  *(auto-incremental — Goal #3)*
- กด **rescan** เอง → รีเซ็ต units ที่เลือก

> เหตุที่ใช้หน่วย (person × event) ได้: roster เป็นเซตจำกัด (หลักสิบ–ร้อย) เทียบกับจำนวนรูปมหาศาล → ยิงต่อคนต่องาน คุ้มกว่ายิงต่อใบหน้าต่อรูป และ usage จริงคือ batch upload หลังงาน (นาน ๆ ที) ไม่ใช่สตรีมต่อเนื่อง

## Search UI (internal dashboard)

- **`/dashboard/people`** — list + ค้นชื่อ → คลิกคน → grid รูปทั้งหมดข้ามทุกงาน (query `photo_people ⋈ photos` ล้วน เร็ว), filter ตาม event/ปี
- **Person detail** — จัดการ ref faces (เพิ่ม/ลบ), รีวิว match ที่ `status='pending'` (ยืนยัน/ปฏิเสธ), ลบคน (cascade ลบ index + ref faces)
- **Pending review** — รายการ `photo_people.status='pending'` ให้ยืนยันเป็นชุด กัน false match

## Module Boundaries (extractable)

- `lib/people/` — enrollment, ref-face mgmt, matching engine, search queries. นำเข้าได้เฉพาะ low-level ที่ใช้ร่วม (`lib/r2.ts`, Rekognition client, `lib/image-processing.ts`) **ห้าม** ผูกกับโดเมน guest/face-search
- Server actions: `lib/actions/people.ts`
- Scan route: `app/api/people/scan/route.ts` (รูปแบบเดียวกับ sync route)
- ตารางใหม่แยกชัด, RLS by `tenant_id` — เพื่อให้ extract เป็น project แยกได้ภายหลังโดยกระทบน้อย

## Risks, Cost & Compliance

- **Rekognition cost** — `SearchFacesByImage` คิดเงินต่อ call. Backfill ≈ #persons × #events × #refFaces; incremental ≈ #persons × #(events ที่มีรูปใหม่). สเกลผู้ใช้ (หลักสิบคน, ไม่กี่งาน/ปี) = พอรับได้ แต่ต้องเฝ้าเมื่อโต
- **Execution (60s Hobby cap)** — scan ใหญ่จบใน window เดียวไม่ได้ → ใช้ engine แบบ resume (ผูกกับงาน background-job/queue ที่ยัง pending ใน ISSUES #21; ฟีเจอร์นี้อาจเป็นตัวผลักให้ทำ queue จริง)
- **Accuracy** — false match ที่ confidence ต่ำ → threshold + `status='pending'` review; หน้าคนเปลี่ยนตามปี → รองรับหลาย ref faces
- **PDPA / governance** — ใบหน้าพนักงาน **ผูกชื่อ** = PII อ่อนไหวกว่า guest นิรนาม → ต้องมี consent/นโยบายภายใน, จำกัดสิทธิ์ (business-tier + tenant RLS), ลบคนต้อง cascade ลบ index/ref faces ครบ
- **R2 storage** — คลังถาวรโตทุกปี = ค่าเก็บจ่ายเรื่อย ๆ ไม่ลด

## Open Questions / Future

- **Org-people Rekognition collection** (`pixpresent-people-{tenantId}`) — ทางเลือก optimize incremental: ยิงต่อใบหน้าใหม่เข้า collection คน แทน rescan ทั้ง event (คุ้มเมื่อ roster ใหญ่ / รูปเข้าบ่อย)
- **Multi-account source** (Drive/Dropbox หลาย account) — เฟสถัดไป (ดูผลสำรวจ: ปัจจุบัน 1 token/provider/tenant)
- **Direct / local upload** — รออนุมัติเลิก Dropbox
- **Job queue** — ร่วมกับ sync hardening (ISSUES #21)
- **Merge/split people, aliases** — ภายหลัง
- **Productization** (multi-tenant generalize, แยก project) — deferred

## Rough Phases (สำหรับ writing-plans แตกต่อ)

1. **Schema + RLS** — migrations: `people`, `person_reference_faces`, `photo_people`, `person_event_scans` + `db:types`
2. **Enrollment** — tag-a-face UI + crop→R2 + create person/ref face + self-match; ปุ่ม upload fallback
3. **Matching engine** — resumable scan route (person×event), `SearchFacesByImage`, upsert `photo_people`; trigger ตอน enroll
4. **Search UI** — people list + person photo view + pending-match review
5. **Auto-incremental** — hook ตอน sync เสร็จ → enqueue (persons × event) rescan  *(Goal #3)*
6. **Guards** — business-tier gate, cost/limit guard, PDPA controls (ลบคน, สิทธิ์เข้าถึง)
