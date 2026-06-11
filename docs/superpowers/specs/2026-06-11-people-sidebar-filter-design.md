# People Sidebar Filter — "คนในงานนี้" (Design Spec)

- **Date:** 2026-06-11
- **Status:** Approved (design) — pending implementation plan
- **Scope:** PixPresent · organizer event gallery · single-event · reuse-only (no schema)
- **Related:** [Gallery Face Filter #22](2026-06-04-gallery-face-filter-design.md), Person Archive (`photo_people`), [Archive Folder Browse](2026-06-11-archive-folder-browse-design.md)

---

## Background / Problem

(TH) Person Archive จับคู่รูปกับคนที่ตั้งชื่อไว้แล้ว (`photo_people` status='confirmed') แต่ในหน้างาน วิธีกรอง "เฉพาะรูปของคนนี้" ตอนนี้ทำได้แค่ผ่านเมนู ⋮ → จิ้มหน้า (#22) ซึ่งซ่อนและต้องยิง Rekognition ทุกครั้ง ผู้ใช้อยากเห็น **รายชื่อคนในงานพร้อมกดกรองได้ทันที** เป็น sidebar ขวา

## Goals

1. **Sidebar ขวาในหน้างาน** แสดงรายชื่อ **คนที่ตั้งชื่อแล้ว** ที่พบในงานนี้ + จำนวนรูปยืนยันแล้ว เรียงมาก→น้อย
2. **กดชื่อ → กรอง grid เหลือเฉพาะรูปคนนั้นทันที** (อ่านจาก `photo_people` ที่มีอยู่ — ไม่ยิง AI ใหม่)
3. **ทีละ 1 คน** · กดซ้ำ/กด "ทั้งหมด"/กด ✕ ที่ chip = ยกเลิก
4. **รวมร่างกับตัวกรอง #22 เดิม** เป็นตัวกรองบุคคลตัวเดียว — ไม่ให้มี filter ซ้อนกันสองชนิด
5. **ไม่มีคนตั้งชื่อ → ซ่อน sidebar ทั้งแถบ** (SaaS / งานที่ยังไม่ enroll ไม่เห็นอะไรเปลี่ยน)

## Non-Goals

- เลือกหลายคนพร้อมกัน (intersection/union) — ทีละ 1 คน
- คนที่ยังไม่ตั้งชื่อ / auto-cluster ใบหน้านิรนาม — ไม่ทำ
- จิ้มหน้าใน sidebar / จัดการ roster ในหน้างาน — อยู่หน้า `/dashboard/people` (#26)
- รูป avatar จริงของแต่ละคน — เฟสนี้ใช้วงกลมอักษรย่อ (crop ref-face ค่อยเสริมภายหลัง)
- migration / schema ใหม่ — ข้อมูลครบใน `photo_people` + `people` แล้ว

## Data

หน้างาน ([`page.tsx`](../../../app/dashboard/events/[id]/page.tsx)) query เพิ่ม 1 ชุด (user client → RLS `tenant_id = current_tenant_id()` ครอบให้):

```
photo_people  (event_id = $id, status = 'confirmed')  ⋈ people(name)
→ { personId, name, photoId }[]
```

จัดกลุ่มฝั่ง server เป็น 2 ก้อนส่งเข้า `PhotoGallery`:
- `eventPeople: { id, name, count }[]` — เรียง count มาก→น้อย (รายการ sidebar)
- `photoIdsByPerson: Record<personId, string[]>` — แมปไว้ให้คลิกแล้ว set filter โดยไม่ต้อง round-trip

ปริมาณจริง (รูปหลักร้อย–พัน × คนหลักสิบ) = ดึงทีเดียวพอ ไม่ต้อง paginate/lazy

## Unified person filter (รวม #22)

ปัจจุบัน gallery มี `personFilter: FilterPayload | null` (จากจิ้มหน้า: `faceId/bbox/sourceUrl/photoIds`). **Generalize เป็นตัวกรองบุคคลตัวเดียว** ที่ทั้งจิ้มหน้า + sidebar ป้อนได้:

```ts
type ActivePersonFilter = {
  key: string;                 // reset key (faceId หรือ personId) — แทน personFilter?.faceId
  label: string;               // ข้อความบน chip: ชื่อคน หรือ "ใบหน้าที่เลือก"
  photoIds: Set<string>;
  face?: { sourceUrl: string | null; bbox: { left; top; width; height } }; // มีเฉพาะ flow จิ้มหน้า → chip โชว์ thumbnail
} | null;
```

- `visible` filter: `!f || f.photoIds.has(p.id)` (เหมือนเดิม)
- `tabFilterKey`: ใช้ `f?.key ?? ""` แทน `personFilter?.faceId`
- chip: ถ้า `f.face` → crop thumbnail เดิม; ถ้าไม่มี → จุด/ชื่อ; ทั้งคู่โชว์ `{f.label} · เจอ {visible.length} รูป ✕`
- จิ้มหน้า (#22 `onApplyFilter` → FilterPayload) map เป็น `{ key: faceId, label: "ใบหน้าที่เลือก", photoIds, face: {sourceUrl, bbox} }`
- sidebar คลิกคน → `{ key: personId, label: name, photoIds: new Set(photoIdsByPerson[id]) }`
- intersect กับ tab + folder path + face-count เหมือนเดิมทุกประการ (เข้า pipeline `visible` ตัวเดียว)

> ผลพลอยได้: รวม filter เป็นชนิดเดียว ลดความซ้ำซ้อน ตรงกับที่ #22 spec เขียนไว้ว่าเป็น precursor ของ person archive

## UI

- **Component ใหม่** `_people-sidebar.tsx` (client): รับ `eventPeople` + `activeKey` + `onSelect(personId|null)`
  - หัว "บุคคลในงานนี้" · แถว "ทั้งหมด" (เคลียร์ filter) · แต่ละคน = วงกลมอักษรย่อ + ชื่อ + count · คนที่เลือกไฮไลต์ทอง
- **Desktop (≥ lg):** sidebar sticky ฝั่งขวาของ gallery (เช่น grid 2 คอลัมน์: เนื้อหา + `w-60` sidebar) แสดงเมื่อ `eventPeople.length > 0`
- **Mobile:** ย่อเป็นแถวชิปเลื่อนแนวนอน (`overflow-x-auto`) เหนือ grid — ไม่มีที่พอทำ sidebar
- ทั้งสองโหมดผูกกับ `ActivePersonFilter` ตัวเดียวกับ chip + เมนู ⋮

## Touch points

1. [`page.tsx`](../../../app/dashboard/events/[id]/page.tsx) — query `photo_people⋈people` + ส่ง `eventPeople` / `photoIdsByPerson`
2. [`_photo-gallery.tsx`](../../../app/dashboard/events/[id]/_photo-gallery.tsx) — generalize `personFilter`→`activeFilter`; render sidebar (desktop) / chip row (mobile); map จิ้มหน้า + sidebar เข้า filter เดียว
3. **Create** `_people-sidebar.tsx` — แถบรายชื่อ (desktop sidebar + mobile chip row ในไฟล์เดียว, รับ prop เดียวกัน)

## Risks

- **Layout จอใหญ่:** เพิ่ม sidebar = ต้องห่อ gallery ใน 2-col container; ระวัง lightbox/bulk bar (full-width เดิม) ไม่เพี้ยน → sidebar อยู่นอก flow ของ grid, คุมด้วย container ชั้นนอก
- **count vs ที่เห็นจริง:** ตัวเลขข้างชื่อ = ยืนยันแล้วทั้งงาน (อาจมากกว่าที่เห็นถ้าอยู่คนละแฟ้ม/tab) — เหมือนพฤติกรรมตัวนับ face-count เดิม (ยอมรับได้); chip โชว์ `เจอ N รูป` = จำนวนหลังกรองจริง
- **pending matches ไม่นับ:** เอาเฉพาะ `status='confirmed'` (รอรีวิวไม่โผล่) — ถูกต้องตาม model

## Verification (แอปจริง)

1. งาน business ที่ enroll+scan แล้ว → เห็น sidebar รายชื่อ + count เรียงถูก
2. กดชื่อ → grid เหลือเฉพาะรูปคนนั้น + chip โชว์ชื่อ+จำนวน · กด "ทั้งหมด"/✕ = กลับ
3. compose: เข้าแฟ้มย่อย/สลับ tab/filter จำนวนหน้า แล้ว filter คนยัง intersect ถูก
4. จิ้มหน้าเมนู ⋮ (#22) ยังทำงาน + ใช้ chip/filter ตัวเดียวกับ sidebar (ไม่ซ้อน)
5. งานที่ไม่มีคนตั้งชื่อ (หรือ SaaS) → ไม่มี sidebar, หน้าเดิมทุกอย่าง
6. มือถือ → แถวชิปแนวนอนแทน sidebar, กดกรองได้

(option) unit test: `groupEventPeople(rows)` → `{eventPeople, photoIdsByPerson}` เป็น pure function

## Rough Phases (สำหรับ writing-plans)

1. **Query + group** — `getEventPeople` ใน `lib/people/queries.ts` (+ pure `groupEventPeople` + test) → ส่งเข้า gallery
2. **Unified filter** — refactor `personFilter`→`activeFilter` ใน gallery (จิ้มหน้าเดิม map เข้า; chip รองรับทั้งสองแบบ)
3. **Sidebar component** — `_people-sidebar.tsx` (desktop + mobile chip row) + ห่อ layout 2-col + wire `onSelect`
4. **Verify in app** — checklist ข้างบน
