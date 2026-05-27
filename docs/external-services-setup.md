# External Services Setup (Issue #2)

ขั้นตอนสำหรับสมัครและตั้งค่า services ภายนอกที่ Phase 1 ต้องใช้ — ตามลำดับนี้ใช้เวลารวมประมาณ **1–2 ชั่วโมง** (ไม่รวมรอ verify ของ Google)

หลังตั้งค่าเสร็จแต่ละ service ให้ copy key/secret ไปใส่ใน `.env.local` ตาม [`.env.example`](../.env.example) (อย่า commit `.env.local`)

| Service | สถานะ | Used by |
|---|---|---|
| AWS Rekognition | ✅ คุณทำแล้ว | Face indexing & search (#7, #10) |
| Cloudflare R2 | ⏳ | Photo + selfie storage (#7, #10, #13) |
| Google Cloud OAuth | ⏳ | Drive integration (#7) |
| Bank / PromptPay | ⏳ | รับโอนตอน topup credit (#13) |

---

## 1. AWS Rekognition — ตรวจสอบหลังสมัครแล้ว

คุณบอกว่าสมัคร AWS แล้ว — ขอเช็คสิ่งที่ต้องมีให้ครบสำหรับ Phase 1

### ✅ สิ่งที่ต้องตรวจ

1. **IAM user แยกจาก root** (ห้ามใช้ root access key):
   - ไปที่ AWS Console → IAM → Users → **Create user**
   - Username: `pixpresent-rekognition`
   - **ไม่ต้อง** enable Console access
   - Permissions → Attach policies → `AmazonRekognitionFullAccess`
   - หลังสร้างเสร็จ → Security credentials tab → **Create access key** (use case: "Application running outside AWS")

2. **Region** — แนะนำ `ap-southeast-1` (Singapore) สำหรับ latency จากไทย
   - Rekognition ใช้ได้ทุก region แต่ Collection ผูกกับ region ที่สร้าง

3. **ใส่ลง `.env.local`:**
   ```bash
   AWS_REGION=ap-southeast-1
   AWS_ACCESS_KEY_ID=AKIA...
   AWS_SECRET_ACCESS_KEY=...
   ```

### 💰 Cost note
- Free tier: 5,000 ภาพ/เดือน 12 เดือนแรก
- หลังจากนั้น: $1 ต่อ 1,000 ภาพ indexed + $1 ต่อ 1,000 search
- 1 event 500 รูป + 50 guest search ≈ **$0.55**

---

## 2. Cloudflare R2 — Storage + CDN (สำคัญที่สุด, ฟรี egress)

R2 เก็บรูป + selfie + slip image. ต่างจาก S3 ตรงที่ **egress ฟรี** ทั้งหมด — ประหยัด cost มหาศาลตอน guest โหลดรูป

### ขั้นตอน

#### 2.1 สมัคร / login Cloudflare
- ไป <https://dash.cloudflare.com/sign-up> (ถ้ายังไม่มี account)
- ตั้ง 2FA ทันที (Security → Authentication)

#### 2.2 เปิดใช้ R2 (ต้องใส่ payment method)
- Dashboard → **R2 Object Storage** (เมนูซ้าย)
- กด **Purchase R2** — ต้อง add credit card / debit card แต่
  - Free tier: 10 GB storage + 1M Class A ops + 10M Class B ops/เดือน
  - Phase 1 อยู่ใน free tier แน่นอน

#### 2.3 สร้าง bucket
- R2 → **Create bucket**
- Name: `pixpresent-photos` (ต้องเป็น lowercase + hyphens)
- Location hint: `Asia-Pacific (APAC)`
- กด Create

#### 2.4 สร้าง API token (Access Key)
- R2 → **Manage R2 API Tokens** (ขวาบน)
- กด **Create API token**
- Token name: `pixpresent-app`
- Permissions: **Object Read & Write**
- Specify bucket: `pixpresent-photos`
- TTL: Forever
- กด Create → **เก็บค่าทันที** (โชว์ครั้งเดียว):
  - Access Key ID
  - Secret Access Key
  - Endpoint (S3-compatible) เช่น `https://<account_id>.r2.cloudflarestorage.com`

#### 2.5 หา Account ID
- R2 → Overview → ขวามือบนสุดมี **Account ID** — copy เก็บไว้

#### 2.6 เปิด public URL (ใช้สำหรับ CDN serve รูป)
- Bucket → **Settings** tab → **Public access** section
- กด **Allow Access** ใต้ "R2.dev subdomain"
- จะได้ URL `https://pub-<hash>.r2.dev` — นี่คือ public URL

**Production tip:** ภายหลังควรผูก custom domain (เช่น `cdn.pixpresent.app`) เพื่อ control + caching ที่ดีกว่า — ทำใน Settings → Custom Domains

#### 2.7 ใส่ลง `.env.local`
```bash
R2_ACCOUNT_ID=<from step 2.5>
R2_ACCESS_KEY_ID=<from step 2.4>
R2_SECRET_ACCESS_KEY=<from step 2.4>
R2_BUCKET_NAME=pixpresent-photos
R2_PUBLIC_URL=https://pub-<hash>.r2.dev
```

---

## 3. Google Cloud OAuth — Drive integration

ช่างภาพอัพรูปเข้า Google Drive folder ของตัวเอง → share folder ให้ organizer → organizer connect Google account ผ่าน OAuth → ระบบดึงรูปออกมา index

### ขั้นตอน

#### 3.1 สร้าง Google Cloud project
- ไป <https://console.cloud.google.com>
- ขวาบน → New Project
- Name: `pixpresent` (หรือชื่ออะไรก็ได้)
- กด Create

#### 3.2 Enable Google Drive API
- Project → **APIs & Services** → **Library**
- ค้นหา "Google Drive API" → กดเข้า → **Enable**

#### 3.3 ตั้งค่า OAuth consent screen
- APIs & Services → **OAuth consent screen**
- User type: **External** (ถ้าไม่ใช่ Google Workspace) → Create
- App information:
  - App name: `PixPresent`
  - User support email: (อีเมลของคุณ)
  - App logo: skip (เพิ่มภายหลัง)
- App domain → skip
- Developer contact email: (อีเมลของคุณ)
- กด Save and continue
- Scopes → Add or remove scopes → ค้น `drive.readonly` → ติ๊กเลือก → Update → Save
- Test users → Add users → ใส่อีเมล Google ของคุณ (จำเป็นช่วง testing mode)
- Save and continue → Back to dashboard

**Note:** ตอนนี้ app อยู่ใน "Testing" mode — รับได้สูงสุด 100 test users. ก่อน production ต้องกด **Publish App** + อาจต้อง verify (drive.readonly ไม่ใช่ sensitive scope สูง น่าจะไม่ต้อง verify วิดีโอ)

#### 3.4 สร้าง OAuth Client ID
- APIs & Services → **Credentials** → **Create credentials** → **OAuth client ID**
- Application type: **Web application**
- Name: `PixPresent Web`
- Authorized JavaScript origins:
  - `http://localhost:3000`
  - `http://localhost:3001` (เผื่อ fallback port)
- Authorized redirect URIs:
  - `http://localhost:3000/api/auth/google/callback`
  - `http://localhost:3001/api/auth/google/callback`
- (Production เพิ่ม) `https://yourdomain.com` + `https://yourdomain.com/api/auth/google/callback`
- กด Create → modal โชว์ Client ID + Client Secret

#### 3.5 ใส่ลง `.env.local`
```bash
GOOGLE_CLIENT_ID=<long string ending in .apps.googleusercontent.com>
GOOGLE_CLIENT_SECRET=<starts with GOCSPX->
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
```

---

## 4. Bank Account + PromptPay QR (สำหรับ #13 Credit Topup)

Phase 1 ไม่มี payment gateway อัตโนมัติ — organizer โอนเงินมาที่บัญชี FaceFind แล้วอัพ slip → super admin verify (deferred Omise ไป #B-04)

### สิ่งที่ต้องเตรียม

1. **บัญชีรับโอน** — ใช้บัญชีบุคคลธรรมดาก่อนได้ (เปิดบริษัทตอน scale)
   - แนะนำเปิดบัญชีแยกจากบัญชีส่วนตัว เพื่อความสะอาดของบัญชี
   - บันทึก: เลขที่บัญชี, ชื่อบัญชี, ธนาคาร, สาขา

2. **PromptPay**
   - ผูก PromptPay กับเบอร์โทร / เลขประจำตัวประชาชนของบัญชีรับโอน
   - **Static QR code:** generate ได้ฟรีที่ <https://promptpay.io>
     - หรือ <https://www.scb.co.th/th/personal-banking/digital-banking/promptpay/qr.html> (ธนาคารส่วนใหญ่มี)
   - บันทึก QR เป็นไฟล์ `.png` หรือ `.svg` ขนาดอย่างน้อย 600x600px
   - **เก็บไว้ที่ไหน:** วางใน R2 bucket folder `/static/promptpay-qr.png` จะแสดงตอน organizer topup

3. **ใส่ลง `.env.local`** (ไม่ใช่ secret แต่เก็บไว้ที่เดียวกัน)
   ```bash
   # ใช้แสดงในหน้า topup
   BANK_NAME=
   BANK_ACCOUNT_NUMBER=
   BANK_ACCOUNT_NAME=
   PROMPTPAY_QR_URL=
   ```

   จะเพิ่ม keys เหล่านี้เข้า `.env.example` ตอนทำ #13

4. **Super admin email** — สำหรับรับ notification เมื่อมี slip pending ใหม่
   ```bash
   SUPER_ADMIN_EMAIL=you@example.com
   ```

---

## Checklist สรุปสำหรับ #2

หลังทำครบทุกอันแล้วเช็คสิ่งเหล่านี้:

- [ ] `.env.local` มีค่าจริงครบ 11 keys (AWS×3, R2×5, Google×3) + bank info
- [ ] รัน `npm run dev` → หน้า health page ยังขึ้น OK ทั้ง 2 row
- [ ] (ภายหลัง) ทดสอบ R2 ผ่าน AWS SDK / S3 client ว่า upload ได้จริง
- [ ] (ภายหลัง) ทดสอบ Google OAuth flow ว่า redirect callback ทำงาน
- [ ] บันทึก URL console ของแต่ละ service ในที่ปลอดภัย (1Password / Notion):
  - AWS IAM: <https://console.aws.amazon.com/iam>
  - Cloudflare R2: <https://dash.cloudflare.com/?to=/:account/r2>
  - Google Cloud Console: <https://console.cloud.google.com>

---

## ลำดับแนะนำ

ทำตามลำดับนี้จะลื่นที่สุด:

1. **R2 ก่อน** (ใช้ใน #7 sync, #10 selfie, #13 slip) — มี payment method แล้วเริ่มได้ทันที
2. **Google OAuth** (ใช้ใน #7 sync) — ทำได้ช้าหน่อยถ้าต้อง verify scope
3. **PromptPay/บัญชี** (ใช้ใน #13/#14 topup) — ทำเสร็จก่อน implement #13 ก็ได้

ทำคู่ขนานกับ #4–#11 ได้ (ตัวที่ใช้ external services จริงเริ่มที่ #7)
