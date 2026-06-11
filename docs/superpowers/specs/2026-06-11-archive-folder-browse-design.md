# Archive Folder Browse — Mirror the Source Folder Tree (Design Spec)

- **Date:** 2026-06-11
- **Status:** Approved (model) — pending implementation plan
- **Scope:** PixPresent · internal archive · organizer dashboard · "Piece 1 of 3" of the archive-UX rethink
- **Related:** memory `internal-photo-archive-goal`, `person-archive-progress`; ADR 0003 (storage provider abstraction); ISSUES #20 (Dropbox source), #21 (sync hardening)

---

## Background / Problem

(TH) เป้าหมายคือคลังภาพภายในที่ "เปิดมาแล้วเหมือน Dropbox จริง" — ไล่ดูเป็นแฟ้ม/โฟลเดอร์ตามที่ผู้ใช้จัดไว้เอง ผู้ใช้ยืนยัน mental model: **1 งาน = 1 แฟ้มราก** และข้างในแฟ้มรากมีแฟ้มย่อยซ้อนกัน (เช่น `สงกรานต์ 2024/พิธีเช้า`, `.../ช่วงเย็น`)

ปัญหาปัจจุบัน 2 ข้อ:
1. **Sync ไม่ไล่โฟลเดอร์ย่อย** — ทั้ง Drive (`listImagesInFolder`, `'folderId' in parents`) และ Dropbox (`dropboxListFolder`, non-recursive) ดึงเฉพาะรูปชั้นบนของแฟ้มที่เชื่อม → **รูปในซับโฟลเดอร์ไม่เคยถูกดึงเข้ามาเลย**
2. **ไม่เก็บโครงสร้างแฟ้ม** — `photos` รู้แค่ว่ามาจาก connected folder อันไหน (`event_storage_folder_id` + `label`) ไม่มี path ของแฟ้มย่อย → สร้างหน้าไล่แฟ้มไม่ได้

> นี่คือ "ชิ้น 1" ของการรื้อ UX คลัง 3 ชิ้น (1=ไล่แฟ้ม/tree, 2=อัปโหลดเอง, 3=สารบัญใบหน้าให้ดีขึ้น) — สเปคนี้ครอบเฉพาะชิ้น 1

## Goals

