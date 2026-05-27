/**
 * Cloudflare R2 client — S3-compatible via @aws-sdk/client-s3.
 *
 * Configured with:
 *   R2_ACCOUNT_ID      — Cloudflare account ID
 *   R2_ACCESS_KEY_ID   — R2 API token Access Key ID
 *   R2_SECRET_ACCESS_KEY — R2 API token Secret
 *   R2_BUCKET          — bucket name
 *   R2_PUBLIC_URL      — public CDN base URL (e.g. https://cdn.example.com)
 */

import {
  S3Client,
  PutObjectCommand,
  type PutObjectCommandInput,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { GetObjectCommand } from "@aws-sdk/client-s3";

function getR2Client(): S3Client | null {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } =
    process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    return null;
  }
  return new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
}

// Support both R2_BUCKET and legacy R2_BUCKET_NAME
const BUCKET = process.env.R2_BUCKET ?? process.env.R2_BUCKET_NAME ?? "";
const PUBLIC_URL = process.env.R2_PUBLIC_URL?.replace(/\/$/, "") ?? "";

/**
 * Upload a buffer to R2.
 * Returns the public URL if R2_PUBLIC_URL is set, otherwise the R2 key.
 */
export async function uploadToR2(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string,
): Promise<{ ok: true; url: string } | { ok: false; skipped: string }> {
  const client = getR2Client();
  if (!client || !BUCKET) {
    return { ok: false, skipped: "R2 credentials missing — upload skipped" };
  }

  const input: PutObjectCommandInput = {
    Bucket: BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
  };

  await client.send(new PutObjectCommand(input));

  const url = PUBLIC_URL ? `${PUBLIC_URL}/${key}` : key;
  return { ok: true, url };
}

/**
 * Generate a presigned download URL for a private R2 object.
 * Expires in 1 hour by default. Use for full-resolution downloads in #11.
 */
export async function presignR2Download(
  key: string,
  expiresIn = 3600,
): Promise<string | null> {
  const client = getR2Client();
  if (!client || !BUCKET) return null;

  const url = await getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
    { expiresIn },
  );
  return url;
}

/** R2 path helpers (§6, §11.2) */
export const r2Paths = {
  photoWeb: (eventId: string, photoId: string) =>
    `events/${eventId}/web/${photoId}.jpg`,
  photoFull: (eventId: string, photoId: string) =>
    `events/${eventId}/full/${photoId}.jpg`,
  guestSelfie: (eventId: string, sessionId: string) =>
    `guest-selfies/${eventId}/${sessionId}.jpg`,
  slip: (tenantId: string, slipId: string) =>
    `slips/${tenantId}/${slipId}.jpg`,
} as const;
