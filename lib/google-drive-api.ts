/**
 * Google Drive API client — lists and downloads files from a folder.
 *
 * Configured with:
 *   GOOGLE_CLIENT_ID       — OAuth 2.0 client ID
 *   GOOGLE_CLIENT_SECRET   — OAuth 2.0 client secret
 *   GOOGLE_REDIRECT_URI    — OAuth redirect URI (e.g. /auth/google/callback)
 *
 * The organizer's refresh token is stored in `tenants.google_refresh_token`
 * (column to be added in migration for #7).
 *
 * Scope: https://www.googleapis.com/auth/drive.readonly
 */

import { google } from "googleapis";

/** Build an authorized Google Drive client from an organizer's refresh token. */
export function getDriveClient(refreshToken: string) {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } =
    process.env;

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error("Google OAuth credentials not configured");
  }

  const auth = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI,
  );
  auth.setCredentials({ refresh_token: refreshToken });

  return google.drive({ version: "v3", auth });
}

/** Return the OAuth consent URL for the organizer to connect Google Drive. */
export function getDriveAuthUrl(state?: string): string {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } =
    process.env;

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error("Google OAuth credentials not configured");
  }

  const auth = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI,
  );

  return auth.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/drive.readonly"],
    state,
  });
}

/** Exchange authorization code → { access_token, refresh_token }. */
export async function exchangeDriveCode(code: string) {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } =
    process.env;

  const auth = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI,
  );

  const { tokens } = await auth.getToken(code);
  return tokens;
}

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  modifiedTime?: string;
  imageMediaMetadata?: {
    time?: string;
  } | null;
};

/**
 * List all image files in a Drive folder (non-recursive by default).
 * Supports pagination automatically — returns full list.
 * Drive rate limit: ~1,000 req/100sec; use with exponential backoff in #7.
 */
export async function listImagesInFolder(
  drive: ReturnType<typeof getDriveClient>,
  folderId: string,
): Promise<DriveFile[]> {
  const files: DriveFile[] = [];
  let pageToken: string | undefined;

  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and mimeType contains 'image/' and trashed = false`,
      fields: "nextPageToken, files(id, name, mimeType, size, modifiedTime, imageMediaMetadata)",
      pageSize: 1000,
      pageToken,
    });

    for (const f of res.data.files ?? []) {
      if (f.id && f.name && f.mimeType) {
        files.push({
          id: f.id,
          name: f.name,
          mimeType: f.mimeType,
          size: f.size ? Number(f.size) : undefined,
          modifiedTime: f.modifiedTime ?? undefined,
          imageMediaMetadata: f.imageMediaMetadata ?? null,
        });
      }
    }

    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  return files;
}

/**
 * List image files in a Drive folder AND all nested subfolders, recording each
 * file's path relative to the starting folder (e.g. 'พิธีเช้า/ช่วงเช้า'). The
 * starting folder itself contributes relativePath ''. Reuses listImagesInFolder
 * per level; walks subfolders via the folder mimeType.
 */
export async function listImagesRecursive(
  drive: ReturnType<typeof getDriveClient>,
  folderId: string,
  relativePath = "",
): Promise<Array<{ file: DriveFile; relativePath: string }>> {
  const out: Array<{ file: DriveFile; relativePath: string }> = [];

  // Images directly in this folder.
  const images = await listImagesInFolder(drive, folderId);
  for (const file of images) out.push({ file, relativePath });

  // Recurse into subfolders.
  let pageToken: string | undefined;
  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: "nextPageToken, files(id, name)",
      pageSize: 1000,
      pageToken,
    });
    for (const sub of res.data.files ?? []) {
      if (sub.id && sub.name) {
        const childPath = relativePath ? `${relativePath}/${sub.name}` : sub.name;
        out.push(...(await listImagesRecursive(drive, sub.id, childPath)));
      }
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  return out;
}

/**
 * Download a Drive file as a Buffer.
 * Use for images before resizing + uploading to R2 in #7.
 */
export async function downloadDriveFile(
  drive: ReturnType<typeof getDriveClient>,
  fileId: string,
): Promise<Buffer> {
  const res = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "arraybuffer" },
  );

  // `data` is ArrayBuffer when responseType = 'arraybuffer'
  return Buffer.from(res.data as ArrayBuffer);
}

/** Transient network errors (no HTTP status) worth retrying. */
const DRIVE_TRANSIENT_NET_CODES = new Set([
  "ECONNRESET",
  "ETIMEDOUT",
  "EAI_AGAIN",
  "ENOTFOUND",
  "ECONNREFUSED",
  "EPIPE",
]);

/**
 * Whether a Google Drive API error is worth retrying. Covers transient network
 * blips, 429, and 5xx — plus the 403 + rate-limit reason that Drive uses for
 * throttling (Drive often signals quota limits as 403 `userRateLimitExceeded` /
 * `rateLimitExceeded`, not 429). Mirrors `isDropboxRetryable` for the Drive
 * provider's `withDriveRetry`.
 */
export function isDriveRetryable(err: unknown): boolean {
  const e = (err ?? {}) as {
    status?: number;
    code?: number | string;
    response?: {
      status?: number;
      data?: { error?: { errors?: Array<{ reason?: string }> } };
    };
    errors?: Array<{ reason?: string }>;
  };

  // Transient network errors surface as a string `code` with no HTTP status.
  if (typeof e.code === "string" && DRIVE_TRANSIENT_NET_CODES.has(e.code)) {
    return true;
  }

  const status =
    Number(e.status ?? e.response?.status ?? (typeof e.code === "number" ? e.code : 0)) || 0;

  if (status === 429 || status >= 500) return true;

  if (status === 403) {
    const reasons = e.response?.data?.error?.errors ?? e.errors ?? [];
    return reasons.some(
      (r) => r?.reason === "rateLimitExceeded" || r?.reason === "userRateLimitExceeded",
    );
  }

  return false;
}
