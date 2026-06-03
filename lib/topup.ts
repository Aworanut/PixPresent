/**
 * lib/topup.ts
 * Pure business logic for credit top-up via bank slip.
 * No Next.js imports — fully testable in isolation.
 */

import { TOPUP_PACKAGES, CUSTOM_TOPUP, type TopupPackage } from '@/lib/payment-config'

// ---------------------------------------------------------------------------
// validateTopupRequest
// ---------------------------------------------------------------------------

export type TopupValidationOpts = {
  /** Active packages to validate against. Defaults to the code constants so
   *  existing callers/tests are unchanged; the slip route injects DB packages. */
  packages?: TopupPackage[]
  custom?: { minThb: number; maxThb: number }
}

export function validateTopupRequest(
  packageId: string,
  amountThb: number,
  credits: number,
  opts: TopupValidationOpts = {},
): { valid: boolean; error?: string } {
  const packages = opts.packages ?? TOPUP_PACKAGES
  const custom = opts.custom ?? CUSTOM_TOPUP

  // packageId must be 'custom' or one of the (DB-or-constant) package ids
  const isCustom = packageId === 'custom'
  if (!isCustom && !packages.some((p) => p.id === packageId)) {
    return { valid: false, error: 'Invalid package ID' }
  }

  // Amounts must be positive integers
  if (!Number.isInteger(amountThb) || amountThb <= 0) {
    return { valid: false, error: 'amountThb must be a positive integer' }
  }
  if (!Number.isInteger(credits) || credits <= 0) {
    return { valid: false, error: 'credits must be a positive integer' }
  }

  if (isCustom) {
    // Custom: amount must be within min/max range
    if (amountThb < custom.minThb || amountThb > custom.maxThb) {
      return {
        valid: false,
        error: `Custom amount must be between ${custom.minThb} and ${custom.maxThb} THB`,
      }
    }
    // 1 credit = 1 THB for custom
    if (credits !== Math.floor(amountThb)) {
      return { valid: false, error: 'credits must equal amountThb for custom package' }
    }
    return { valid: true }
  }

  // Preset package — verify amount and credits match exactly
  const pkg = packages.find((p) => p.id === packageId)
  if (!pkg) {
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
