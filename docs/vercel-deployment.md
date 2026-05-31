# Vercel Deployment

คู่มือ deploy PixPresent / FaceFind ขึ้น Vercel โดยเชื่อม GitHub repo แบบ auto-deploy
(push → build → deploy อัตโนมัติ)

> **หมายเหตุ:** Production ต้องใช้ **Supabase cloud project** (ไม่ใช่ local stack),
> และ external services (AWS Rekognition, R2, Google Drive OAuth, SlipOK, Resend)
> ตั้งค่าตาม [`external-services-setup.md`](./external-services-setup.md). หาก env var
> ของ service ไหนว่าง โค้ดจะ stub ให้ — แอป build/รันได้ แต่ feature นั้นจะไม่ทำงานจริง.

---

## 1. Prerequisites

- บัญชี [Vercel](https://vercel.com) (เชื่อมกับ GitHub account ที่เป็นเจ้าของ repo)
- **Supabase cloud project** — สร้างที่ <https://supabase.com/dashboard> แล้ว push migrations
  ใน `supabase/migrations/` ขึ้น project นั้น:
  ```bash
  supabase link --project-ref <your-project-ref>
  supabase db push          # apply ทุก migration ขึ้น cloud
  ```
- External service credentials พร้อม (ดูตาราง env vars ด้านล่าง)

---

## 2. Import repo เข้า Vercel

1. ไปที่ <https://vercel.com/new>
2. **Import** repo `Aworanut/PixPresent`
3. Vercel จะ auto-detect เป็น **Next.js** — ปล่อย build settings เป็นค่า default:
   - Framework Preset: **Next.js**
   - Build Command: `next build` (default)
   - Output: ปล่อยว่าง (Vercel จัดการเอง)
   - Install Command: `npm install` (default)
4. **อย่าเพิ่งกด Deploy** — ใส่ Environment Variables (ขั้นถัดไป) ก่อน ไม่งั้น build แรกจะ deploy ด้วยค่าว่าง

> Branch ที่ Vercel ตั้งเป็น Production คือ `main` (ค่า default). Push ขึ้น `main` → deploy production;
> push branch อื่น/เปิด PR → ได้ Preview deployment อัตโนมัติ.

---

## 3. Environment Variables

ตั้งค่าใน **Vercel → Project → Settings → Environment Variables** (เลือก scope: Production / Preview ตามต้องการ).
ค่าอ้างอิงดูใน [`.env.example`](../.env.example).

| Variable | Required | หมายเหตุสำหรับ production |
|---|:--:|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | URL ของ Supabase **cloud** project (Settings → API) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | anon/publishable key ของ cloud project |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | service_role key (server-only, ห้ามขึ้น client) |
| `NEXT_PUBLIC_APP_URL` | ✅ | โดเมน production เต็ม เช่น `https://pixpresent.app` |
| `AWS_REGION` | ✅* | เช่น `ap-southeast-1` (จำเป็นถ้าจะใช้ face search/index) |
| `AWS_ACCESS_KEY_ID` | ✅* | IAM key สำหรับ Rekognition |
| `AWS_SECRET_ACCESS_KEY` | ✅* | |
| `R2_ACCOUNT_ID` | ✅* | Cloudflare R2 (จำเป็นถ้าจะเก็บ/แสดงรูปจริง) |
| `R2_ACCESS_KEY_ID` | ✅* | |
| `R2_SECRET_ACCESS_KEY` | ✅* | |
| `R2_BUCKET` | ✅* | เช่น `pixpresent-photos` |
| `R2_PUBLIC_URL` | ✅* | custom domain หรือ `https://pub-<hash>.r2.dev` — **ต้องตรงกับ `next.config.ts` images.remotePatterns** |
| `GOOGLE_CLIENT_ID` | ✅* | OAuth client (จำเป็นถ้าจะ sync จาก Drive) |
| `GOOGLE_CLIENT_SECRET` | ✅* | |
| `GOOGLE_REDIRECT_URI` | ✅* | **ต้องเป็นโดเมน production:** `https://<domain>/auth/google/callback` และเพิ่ม URI เดียวกันใน Google Cloud Console → Credentials → Authorized redirect URIs |
| `SLIPOK_API_URL` | ⬜ | endpoint จาก SlipOK dashboard (ถ้าว่าง slip จะค้างเป็น `pending` ให้ admin ตรวจมือ) |
| `SLIPOK_API_TOKEN` | ⬜ | bearer token (แนะนำสำหรับ production) |
| `RESEND_API_KEY` | ⬜ | สำหรับอีเมล transactional/แจ้งเตือน |
| `RESEND_FROM_EMAIL` | ⬜ | เช่น `noreply@pixpresent.app` (ต้อง verify โดเมนใน Resend) |
| `SUPER_ADMIN_EMAILS` | ✅ | อีเมล super-admin คั่นด้วย comma สำหรับเข้า `/admin` |
| `CRON_SECRET` | ✅ | สุ่มค่า random ยาวๆ — ใช้ป้องกัน endpoint cron (Vercel ส่งใน `Authorization: Bearer`) |

\* = จำเป็นต่อ feature หลักของแอป (ถ้าเว้นว่าง feature นั้นจะ stub/ไม่ทำงาน แต่แอปยัง build/รันได้)

สุ่ม `CRON_SECRET`:
```bash
openssl rand -hex 32
```

---

## 4. Cron jobs

`vercel.json` ตั้ง cron ไว้แล้ว:

| Path | Schedule (UTC) | ทำอะไร |
|---|---|---|
| `/api/cron/cleanup-collections` | `0 19 * * *` (= 02:00 เวลาไทย) | ลบ Rekognition collection ของ event ที่พ้น retention window + 7 วัน |

- Vercel จะส่ง `Authorization: Bearer <CRON_SECRET>` ให้อัตโนมัติ ต้องตั้ง `CRON_SECRET` ให้ตรงกัน
- **Hobby plan รองรับ cron วันละครั้ง** — schedule นี้รายวันจึงใช้ได้; ถ้าต้องการถี่กว่านี้ต้องใช้ Pro

---

## 5. Function timeouts

`vercel.json → functions` ตั้ง `maxDuration: 60` ให้ route ที่ทำงานหนัก:

- `/api/events/[id]/sync` — ดาวน์โหลด Drive → resize (sharp) → upload R2 → Rekognition index (SSE stream)
- `/api/download/zip` — สตรีม zip รูปหลายไฟล์
- `/api/cron/cleanup-collections`

> **ข้อจำกัดตาม plan:** Hobby cap ที่ **60s**, Pro cap ที่ **300s**. ถ้าอยู่ Pro และ event
> มีรูปจำนวนมาก สามารถเพิ่ม `maxDuration` ของ sync route เป็นถึง `300` ได้.

---

## 6. หลัง deploy ครั้งแรก

1. รอ build เสร็จ → เปิดโดเมน production ตรวจหน้า landing
2. **อัปเดต `NEXT_PUBLIC_APP_URL` และ `GOOGLE_REDIRECT_URI`** ให้เป็นโดเมนจริงที่ Vercel ออกให้ (หรือ custom domain) แล้ว redeploy
3. เพิ่ม redirect URI เดียวกันใน **Google Cloud Console**
4. ใน **Supabase → Authentication → URL Configuration** ตั้ง Site URL + Redirect URLs ให้ตรงโดเมน production (สำหรับ email confirm / OAuth callback)
5. ทดสอบ flow หลัก: signup → สร้าง event → sync → เปิด share link → อัป selfie → ค้นเจอรูป
6. ทดสอบ cron แบบ manual:
   ```bash
   curl -H "Authorization: Bearer $CRON_SECRET" https://<domain>/api/cron/cleanup-collections
   ```

---

## 7. Troubleshooting

- **Build ผ่าน local แต่ fail บน Vercel** — มักเป็นเพราะ env var ขาด ตอน build/runtime. ตรวจ Vercel → Deployments → Logs
- **รูปไม่ขึ้น (Next/Image error)** — `R2_PUBLIC_URL` ต้องตรงกับ `images.remotePatterns` ใน `next.config.ts`; โดเมน custom ของ R2 ถูกดึงจาก env var นี้ตอน build จึงต้องตั้งก่อน build
- **Google OAuth redirect mismatch** — `GOOGLE_REDIRECT_URI` (Vercel) ต้องตรงเป๊ะกับ Authorized redirect URI ใน Google Cloud Console
- **Cron คืน 401** — `CRON_SECRET` บน Vercel ไม่ตรง/ไม่ได้ตั้ง
- **Server Action body ใหญ่เกิน** — `next.config.ts` ตั้ง `serverActions.bodySizeLimit = 10mb` ไว้แล้ว (สำหรับอัปรูป/slip)
