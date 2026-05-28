import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateTopupRequest } from '@/lib/topup';
import { verifySlipWithSlipOK } from '@/lib/topup';

// ---------------------------------------------------------------------------
// validateTopupRequest
// ---------------------------------------------------------------------------

describe('validateTopupRequest', () => {
  it('accepts valid pack_199', () => {
    expect(validateTopupRequest('pack_199', 199, 199).valid).toBe(true);
  });

  it('accepts valid pack_499', () => {
    expect(validateTopupRequest('pack_499', 499, 499).valid).toBe(true);
  });

  it('accepts valid pack_999', () => {
    expect(validateTopupRequest('pack_999', 999, 999).valid).toBe(true);
  });

  it('rejects unknown packageId', () => {
    const result = validateTopupRequest('starter', 199, 199);
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('rejects pack_199 with wrong amount', () => {
    expect(validateTopupRequest('pack_199', 100, 100).valid).toBe(false);
  });

  it('rejects pack_499 with wrong credits', () => {
    expect(validateTopupRequest('pack_499', 499, 199).valid).toBe(false);
  });

  it('accepts custom within min/max range', () => {
    expect(validateTopupRequest('custom', 500, 500).valid).toBe(true);
  });

  it('rejects custom below minimum (199)', () => {
    expect(validateTopupRequest('custom', 50, 50).valid).toBe(false);
  });

  it('rejects custom above maximum (99999)', () => {
    expect(validateTopupRequest('custom', 100_000, 100_000).valid).toBe(false);
  });

  it('rejects custom where credits != Math.floor(amountThb)', () => {
    expect(validateTopupRequest('custom', 300, 299).valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// verifySlipWithSlipOK
// ---------------------------------------------------------------------------

describe('verifySlipWithSlipOK', () => {
  const fakeBuffer = Buffer.from('fake-image');

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns verified=false when SLIPOK_API_URL not set', async () => {
    delete process.env.SLIPOK_API_URL;
    const result = await verifySlipWithSlipOK(fakeBuffer, 199);
    expect(result.verified).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns verified=false when fetch throws', async () => {
    process.env.SLIPOK_API_URL = 'https://api.slipok.com/api/line/apikey/test';
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));
    const result = await verifySlipWithSlipOK(fakeBuffer, 199);
    expect(result.verified).toBe(false);
    expect(result.error).toContain('Network error');
  });

  it('returns verified=false when SlipOK returns non-200', async () => {
    process.env.SLIPOK_API_URL = 'https://api.slipok.com/api/line/apikey/test';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: false, message: 'Invalid slip' }), { status: 200 })
    );
    const result = await verifySlipWithSlipOK(fakeBuffer, 199);
    expect(result.verified).toBe(false);
  });

  it('returns verified=true when SlipOK succeeds', async () => {
    process.env.SLIPOK_API_URL = 'https://api.slipok.com/api/line/apikey/test';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ success: true, data: { transRef: 'TX12345', amount: 199 } }),
        { status: 200 }
      )
    );
    const result = await verifySlipWithSlipOK(fakeBuffer, 199);
    expect(result.verified).toBe(true);
    expect(result.transactionId).toBe('TX12345');
  });
});
