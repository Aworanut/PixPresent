/**
 * lib/topup.ts
 * Pure business logic for credit top-up via bank slip.
 * No Next.js imports — fully testable in isolation.
 */

import { TOPUP_PACKAGES, CUSTOM_TOPUP } from '@/lib/payment-config'

// ---------------------------------------------------------------------------
// validateTopupRequest
// ---------------------------------------------------------------------------

const VALID_PACKAGE_IDS = ['pack_199', 'pack_499', 'pack_999', 'custom'] as const

export function validateTopupRequest(
  packageId: string,
  amountThb: number,
  credits: number,
): { valid: boolean; error?: string } {
  // Check packageId is in the allowed list
  if (!VALID_PACKAGE_IDS.includes(packageId as (typeof VALID_PACKAGE_IDS)[number])) {
    return { valid: false, error: 'Invalid package ID' }
  }

  // Amounts must be positive integers
  if (!Number.isInteger(amountThb) || amountThb <= 0) {
    return { valid: false, error: 'amountThb must be a positive integer' }
  }
  if (!Number.isInteger(credits) || credits <= 0) {
    return { valid: false, error: 'credits must be a positive integer' }
  }

  if (packageId === 'custom') {
    // Custom: amount must be within min/max range
    if (amountThb < CUSTOM_TOPUP.minThb || amountThb > CUSTOM_TOPUP.maxThb) {
      return {
        valid: false,
        error: `Custom amount must be between ${CUSTOM_TOPUP.minThb} and ${CUSTOM_TOPUP.maxThb} THB`,
      }
    }
    // 1 credit = 1 THB for custom
    if (credits !== Math.floor(amountThb)) {
      return { valid: false, error: 'credits must equal amountThb for custom package' }
    }
    return { valid: true }
  }

  // Preset package — verify amount and credits match exactly
  const pkg = TOPUP_PACKAGES.find((p) => p.id === packageId)
  if (!pkg) {
    // Shouldn't happen since we already checked VALID_PACKAGE_IDS, but be safe
    return { valid: false, error: 'Invalid package ID' }
  }

  if (amountThb !== pkg.priceThb) {
    return { valid: false, error: `Package ${packageId} requires amountThb = ${pkg.priceThb}` }
  }
  if (credits !== pkg.credits) {
    return { valid: false, error: `Package ${packageId} requires credits = ${pkg.credits}` }
  }

  return { valid: true }
}

// ---------------------------------------------------------------------------
// verifySlipWithSlipOK
// ---------------------------------------------------------------------------

export async function verifySlipWithSlipOK(
  slipImageBuffer: Buffer,
  amountThb: number,
  mimeType = 'application/octet-stream',
): Promise<{ verified: boolean; rejected: boolean; transactionId?: string; error?: string }> {
  const apiUrl = process.env.SLIPOK_API_URL
  if (!apiUrl) {
    return { verified: false, rejected: false, error: 'SLIPOK_API_URL not configured' }
  }

  try {
    // Build multipart/form-data payload
    const formData = new FormData()

    // Attach slip image with the actual MIME type so SlipOK can identify the format
    const slipBlob = new Blob([new Uint8Array(slipImageBuffer)], { type: mimeType })
    const ext = mimeType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg'
    formData.append('files', slipBlob, `slip.${ext}`)
    formData.append('log', 'true')

    // Optional: amount field for amount verification (SlipOK supports this)
    // Not required by spec but helpful for auto-reject mismatch
    formData.append('amount', String(amountThb))

    const headers: Record<string, string> = {}
    if (process.env.SLIPOK_API_TOKEN) {
      headers['x-authorization'] = process.env.SLIPOK_API_TOKEN
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: formData,
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await response.json()

    if (response.ok && data.success === true) {
      return {
        verified: true,
        rejected: false,
        transactionId: data.data?.transRef ?? undefined,
      }
    }

    // SlipOK responded but explicitly rejected the slip (not a network error)
    return {
      verified: false,
      rejected: true,
      error: data.message ?? 'Verification failed',
    }
  } catch (err) {
    // Network error / timeout — don't auto-reject, fall back to pending
    const message = err instanceof Error ? err.message : String(err)
    return { verified: false, rejected: false, error: message }
  }
}
