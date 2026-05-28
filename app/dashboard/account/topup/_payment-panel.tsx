"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { BANK_INFO } from "@/lib/payment-config";

type SelectedPackage = { id: string; priceThb: number; credits: number };

type Props = {
  selected: SelectedPackage;
};

type UploadResult =
  | { status: "approved"; credits: number; newBalance: number }
  | { status: "pending"; message: string }
  | { status: "error"; message: string };

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: ignore
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="ml-2 rounded-md border border-zinc-200 dark:border-zinc-700 px-2 py-0.5 text-xs text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors whitespace-nowrap"
    >
      {copied ? "✓ คัดลอกแล้ว" : "คัดลอก"}
    </button>
  );
}

export function PaymentPanel({ selected }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);

  const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setFileError("กรุณาเลือกไฟล์สลิป");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setFileError("ไฟล์ต้องมีขนาดไม่เกิน 5 MB");
      return;
    }
    setFileError(null);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("slip_image", file);
      formData.append("package_id", selected.id);
      formData.append("amount_thb", String(selected.priceThb));
      formData.append("credits_claimed", String(selected.credits));

      const res = await fetch("/api/topup/upload-slip", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setResult({ status: "error", message: data.error ?? "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง" });
      } else if (data.status === "approved") {
        setResult({ status: "approved", credits: data.credits, newBalance: data.newBalance });
      } else if (data.status === "pending") {
        setResult({ status: "pending", message: data.message });
      } else {
        setResult({ status: "error", message: "ไม่ได้รับผลลัพธ์ที่ถูกต้อง" });
      }
    } catch {
      setResult({ status: "error", message: "เกิดข้อผิดพลาดในการเชื่อมต่อ" });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Amount to transfer */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-1">
        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
          ยอดโอน
        </p>
        <div className="flex items-center">
          <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            {selected.priceThb.toLocaleString()} THB
          </span>
          <CopyButton value={String(selected.priceThb)} />
        </div>
        <p className="text-xs text-zinc-400 dark:text-zinc-500">
          = {selected.credits.toLocaleString()} Credits
        </p>
      </div>

      {/* QR code */}
      <div className="flex flex-col items-center gap-2">
        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider self-start">
          QR Code
        </p>
        <div className="w-[200px] h-[200px] relative rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800">
          <Image
            src={BANK_INFO.qrImagePath}
            alt="QR code สำหรับชำระเงิน"
            fill
            className="object-contain"
            unoptimized
          />
        </div>
      </div>

      {/* Bank info */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-3">
        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
          ข้อมูลบัญชี
        </p>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-zinc-500 dark:text-zinc-400">ธนาคาร</span>
            <span className="font-medium text-zinc-900 dark:text-zinc-100">{BANK_INFO.bankName}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-zinc-500 dark:text-zinc-400">ชื่อบัญชี</span>
            <span className="font-medium text-zinc-900 dark:text-zinc-100">{BANK_INFO.accountName}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-zinc-500 dark:text-zinc-400">เลขที่บัญชี</span>
            <div className="flex items-center">
              <span className="font-medium text-zinc-900 dark:text-zinc-100">{BANK_INFO.accountNumber}</span>
              <CopyButton value={BANK_INFO.accountNumber} />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-zinc-500 dark:text-zinc-400">PromptPay</span>
            <div className="flex items-center">
              <span className="font-medium text-zinc-900 dark:text-zinc-100">{BANK_INFO.promptPayRef}</span>
              <CopyButton value={BANK_INFO.promptPayRef} />
            </div>
          </div>
        </div>
      </div>

      {/* Slip upload form */}
      {result ? (
        <div className="rounded-xl border p-4 space-y-3">
          {result.status === "approved" && (
            <>
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                ✅ เติม {result.credits.toLocaleString()} Credits สำเร็จ! ยอดคงเหลือ: {result.newBalance.toLocaleString()} cr
              </p>
              <Link
                href="/dashboard"
                className="inline-block text-sm font-medium text-zinc-900 dark:text-zinc-100 underline underline-offset-4 hover:opacity-70 transition-opacity"
              >
                กลับ Dashboard
              </Link>
            </>
          )}
          {result.status === "pending" && (
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
              ⏳ อยู่ระหว่างการตรวจสอบ — ทีมงานจะยืนยันภายใน 24 ชั่วโมง
            </p>
          )}
          {result.status === "error" && (
            <p className="text-sm font-medium text-rose-700 dark:text-rose-400">
              {result.message}
            </p>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="slip-file"
              className="block text-xs font-medium text-zinc-700 dark:text-zinc-300"
            >
              อัปโหลดสลิปการโอนเงิน
            </label>
            <input
              ref={fileInputRef}
              id="slip-file"
              type="file"
              accept="image/*"
              onChange={() => setFileError(null)}
              className="block w-full text-sm text-zinc-700 dark:text-zinc-300 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 dark:file:bg-zinc-800 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-zinc-700 dark:file:text-zinc-300 file:cursor-pointer hover:file:bg-zinc-200 dark:hover:file:bg-zinc-700 transition-colors"
            />
            <p className="text-xs text-zinc-400 dark:text-zinc-500">ไฟล์รูปภาพ ขนาดไม่เกิน 5 MB</p>
            {fileError && (
              <p className="text-xs text-rose-600 dark:text-rose-400">{fileError}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={uploading}
            className="inline-flex items-center justify-center rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-50 dark:text-zinc-900 transition-colors hover:bg-zinc-700 dark:hover:bg-zinc-200 disabled:pointer-events-none disabled:opacity-50"
          >
            {uploading ? "กำลังตรวจสอบ..." : "อัปโหลด Slip"}
          </button>
        </form>
      )}
    </div>
  );
}
