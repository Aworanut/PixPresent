// lib/payment-config.ts
// Payment & top-up configuration for PixPresent
// อัพเดทตัวเลขที่นี่เมื่อเปลี่ยนแปลง pricing

// ---------------------------------------------------------------------------
// Bank account for receiving transfers
// ---------------------------------------------------------------------------
export const BANK_INFO = {
  bankName: "กสิกรไทย (KBank)",
  accountName: "นาย วรณัฐ อัครปรีดี",
  accountNumber: "070-8-10350-0",
  promptPayRef: "0049990044528064",
  qrImagePath: "/images/payment-qr.jpeg",
} as const;

// ---------------------------------------------------------------------------
// Top-up packages (1 credit = 1 THB)
// ---------------------------------------------------------------------------
export type TopupPackageId = "pack_199" | "pack_499" | "pack_999" | "custom";

export type TopupPackage = {
  id: TopupPackageId;
  credits: number;
  priceThb: number;
  label: string;
  highlight?: boolean; // แสดง badge "แนะนำ"
};

export const TOPUP_PACKAGES: TopupPackage[] = [
  {
    id: "pack_199",
    credits: 199,
    priceThb: 199,
    label: "199 Credits",
  },
  {
    id: "pack_499",
    credits: 499,
    priceThb: 499,
    label: "499 Credits",
    highlight: true, // Gallery sweet spot
  },
  {
    id: "pack_999",
    credits: 999,
    priceThb: 999,
    label: "999 Credits",
  },
];

export const CUSTOM_TOPUP = {
  minThb: 199,
  maxThb: 99_999,
} as const;

// ---------------------------------------------------------------------------
// SlipOK API (slip auto-verification)
// ใส่ใน .env.local: SLIPOK_API_KEY=67363  (ตัวเลขท้าย URL จาก dashboard)
// URL จริง: https://api.slipok.com/api/line/apikey/{SLIPOK_API_KEY}
// ---------------------------------------------------------------------------
export function getSlipOkUrl(): string {
  const url = process.env.SLIPOK_API_URL;
  if (!url) throw new Error("SLIPOK_API_URL is not set");
  return url;
}
