# Business Archive Dashboard — File-Explorer-First (Design Spec)

- **Date:** 2026-06-11
- **Status:** Approved (direction confirmed in discussion) — pending implementation plan
- **Scope:** PixPresent · organizer dashboard · **piece 1.5** of the archive-UX rethink (sits on top of piece 1)
- **Related:** [Archive Folder Browse](2026-06-11-archive-folder-browse-design.md) (piece 1, built), memory `archive-ux-rethink` / `internal-photo-archive-goal`, ISSUES #B-06 (tenant plan pricing — owns the pricing question deferred here)

---

## Background / Problem

(TH) Business tier คือคลังถาวร — แต่หน้า dashboard ปัจจุบันเป็น**การ์ดอีเวนต์**ที่ออกแบบมาเพื่องานชั่วคราวของ SaaS (เลือก tier, จ่ายเครดิต, นับวันหมดอายุ, ลบตามรอบ) เมื่อใช้เป็นคลังสะสมหลายปี การ์ดจะกองเป็นสิบเป็นร้อยใบ ค้นยาก และพิธีสร้างอีเวนต์เป็นภาระที่ไม่จำเป็น

**ผู้ใช้ตัดสินใจ (2026-06-11):** Business tier เปิด dashboard มาเจอ **File Explorer ไปเลย** — สร้าง "แฟ้ม" แล้ว Sync โฟลเดอร์ ไม่ต้องผ่านพิธีสร้างอีเวนต์ · SaaS tier เห็นการ์ดเหมือนเดิม

**หลักการสถาปัตยกรรม: เปลี่ยน "หน้ากาก" ไม่เปลี่ยน "กระดูก"** — ข้างใต้ "แฟ้มราก" ยังคงเป็น event row เพราะอีเวนต์เป็นหน่วยของ 4 ระบบที่ยังต้องใช้: (1) Rekognition collection ต่ออีเวนต์ (isolation ของ guest search), (2) share link แจกรูปแขก, (3) person-archive scan units (คน × อีเวนต์), (4) โควต้าพื้นที่ ผู้ใช้ยืนยัน mental model แล้วว่า **งาน = แฟ้ม** → อีเวนต์คือแฟ้มรากอยู่แล้ว แค่เลิกแสดงเป็นการ์ด

## Goals

1. **Business tenant เปิด `/dashboard` → File Explorer ที่ root** — แต่ละแฟ้มราก = อีเวนต์ (ชื่อ, วันที่, จำนวนรูป) เรียงใหม่→เก่า + ช่องค้นชื่อแฟ้ม
2. **คลิกแฟ้มราก → เข้า explorer ของ piece 1** (หน้า event เดิมที่มี breadcrumb/แฟ้มย่อย) ต่อเนื่องเป็นเนื้อเดียว — breadcrumb "คลัง" ที่หน้า event ลิงก์กลับ root explorer
3. **"สร้างแฟ้ม" แบบย่อ** — ตั้งชื่อ (+วันที่ optional) → ได้ event ข้างใต้ทันที **ไม่หักเครดิต ไม่เลือก tier** → เด้งเข้าแฟ้มเพื่อเชื่อมโฟลเดอร์ + Sync ด้วย UI เดิม
4. **SaaS tiers (free/starter/pro) ไม่กระทบ** — การ์ด + พิธีเดิมทุกอย่าง

## Non-Goals (ชิ้นนี้)

- **ลบ/รื้อแนวคิดอีเวนต์** — ไม่ทำ (เหตุผลข้างบน)
- **แฟ้มรากซ้อนเอง / ตาราง folders** — แฟ้มราก = อีเวนต์เท่านั้น; แฟ้มย่อยมาจาก source tree (piece 1); ตาราง folders ค่อยพิจารณาตอน piece 2 (local upload)
- **Local upload** — piece 2
- **เปลี่ยนระบบราคา/monetization** — #B-06 เป็นเจ้าของ; ชิ้นนี้แค่ "business สร้างแฟ้มฟรี" เป็น decision ชั่วคราวที่กลับได้
- **แก้ guest page ให้เคารพ unlimited retention** — พบว่า `app/e/[token]/page.tsx` คำนวณ `isDataExpired` จาก `activated_at + data_retention_days` โดยไม่เช็ค tenant plan (บั๊กเดิม ไม่เกี่ยวชิ้นนี้) → สเปคนี้เลี่ยงด้วย retention ยาว (ดู Decisions) + จดเป็น issue แยก

## Decisions

