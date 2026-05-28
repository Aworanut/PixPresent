/**
 * POST /api/topup/upload-slip
 *
 * Accepts a bank-transfer slip image + package details, verifies via SlipOK,
 * and either auto-approves credits or queues the slip for manual review.
 *
 * Form fields:
 *   slip_image    File    — the slip image (image/*)
 *   package_id    string  — 'pack_199' | 'pack_499' | 'pack_999' | 'custom'
 *   amount_thb    number  — transfer amount in THB
 *   credits_claimed number — credits the user claims to receive
 *
 * Response (approved):  { status: 'approved', credits: number, newBalance: number }
 * Response (pending):   { status: 'pending', message: string }
 */

import { randomUUID } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { uploadToR2, r2Paths } from '@/lib/r2'
import { sendAdminSlipPending, sendOrganizerTopupApproved } from '@/lib/email/notifications'
import { validateTopupRequest, verifySlipWithSlipOK } from '@/lib/topup'

export async function POST(request: Request): Promise<Response> {
  try {
    // 1. Auth check
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Get tenant (service role to bypass RLS on tenants)
    const admin = createServiceRoleClient()

    const { data: tenant, error: tenantError } = await admin
      .from('tenants')
      .select('id, name, credit_balance')
      .eq('owner_user_id', user.id)
      .single()

    if (tenantError || !tenant) {
      return Response.json({ error: 'Tenant not found' }, { status: 404 })
    }

    // 3. Parse multipart form
    const formData = await request.formData()
    const slipFile = formData.get('slip_image') as File | null
    const packageId = formData.get('package_id') as string
    const amountThb = Number(formData.get('amount_thb'))
    const creditsClaimed = Number(formData.get('credits_claimed'))

    // Validate slip file
    if (!slipFile || typeof slipFile === 'string') {
      return Response.json({ error: 'slip_image is required' }, { status: 400 })
    }
    const ALLOWED_MIME = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic'] as const
    if (!ALLOWED_MIME.includes(slipFile.type as typeof ALLOWED_MIME[number])) {
      return Response.json({ error: 'Unsupported image type. Use JPEG, PNG, WebP or HEIC.' }, { status: 400 })
    }
    const MAX_SLIP_BYTES = 5 * 1024 * 1024; // 5 MB
    if (slipFile.size > MAX_SLIP_BYTES) {
      return Response.json(
        { error: 'slip_image must be under 5 MB' },
        { status: 400 },
      );
    }

    // 4. Validate package/amount/credits
    const validation = validateTopupRequest(packageId, amountThb, creditsClaimed)
    if (!validation.valid) {
      return Response.json({ error: validation.error }, { status: 400 })
    }

    // 5. Generate slip ID
    const slipId = randomUUID()

    // TODO(#13-race): For production, store verification.transactionId in slip_uploads
    // and add a unique constraint to prevent double-credit on duplicate slip uploads.

    // 6. Upload slip to R2 (non-blocking — fallback to placeholder if R2 not configured)
    const slipBuffer = Buffer.from(await slipFile.arrayBuffer())
    const r2Result = await uploadToR2(r2Paths.slip(tenant.id, slipId), slipBuffer, slipFile.type)
    const slipImageUrl = r2Result.ok ? r2Result.url : `slip-pending://${slipId}`

    // 7. Insert slip_uploads row
    const { error: insertError } = await admin.from('slip_uploads').insert({
      id: slipId,
      tenant_id: tenant.id,
      package_id: packageId,
      amount_thb: amountThb,
      credits_claimed: creditsClaimed,
      slip_image_url: slipImageUrl,
      status: 'pending',
    })

    if (insertError) {
      console.error('[upload-slip] Failed to insert slip_uploads row:', insertError)
      return Response.json({ error: 'Failed to record slip' }, { status: 500 })
    }

    // 8. Verify with SlipOK
    const verification = await verifySlipWithSlipOK(slipBuffer, amountThb, slipFile.type)

    // 9a. Auto-approved path
    if (verification.verified) {
      // Call approve_topup_credit RPC with service role (bypasses RLS)
      const { error: rpcError } = await admin.rpc('approve_topup_credit', {
        p_slip_id: slipId,
      })

      if (rpcError) {
        console.error('[upload-slip] approve_topup_credit RPC failed, falling back to pending:', rpcError)
        // Slip stays 'pending' — admin will review manually
        await sendAdminSlipPending({
          slipId,
          tenantName: tenant.name,
          amountThb,
          credits: creditsClaimed,
        }).catch((e) => console.error('[upload-slip] admin email failed:', e))
        return Response.json({
          status: 'pending',
          message: 'Slip อยู่ระหว่างการตรวจสอบ กรุณารอภายใน 24 ชั่วโมง',
        })
      }

      // Fetch updated balance
      const { data: updatedTenant } = await admin
        .from('tenants')
        .select('credit_balance')
        .eq('id', tenant.id)
        .single()

      const newBalance = updatedTenant?.credit_balance ?? tenant.credit_balance + creditsClaimed

      // Send approval email (non-blocking — don't fail if email fails)
      if (user.email) {
        await sendOrganizerTopupApproved({
          toEmail: user.email,
          credits: creditsClaimed,
          newBalance,
        }).catch((e) => console.error('[upload-slip] organizer email failed:', e))
      }

      return Response.json({ status: 'approved', credits: creditsClaimed, newBalance })
    }

    // 9b. SlipOK explicitly rejected — auto-reject slip, no admin review needed
    if (verification.rejected) {
      const { error: rejectErr } = await admin.rpc('reject_topup', {
        p_slip_id: slipId,
        p_reason: verification.error ?? 'SlipOK rejected',
      })
      if (rejectErr) console.error('[upload-slip] reject_topup RPC failed:', rejectErr)

      return Response.json(
        { error: `สลิปไม่ผ่านการตรวจสอบ: ${verification.error ?? 'กรุณาตรวจสอบยอดโอนและลองใหม่'}` },
        { status: 400 },
      )
    }

    // 9c. Network error / SlipOK unavailable — keep pending for admin review
    await sendAdminSlipPending({
      slipId,
      tenantName: tenant.name,
      amountThb,
      credits: creditsClaimed,
    }).catch((err) => console.error('[upload-slip] sendAdminSlipPending failed:', err))

    return Response.json({
      status: 'pending',
      message: 'Slip อยู่ระหว่างการตรวจสอบ กรุณารอภายใน 24 ชั่วโมง',
    })
  } catch (err) {
    console.error('[upload-slip] Unexpected error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
