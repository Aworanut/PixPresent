# Gallery Face Filter — "ดูเฉพาะรูปของคนนี้" (Design Spec)

- **Date:** 2026-06-04
- **Status:** Approved (design) — pending implementation plan
- **Scope:** PixPresent · organizer dashboard · event gallery · single-event, reuse-only (no new schema)
- **Related:** [Person Archive — Cross-Event Face Search](2026-06-03-person-archive-face-search-design.md) (this is a lightweight precursor, designed to feed it), memory `internal-photo-archive-goal`

---

## Background / Problem

(TH) ใน gallery ของ event ([`_photo-gallery.tsx`](../../../app/dashboard/events/[id]/_photo-gallery.tsx)) ผู้จัดงานเห็นรูปทั้งกอง กรองได้แค่ **จำนวนใบหน้า** (0/1/2/3+) กับ **tab เผยแพร่/ไม่เผยแพร่** เท่านั้น เวลาจะหา "รูปทั้งหมดของคนๆ หนึ่งในงานนี้" ต้องไล่ดูเอง

เป้าหมายเฉพาะหน้า: ให้ **เลือกใบหน้าหนึ่ง → gallery กรองเหลือเฉพาะรูปที่มีคนนั้น** ในงานเดียว โดย reuse กลไกที่มีอยู่แล้ว ไม่เพิ่ม schema และวางโครงให้ต่อยอดเป็น Person Archive (ตั้งชื่อคน + ข้ามงาน) ได้ภายหลังโดยไม่ต้องรื้อ

## Goals

1. เลือกใบหน้าในรูป → gallery แสดงเฉพาะรูปที่มีบุคคลนั้น **ในงานนี้**
2. Reuse logic + UI เดิมให้มากสุด (ไม่มี migration, ไม่มี action ใหม่ที่ไม่จำเป็น)
3. วาง seam ให้ Person Archive ต่อยอดได้ (resolver ต่องาน + จุดวาง "บันทึกเป็นบุคคล")

## Non-Goals (this slice)

- ตั้งชื่อคน / roster / ตารางใหม่ — เป็นงานของ [Person Archive spec](2026-06-03-person-archive-face-search-design.md)
- ค้น/กรอง **ข้ามงาน** — งานเดียวเท่านั้น
- กรองหลายใบหน้าพร้อมกัน (multi-face) — ครั้งละ 1 คน
- จิ้มหน้าใน **lightbox** โดยตรง — ภาพ lightbox เป็น `object-contain` (letterbox) ต้องคำนวณ contained-rect เพิ่มเพื่อจัด bbox ให้ตรง → เลื่อนเป็นเฟสถัดไป
- เปลี่ยน guest flow — ไม่แตะ

## Reuse Map (ของเดิมที่ใช้ซ้ำ)

| ของเดิม | ไฟล์ | บทบาทในฟีเจอร์นี้ |
|---|---|---|
| `findMatchingFacesByFaceId(eventId, faceId)` | [`lib/actions/blacklist.ts:23`](../../../lib/actions/blacklist.ts) | **หัวใจ** — faceId → Rekognition `searchFacesBySimilarFaceId` → คืน `FaceMatchPreview[]` (`photoId`, `r2_web_url`, `matchedFaceId`, `bbox`, `visibility`) = รูปทั้งหมดของคนนั้นในงาน. ใช้ตรงๆ ไม่แก้ |
| `PersonPickerModal` (stage 1) | [`_person-ban-modal.tsx:19`](../../../app/dashboard/events/[id]/_person-ban-modal.tsx) | UI จิ้มหน้า: โชว์รูป + กรอบ bbox คลิกได้ จัดตำแหน่งถูกด้วย `w-fit` แล้ว. ปัจจุบันเมนู "ซ่อนบุคคล" ใช้ |
| `PhotoMenu` ⋮ | [`_photo-gallery.tsx:581`](../../../app/dashboard/events/[id]/_photo-gallery.tsx) | จุดเข้า — เพิ่มรายการเมนูใหม่ ข้าง "ซ่อนบุคคล" |
| `visible` pipeline + grid/list/lightbox | [`_photo-gallery.tsx:75`](../../../app/dashboard/events/[id]/_photo-gallery.tsx) | กรองเพิ่มอีกชั้น แล้ว render เดิมทำงานต่อเอง |