| เรื่อง | ตัดสินใจ | เหตุผล |
|---|---|---|
| ค่าสร้างแฟ้ม (business) | **ฟรี — ไม่หักเครดิต ไม่ลง ledger** | คลังภายใน; ราคาจริงค่อยตัดสินใน #B-06 (เปลี่ยนกลับง่าย — แค่ action เดียว) |
| สร้างผ่านอะไร | **Server action ใหม่ `createArchiveFolder`** (service-role insert ตรง) — ไม่ใช้ RPC `create_event_deduct_credit` | RPC ผูก credit+ledger; ทางใหม่สะอาดกว่า branch เงื่อนไขใน RPC |
| ค่า default ของ event ข้างใต้ | `tier='studio'` · `storage_limit_gb=100` · `link_active_days=7` · `data_retention_days=3650` · `activated_at=now()` | tier ต้องอยู่ใน check constraint เดิม (`starter/gallery/studio`); 100GB กันสะดุด sync quota; retention 10 ปี กัน `isDataExpired` ฝั่ง guest (workaround บั๊กข้างบน); `activated_at` ต้อง set เพื่อให้ flow downstream ทำงานปกติ (cron ข้าม business อยู่แล้ว) |
| ใครเห็น explorer | `ctx.tenant.plan === 'business'` ใน `DashboardPage` — branch ระดับ page | pattern เดียวกับ people pages ที่ gate ด้วย plan แล้ว |
| จำนวนรูปบน tile | query รวมครั้งเดียว (photos count group by event) | ตารางเล็ก (หลักร้อย–พัน) ไม่ต้อง cache |

## UI

**Root explorer (business เท่านั้น) — แทนที่เนื้อหน้า `/dashboard`:**
- Header: "คลัง" + ช่องค้นชื่อแฟ้ม (client filter) + ปุ่ม **"สร้างแฟ้ม"**
- Grid ของ tile แฟ้ม (`FolderIcon` ทอง — ภาษาเดียวกับ tile แฟ้มย่อยใน piece 1): ชื่องาน · วันที่งาน · N รูป — เรียง `event_date` ใหม่→เก่า (null ท้ายสุด)
- คลิก tile → `/dashboard/events/[id]` (= เปิดแฟ้ม เข้า piece-1 explorer)
- Empty state: "ยังไม่มีแฟ้ม — กดสร้างแฟ้มแล้วเชื่อมโฟลเดอร์เพื่อเริ่มเก็บรูป"

**Create-folder modal:** ชื่อแฟ้ม (required) + วันที่งาน (optional) → submit → `createArchiveFolder` → `router.push` เข้าแฟ้มใหม่ → ผู้ใช้เชื่อม source folder + Sync ด้วย Sources modal/toolbar เดิม (ไม่สร้าง UI ใหม่)

**Breadcrumb ต่อเนื่อง (แก้ใน piece-1 UI เล็กน้อย):** ที่หน้า event เปลี่ยน "คลัง" จากปุ่ม `setPath("")` เป็น 2 ชั้น: `คลัง` (Link → `/dashboard`) `›` `[ชื่องาน]` (คลิก = `setPath("")`) `›` แฟ้มย่อย… — ตรงกับ mockup ที่ยืนยันกับผู้ใช้แล้ว (`คลัง › สงกรานต์ 2024 › พิธีเช้า`)

## Data Model

**ไม่มี migration** — ใช้ events เดิมล้วน ("แฟ้มราก" เป็นแค่มุมมอง)

## Risks

- **`app/dashboard/page.tsx` มี uncommitted edit ของผู้ใช้ค้างอยู่** (แต่งการ์ด EventCard) — ต้องให้ผู้ใช้ commit/stash ก่อนเริ่ม ไม่งั้นชนกัน
- **Business เห็นการ์ดหาย** — ฟีเจอร์บนหน้าการ์ดเดิม (cover, สถานะ) หายจาก root view; ยอมรับได้เพราะเข้าแฟ้มแล้วหน้า event เดิมครบทุกอย่าง
- **เลิกฟรีภายหลัง** — ถ้า #B-06 ตัดสินให้คิดเงิน แก้ที่ `createArchiveFolder` จุดเดียว
- **Guest expiry bug (เดิม)** — retention 3650 วันกันไว้สำหรับแฟ้มใหม่; อีเวนต์ business เก่าที่ retention สั้นยังโดน → แยก issue

## Verification (แอปจริง)

1. Business login → `/dashboard` เห็น explorer (ไม่ใช่การ์ด); แฟ้มเดิม 6 งานขึ้นครบ พร้อมจำนวนรูป
2. "สร้างแฟ้ม" → ตั้งชื่อ → เข้าแฟ้มใหม่ทันที · เครดิตคงเดิม (ไม่ถูกหัก) · ledger ไม่มีแถวใหม่
3. แฟ้มใหม่: เชื่อม Drive/Dropbox folder + Sync ด้วย UI เดิม → รูป+แฟ้มย่อยขึ้น (piece 1)
4. Breadcrumb: ในแฟ้ม กด "คลัง" → กลับ root explorer; กดชื่องาน → กลับ root ของแฟ้มนั้น
5. ค้นชื่อแฟ้ม → กรองถูก
6. **SaaS regression:** login บัญชี free → การ์ด + สร้างอีเวนต์แบบเดิม (เลือก tier หักเครดิต) ครบทุกอย่าง

## Rough Phases (สำหรับ writing-plans)

1. **Action** — `createArchiveFolder` (business-gated, service-role insert, defaults ตามตาราง Decisions) + unit test ค่า defaults
2. **Root explorer** — branch ใน `DashboardPage` + `_archive-explorer.tsx` (tiles, ค้นหา, create modal)
3. **Breadcrumb link-back** — แก้ chip "คลัง" ใน `_photo-gallery.tsx` เป็น Link + ชั้นชื่องาน
4. **Verify in app** — checklist ข้างบน (รวม SaaS regression)
