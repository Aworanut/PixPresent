# Plan Tier Design

**Date:** 2026-05-28  
**Status:** Approved  
**Related issues:** #12, #13, #14, #B-06

---

## Overview

ระบบ tier แบบ per-event ที่ใช้ credit เป็น currency (1 credit = 1 THB) แทน payment gateway ใน Phase 1

---

## Event Tiers

| | Starter | Gallery | Studio |
|---|---|---|---|
| Storage | 5 GB | 20 GB | 50 GB |
| Link active | 3 วัน | 5 วัน | 7 วัน |
| Data retention | 7 วัน | 14 วัน | 30 วัน |
| Highlight reel | — | — | ✓ |
| **Credit cost** | **199** | **499** | **999** |

**Pricing rationale:** Charm pricing (199/499/999 ใต้ threshold 200/500/1000) — Gallery คือ target purchase, Studio เป็น anchor

---

## Credit Model

- **1 credit = 1 THB** — transparent, ลูกค้าเข้าใจทันที
- Tier อยู่ที่ระดับ **event** ไม่ใช่ tenant — แต่ละงานเลือก tier อิสระตามขนาดงาน
- Credit เก็บใน `tenants.credit_balance` — ซื้อเข้า spend ออก, บันทึก audit ใน `credit_ledger`

---

## Onboarding

- สมัครใหม่ได้ **199 credits ฟรี** ทันที (= 1 Starter event)
- สื่อสารง่าย: "สมัครวันนี้รับ 1 event ฟรี"
- implement: INSERT credit_ledger row (reason='welcome_bonus', delta=+199) ตอน tenant signup trigger

---

## Feature Gating

| Feature | Gate |
|---|---|
| Starter / Gallery / Studio events | Credit balance ≥ tier cost |
| Highlight reel (Phase 2) | Event tier = Studio |
| Commerce / ขายรูป (Phase 2) | tenant.plan = paid (Phase B-06) |

---

## Schema Changes Required

### events table — เพิ่ม column
```sql
alter table public.events
  add column tier text not null default 'starter'
    check (tier in ('starter', 'gallery', 'studio')),
  add column storage_limit_gb integer not null default 5,
  add column link_active_days integer not null default 3,
  add column data_retention_days integer not null default 7;
```

### tenants table — ปรับ plan constraint
- `tenant.plan` ยังเก็บไว้ (ค่า default `'free'`)
- Phase 1: ทุก tenant = `'free'` (pay-as-you-go)
- Phase B-06: เพิ่ม paid plan values สำหรับ subscription model

### ลบ plan column ออกจาก events
- `events` ไม่มี `plan` (ใช้ `tier` แทน)

---

## Credit Package Reference (ประกอบ #12)

| Package | Credits | Price (THB) |
|---|---|---|
| TBD — ดู #12 | | |

Welcome bonus = 199 credits (ตั้ง hardcode ใน `lib/credit-packages.ts`)

---

## Deferred to Phase 2+

| Feature | Phase | Notes |
|---|---|---|
| Campaign / discount system | Phase 2 | ต้องการ admin campaign UI + checkout hook |
| tenant.plan paid tiers | Phase B-06 | Subscription model คล้าย AI sub pricing |
| Commerce gating via tenant.plan | Phase B-06 | ผูกกับ paid tenant plan |

---

## Cost Benchmark (ต้นทุนจริงต่อ event)

| | Starter | Gallery | Studio |
|---|---|---|---|
| AWS Rekognition | ~$0.25 | ~$0.65 | ~$1.30 |
| Cloudflare R2 | ~$0.02 | ~$0.13 | ~$0.50 |
| **รวม THB** | **~10** | **~27** | **~63** |
| Margin | ~19x | ~18x | ~16x |

Rekognition เป็น dominant cost — สมมติ 200/500/1,000 รูป และ 50/150/300 guest searches
