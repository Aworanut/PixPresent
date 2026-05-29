import { Resend } from "resend";
import { getPrimaryAdminEmail } from "@/lib/auth/super-admin";

// Initialize Resend client
const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

// Get the from email address, with fallback
function getFromEmail(): string {
  return process.env.RESEND_FROM_EMAIL ?? "noreply@pixpresent.app";
}

/**
 * sendAdminSlipPending
 * Notifies admin that a slip is pending verification
 */
export async function sendAdminSlipPending(params: {
  slipId: string;
  tenantName: string;
  amountThb: number;
  credits: number;
}): Promise<{ error?: string }> {
  // Skip gracefully if Resend is not configured (dev mode)
  if (!resend) {
    console.log(
      "[Email] Resend not configured; skipping admin slip pending notification",
    );
    return {};
  }

  try {
    const subject = `🔔 Slip รอ verify — ${params.tenantName} ${params.amountThb}฿`;
    const text = `
Slip ID: ${params.slipId}
Tenant: ${params.tenantName}
Amount: ${params.amountThb} THB
Credits Claimed: ${params.credits}

กรุณาตรวจสอบใน Admin Dashboard
    `.trim();

    const result = await resend.emails.send({
      from: getFromEmail(),
      to: getPrimaryAdminEmail(),
      subject,
      text,
    });

    if (result.error) {
      console.error("Resend error (sendAdminSlipPending):", result.error);
      return { error: `Failed to send admin notification: ${result.error.message}` };
    }

    console.log("[Email] Admin slip pending notification sent:", result.data?.id);
    return {};
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[Email] Exception in sendAdminSlipPending:", errorMsg);
    return { error: `Email error: ${errorMsg}` };
  }
}

/**
 * sendOrganizerTopupApproved
 * Notifies organizer that their top-up was approved
 */
export async function sendOrganizerTopupApproved(params: {
  toEmail: string;
  credits: number;
  newBalance: number;
}): Promise<{ error?: string }> {
  // Skip gracefully if Resend is not configured (dev mode)
  if (!resend) {
    console.log(
      "[Email] Resend not configured; skipping organizer topup approved notification",
    );
    return {};
  }

  try {
    const subject = `✅ เติม Credit สำเร็จ — ${params.credits} Credits`;
    const text = `
เติม Credit สำเร็จ!

Credits Added: ${params.credits}
New Balance: ${params.newBalance}

สามารถสร้าง event ใหม่ได้เลยครับ
    `.trim();

    const result = await resend.emails.send({
      from: getFromEmail(),
      to: params.toEmail,
      subject,
      text,
    });

    if (result.error) {
      console.error("Resend error (sendOrganizerTopupApproved):", result.error);
      return { error: `Failed to send approval notification: ${result.error.message}` };
    }

    console.log(
      "[Email] Organizer topup approved notification sent:",
      result.data?.id,
    );
    return {};
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[Email] Exception in sendOrganizerTopupApproved:", errorMsg);
    return { error: `Email error: ${errorMsg}` };
  }
}

/**
 * sendOrganizerTopupRejected
 * Notifies organizer that their top-up was rejected
 */
export async function sendOrganizerTopupRejected(params: {
  toEmail: string;
  reason: string;
}): Promise<{ error?: string }> {
  // Skip gracefully if Resend is not configured (dev mode)
  if (!resend) {
    console.log(
      "[Email] Resend not configured; skipping organizer topup rejected notification",
    );
    return {};
  }

  try {
    const subject = `❌ Slip ไม่ผ่านการตรวจสอบ`;
    const text = `
Slip ของคุณไม่ผ่านการตรวจสอบ

Reason: ${params.reason}

กรุณาติดต่อ ${getPrimaryAdminEmail()} หากมีข้อสงสัย
    `.trim();

    const result = await resend.emails.send({
      from: getFromEmail(),
      to: params.toEmail,
      subject,
      text,
    });

    if (result.error) {
      console.error("Resend error (sendOrganizerTopupRejected):", result.error);
      return { error: `Failed to send rejection notification: ${result.error.message}` };
    }

    console.log(
      "[Email] Organizer topup rejected notification sent:",
      result.data?.id,
    );
    return {};
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[Email] Exception in sendOrganizerTopupRejected:", errorMsg);
    return { error: `Email error: ${errorMsg}` };
  }
}

/**
 * sendCleanupFailureAlert
 * Alerts admin when the nightly Rekognition collection cleanup partially fails.
 * Non-critical — failures are logged regardless; this is a best-effort alert.
 */
export async function sendCleanupFailureAlert(params: {
  failures: string[];
}): Promise<void> {
  const to = getPrimaryAdminEmail();
  if (!resend || !to) {
    console.warn(
      "[Email] Resend not configured or no admin email; skipping cleanup failure alert",
    );
    return;
  }

  try {
    await resend.emails.send({
      from: getFromEmail(),
      to,
      subject: `[PixPresent] ⚠️ Rekognition Cleanup — ${params.failures.length} failure(s)`,
      text: [
        "พบ error ระหว่าง nightly Rekognition collection cleanup:",
        "",
        ...params.failures.map((f, i) => `${i + 1}. ${f}`),
        "",
        "Collection เหล่านี้ยังคงอยู่ใน AWS — จะลองอีกครั้งในรันถัดไป",
        "ถ้า error ต่อเนื่อง กรุณาตรวจสอบ AWS credentials และ Rekognition quotas",
      ].join("\n"),
    });
  } catch (err) {
    // Swallow — this is a non-critical alert, don't let it propagate.
    console.error("[Email] sendCleanupFailureAlert failed:", err);
  }
}