> หมายเหตุ: `findMatchingFacesByFaceId` ตอนนี้อยู่ใน `blacklist.ts` (semantic coupling เล็กน้อย — ใช้ powering ทั้ง "ซ่อน" และ "กรอง") ยอมรับได้ตอนนี้; ถ้า Person Archive มา ค่อย promote ไป `lib/people/` พร้อมตั้งชื่อกลาง

## Mechanism (data flow)

1. ผู้ใช้กดเมนู ⋮ ของรูป → **"ดูเฉพาะรูปของคนนี้"** → เปิด `PersonPickerModal` แบบ `mode="filter"`
2. คลิกใบหน้า → `findMatchingFacesByFaceId(eventId, faceId)` → ได้ `FaceMatchPreview[]`
3. picker เรียก callback `onApplyFilter({ faceId, sourcePhotoId, bbox, sourceUrl, photoIds })` แล้วปิด modal (ไม่เข้า stage 2 preview)
4. `PhotoGallery` เก็บ state:
   ```ts
   type PersonFilter = {
     faceId: string;
     sourcePhotoId: string;          // รูปต้นทางที่จิ้ม
     bbox: { left; top; width; height }; // กรอบหน้าที่เลือก (ทำ thumbnail)
     sourceUrl: string | null;
     photoIds: Set<string>;          // ผลลัพธ์ที่จะกรอง
   } | null
   ```
5. เพิ่มชั้นกรองใน derivation เดิม:
   ```ts
   const visible = tabPhotos
     .filter(faceCountFilter)
     .filter(p => !personFilter || personFilter.photoIds.has(p.id));
   ```
6. grid / list / lightbox วิ่งบน `visible` เดิม → **ไม่ต้องแก้ render**

ค่า threshold/ความเหมือนใช้ของ `searchFacesBySimilarFaceId` เดิม (เท่ากับ flow ซ่อนบุคคล) — ไม่ตั้งใหม่

## UI

- **จุดเข้า (⋮ menu):** เพิ่ม `MenuItem` "ดูเฉพาะรูปของคนนี้" — แสดงเมื่อ `photo.face_details.length > 0` (guard เดียวกับ "ซ่อนบุคคล") เปิด picker `mode="filter"`
- **Active-filter chip:** แถบเหนือ grid (ใกล้แถว filter จำนวนหน้า) แสดงเมื่อ `personFilter !== null`:
  - thumbnail หน้าที่เลือก — crop จาก `sourceUrl` + `bbox` (div + background-position/size หรือ img ใน container ที่ clip ด้วย bbox %)
  - ข้อความ `กรองตามใบหน้า · เจอ {visible.length} รูป` — นับ **จำนวนที่แสดงจริงหลังกรองทุกชั้น** (tab + จำนวนหน้า + personFilter) ไม่ใช่ขนาด `photoIds` ดิบ เพื่อให้ตรงกับสิ่งที่ตาเห็น
  - ปุ่ม ✕ → `setPersonFilter(null)`
- **Empty state:** ถ้า intersect แล้วเหลือ 0 (เช่นอยู่ tab ไม่เผยแพร่ แต่คนนั้นไม่มีรูปซ่อน) → reuse `EmptyState` เดิม + ข้อความสื่อว่ามาจากตัวกรองใบหน้า

## Component / State Changes (touch points)

1. **[`_person-ban-modal.tsx`](../../../app/dashboard/events/[id]/_person-ban-modal.tsx)** — generalize `PersonPickerModal`:
   - `mode: "hide" | "unhide" | "filter"`
   - prop ใหม่ `onApplyFilter?(payload)` (ใช้เมื่อ `mode="filter"`)
   - เมื่อ `mode="filter"`: `pickFace` → resolve → เรียก `onApplyFilter` + `onClose` (ข้าม `FaceMatchPreviewModal`)
   - flow ซ่อน/แสดงเดิมไม่เปลี่ยนพฤติกรรม
2. **[`_photo-gallery.tsx`](../../../app/dashboard/events/[id]/_photo-gallery.tsx)**:
   - state `personFilter` + setter
   - ชั้นกรองใน `visible`
   - chip UI
   - reset: รวม `personFilter?.faceId` เข้า reset key เดิม (`${tab}|${faceFilter}`) เพื่อ reset `activePhotoIdx` ตอน `visible` เปลี่ยน
   - callback `onApplyPersonFilter` drill: `PhotoGallery → GridCard/ListRow → PhotoMenu → PersonPickerModal(onApplyFilter)`