1. **Sync ไล่อ่านทั้งต้นไม้** ของแฟ้มที่เชื่อม (recursive) — ดึงรูปในทุกซับโฟลเดอร์เข้ามาด้วย
2. **จำ path** ของแต่ละรูป (ตำแหน่งแฟ้มย่อยเทียบกับ connected folder)
3. **หน้าไล่แฟ้ม** ในหน้า event: เปิดมาเห็นแฟ้มย่อย → คลิกเข้าไปเรื่อยๆ (breadcrumb) → เจอรูป — เหมือนเปิดโฟลเดอร์ใน Dropbox
4. **ค้นใบหน้า/ตัวกรองเดิมยังใช้ได้** ทับบนมุมมองแฟ้ม
5. ของเดิมไม่พัง — sync resume/concurrency (#21), guest flow, person archive ทำงานเหมือนเดิม

## Non-Goals (ชิ้นนี้)

- **อัปโหลดเอง (local upload)** — ชิ้น 2 (เฟสถัดไป)
- **สารบัญใบหน้าให้ดีขึ้น** — ชิ้น 3
- **สร้าง/เปลี่ยนชื่อ/ย้ายแฟ้มเองในแอป** — ไม่ทำ (มุมมองนี้ "อ่านอย่างเดียว" สะท้อนต้นทาง)
- **`archive_folders` table / custom folders** — ไม่ทำตอนนี้ (ดู Data Model: ใช้ path string พอ; ตารางแฟ้มค่อยมาตอนชิ้น 2 ถ้าจำเป็น)
- **Cross-event unified tree** — ไม่ทำ; ชั้นบนสุด = รายการ event เดิม (= รายการแฟ้มงาน) ตาม model "งาน = แฟ้ม"

## Key Model (ยืนยันกับผู้ใช้แล้ว)

- **ชั้นบนสุด = รายการ event** ในหน้า dashboard เดิม (แต่ละ event = 1 แฟ้มงาน)
- **เปิด event = เปิดแฟ้มงานนั้น** → เห็นซับโฟลเดอร์ + รูป ไล่ลงได้เรื่อยๆ
- ถ้า event มี connected folder หลายอัน (ระบบรองรับ multi-folder) → ชั้นแรกใต้ event = ชื่อ connected folder แต่ละอัน; ถ้ามีอันเดียว (เคสปกติของผู้ใช้) → ยุบชั้นนี้ทิ้ง ให้เปิด event แล้วเจอซับโฟลเดอร์ของแฟ้มนั้นเลย

## Data Model

**เพิ่มคอลัมน์เดียว** — ไม่สร้างตารางใหม่ (YAGNI; tree อ่านจาก path ได้):

```sql
alter table public.photos add column folder_path text not null default '';
create index photos_event_folder_path_idx on public.photos (event_id, folder_path);
```

- `folder_path` = path ของ **แฟ้มย่อยเทียบกับ connected folder root** ไม่รวมชื่อ connected folder และไม่รวมชื่อไฟล์
  - ไฟล์ที่ `สงกรานต์2024/พิธีเช้า/img.jpg` (เชื่อมที่ `สงกรานต์2024`) → `folder_path = 'พิธีเช้า'`
  - ไฟล์ลึกขึ้น `.../พิธีเช้า/ช่วงเช้า/img.jpg` → `folder_path = 'พิธีเช้า/ช่วงเช้า'`
  - ไฟล์ที่ root ของ connected folder → `folder_path = ''`
- **Tree ได้จากการ query distinct prefix** ของ `folder_path` ภายใต้ path ปัจจุบัน — ไม่ต้องมีตารางแฟ้ม
- แฟ้มว่าง (ไม่มีรูปอยู่ใต้เลย) จะไม่โผล่ — ถูกต้องสำหรับคลัง (ไม่มีอะไรให้ดู)

**ทำไมไม่ใช้ `archive_folders` table:** มุมมองนี้อ่านอย่างเดียว สะท้อนต้นทาง → path string พอและเบากว่ามาก ถ้าชิ้น 2 (อัปโหลดเอง) ต้องมีแฟ้มที่ผู้ใช้สร้างเอง/ว่างได้ ค่อย promote เป็นตารางแฟ้มตอนนั้น (path string migrate ขึ้นตารางได้ตรงๆ)

## Sync Change (ส่วนที่เสี่ยงสุด — ต้องระวัง #21)

ขยาย `StorageProvider` ให้ list แบบ recursive + คืน relative path ต่อไฟล์ โดย **คงพฤติกรรม resume/concurrency/idempotency เดิม**:

- เพิ่มฟิลด์ `relativePath: string` ใน `SourceFile` (default `''`)
- **Dropbox** (`dropboxListFolder`): เปิด `recursive: true` ใน `files/list_folder` → entries มี `path_display` อยู่แล้ว → `relativePath` = ตัด prefix ของ connected folder path ออก (เบา, API รองรับตรงๆ)
- **Google Drive** (`listImagesInFolder`): Drive ไม่มี recursive ในตัว → ต้อง walk: query โฟลเดอร์ย่อย (`mimeType = 'application/vnd.google-apps.folder' and 'X' in parents`) แล้ว recurse สะสม path; ที่แต่ละชั้น query รูปเหมือนเดิม **ห่อด้วย `withDriveRetry` เดิม** (#5) เพื่อกัน rate-limit จาก call ที่เพิ่มขึ้น
- ตอน insert photo เก็บ `folder_path = relativePath`
- **Idempotency คงเดิม:** `unique(event_id, storage_file_id)` ยังคุม; `doneSet` (resume) ยังข้ามไฟล์ที่ทำแล้ว — recursion แค่เปลี่ยน "รายการไฟล์ที่จะวน" ไม่แตะ pipeline ต่อรูป (download→process→R2→Rekognition→insert) หรือ logic 60s/SYNC_CONCURRENCY

**ระวัง:** Drive recursive = API call เพิ่มตามจำนวนโฟลเดอร์ → อาจกินเวลา listing ในหน้าต่าง 60s; การ resume เดิมรองรับอยู่แล้ว (ทำต่อรอบหน้า) แต่ต้องวัด

## Browse UI

ทำหน้า event gallery ([`_photo-gallery.tsx`](../../../app/dashboard/events/[id]/_photo-gallery.tsx)) ให้ "รู้จักแฟ้ม":

- **State `path`** (สตริง, default `''`) จาก `?path=` ใน URL (deep-link/refresh ได้, back ปุ่มเบราว์เซอร์ทำงาน)
- **Breadcrumb** เหนือ grid: `คลัง › [event name] › พิธีเช้า › ช่วงเช้า` คลิกแต่ละชั้นเพื่อกระโดด
- **เนื้อหาที่ path ปัจจุบัน:**
  - **แฟ้มย่อย** = distinct ของ segment ถัดไปใน `folder_path` ที่ขึ้นต้นด้วย `path` ปัจจุบัน → แสดงเป็น tile แฟ้ม (คลิก = ต่อ segment เข้า `path`)
  - **รูป** = photos ที่ `folder_path === path` (อยู่แฟ้มนี้ตรงๆ) → grid เดิม
- **ตัวกรองเดิมทำงานในแฟ้มปัจจุบัน:** tab (เผยแพร่/ไม่เผยแพร่), จำนวนหน้า, person filter (#22) intersect กับ path เหมือนเป็นตัวกรองอีกชั้น
- **Flat view ยังมี:** ปุ่มสลับ "ดูแฟ้ม ↔ ดูรวมทั้งงาน" (ดูรวม = ละ path, เห็นทุกรูปในงาน — มีประโยชน์ตอนค้นใบหน้าทั้งงาน)
- ค่า default = มุมมองแฟ้มที่ root (`path=''`)

## Migration / Backfill (สำคัญ — prod มีรูป 523 อยู่แล้ว)

- รูปเดิมทั้งหมด `folder_path = ''` (default) → โผล่ที่ root ของ event (เหมือนปัจจุบัน, ไม่มีแฟ้มย่อย) จนกว่าจะ **re-sync**
- re-sync จะ (ก) ดึงรูปในซับโฟลเดอร์ที่เคยพลาด (ข) เติม `folder_path` ให้รูปเดิม — `unique(event_id, storage_file_id)` กันซ้ำ แต่ **ต้อง update `folder_path` ของแถวเดิม** (ไม่ใช่ skip) → ปรับ resume `doneSet` logic: ถ้าไฟล์มีแล้วแต่ `folder_path` ว่าง/ต่าง ให้ update path (ไม่ re-download/re-index)
- เอกสารให้ผู้ใช้: หลัง deploy ต้องกด Sync ใหม่ทุก event เพื่อให้แฟ้มย่อยขึ้น

## Risks

- **แตะ sync ที่ hardened แล้ว (#21):** recursion เพิ่มความซับซ้อนของ listing — ต้องไม่พัง 60s resume / concurrency / storage-exceeded; test กับ event จริงบน prod หลัง deploy
- **Drive API cost/latency:** walk โฟลเดอร์ = call เพิ่ม; ห่อ retry + วัด `[sync-perf]`
- **Path edge cases:** ชื่อโฟลเดอร์มี `/`, อักขระพิเศษ, ชื่อซ้ำต่างชั้น → ใช้ `path_display` ตรงๆ + เก็บเป็น string เดียว (segment ด้วย `/`); ถ้าชื่อโฟลเดอร์มี `/` จริง (พบยากใน Drive/Dropbox) ยอมรับ limitation
- **Backfill ต้อง re-sync** — รูปเดิมไม่มี path จนกว่าจะ sync ใหม่ (สื่อสารให้ชัด)

## Verification (เน้นแอปจริง)

1. Drive event ที่มีซับโฟลเดอร์ → Sync → รูปในซับโฟลเดอร์เข้ามา + `folder_path` ถูก
2. เปิด event → เห็นแฟ้มย่อย → คลิกเข้า → breadcrumb + รูปตรงแฟ้ม → คลิก breadcrumb ย้อนได้
3. person filter (#22) + tab + จำนวนหน้า ทำงานในแฟ้มปัจจุบัน
4. สลับ "ดูรวมทั้งงาน" → เห็นทุกรูป
5. re-sync event เดิม (523 รูป) → path เติมโดยไม่ re-download; รูปเดิมไม่หาย
6. Dropbox event (recursive flag) → path ถูกเหมือน Drive
7. (unit) pure helper `deriveFolderView(photos, path)` → คืน {subfolders, photosHere} ทดสอบด้วย Vitest

## Rough Phases (สำหรับ writing-plans)

1. **Schema** — migration `photos.folder_path` + index + `db:types`
2. **Provider recursive listing** — `SourceFile.relativePath`; Dropbox `recursive:true`; Drive folder-walk + retry; unit tests
3. **Sync wiring** — เก็บ `folder_path` ตอน insert; ปรับ resume ให้ update path ของแถวเดิม
4. **Browse UI** — `path` state + breadcrumb + subfolder tiles + `deriveFolderView` + flat-toggle; filters scoped
5. **Verify in app** — Drive+Dropbox, backfill re-sync, filters