3. **[`lib/actions/blacklist.ts`](../../../lib/actions/blacklist.ts)** — ไม่แก้ (reuse `findMatchingFacesByFaceId`)
4. ไม่มี migration / ไม่แตะ `lib/supabase/types.ts`

## Composition & Edge Cases

- **compose orthogonal:** personFilter ทำงานร่วม tab (ทั้งหมด/ไม่เผยแพร่) และ filter จำนวนหน้า — intersect กันหมด
- **tab behavior (ผลพลอยได้ที่ดี):** filter เก็บเป็น `photoId` ข้าม tab → tab "ทั้งหมด" เห็นรูปคนนั้นที่ไม่ซ่อน, tab "ไม่เผยแพร่" เห็นรูปคนนั้นที่ซ่อน. filter คงอยู่จนกด ✕
- **0 ใบหน้า:** ไม่มีเมนู (guard)
- **อย่างน้อย 1 ผล:** resolver รวม `sourceFaceId` เสมอ → อย่างน้อยรูปต้นทาง match
- **Rekognition stub (ไม่มี env, local):** `searchFacesBySimilarFaceId` คืน `[]` → เหลือแค่ `sourceFaceId` → กรองเหลือรูปต้นทาง 1 รูป (degrade graceful ตาม convention)
- **คลิกหน้าเดิมซ้ำใน session:** cache ผลลัพธ์ใน client state keyed by `faceId` (optional, กัน re-call Rekognition)

## Extension Seams → Person Archive (ไม่ทำตอนนี้)

- **resolver = หน่วยงานเดียวกัน:** `findMatchingFacesByFaceId` คือ "resolve face → photos ใน 1 event" = primitive ที่ matching engine ของ Person Archive ใช้ (แค่ loop ทุก event) → promote ไป `lib/people/` ตอนนั้น
- **chip = ที่วางปุ่ม "บันทึกเป็นบุคคล":** ภายหลังกดเพื่อสร้าง `people` + `person_reference_faces`
- **payload shape ตรง spec:** `{ faceId, sourcePhotoId, bbox }` = field ของ `person_reference_faces` (`source='tagged'`, `source_photo_id`, `bbox`) เป๊ะ → enrollment ต่อยอดได้ทันที

## Risks / Cost

- **Rekognition cost:** 1 `SearchFaces` ต่อการเลือกหนึ่งหน้า (เท่า flow ซ่อนบุคคล) — usage ระดับ dashboard จัดการรูปนานๆ ที = รับได้; cache by faceId ช่วยลด
- **Prop drilling:** callback ลอดผ่าน GridCard/ListRow → PhotoMenu (มี pattern เดิมอยู่แล้ว) — ยอมรับได้
- **bbox alignment:** ใช้ picker เดิม (`w-fit`) ที่จัด bbox ถูกแล้ว → ไม่มีปัญหา letterbox (ต่างจากกรณี lightbox ที่ตัดออก)

## Verification (ไม่เน้น unit test)

logic ใหม่เป็น set-intersection ล้วน — ทดสอบหลักผ่านแอปจริง (preview workflow):
1. เปิดเมนู ⋮ → "ดูเฉพาะรูปของคนนี้" → จิ้มหน้า → grid แคบลงเหลือคนนั้น + chip โชว์จำนวน
2. compose: สลับ tab / filter จำนวนหน้า แล้ว personFilter ยังถูก
3. กด ✕ → กลับมาทั้งหมด
4. รูป 0 หน้า → ไม่มีเมนู
5. (local ไม่มี Rekognition env) → เหลือรูปต้นทาง = degrade ตามคาด

(option) ถ้าอยาก unit test: แยก `deriveVisible(tabPhotos, faceFilter, personFilter)` เป็น pure function แล้วเทสด้วย Vitest

## Rough Phases (สำหรับ writing-plans แตกต่อ)

1. **Picker** — generalize `PersonPickerModal` → `mode="filter"` + `onApplyFilter` (ข้าม stage 2)
2. **Gallery state** — `personFilter` + ชั้นกรอง `visible` + reset wiring
3. **Entry + drill** — ⋮ menu item + thread `onApplyPersonFilter` ลงไป PhotoMenu
4. **Chip** — active-filter chip (thumb crop + count + ✕)
5. **Verify in app** — preview workflow ตาม checklist ข้างบน
