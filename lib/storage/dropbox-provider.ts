import {
  refreshDropboxToken,
  dropboxListFolder,
  dropboxDownload,
  isDropboxRetryable,
} from "@/lib/dropbox-api";
import type { StorageProvider, SourceFile } from "./types";

/** Retry a Dropbox call on 429/5xx with exponential backoff. */
async function withDropboxRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastErr = err;
      const status = (err as { status?: number }).status ?? 0;
      if (!isDropboxRetryable(status) || attempt === maxRetries) throw err;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    }
  }
  throw lastErr;
}

/**
 * Build a StorageProvider backed by Dropbox. Refreshes the long-lived
 * refresh token into a short-lived access token once, reused for the sync.
 */
export async function createDropboxProvider(refreshToken: string): Promise<StorageProvider> {
  const accessToken = await refreshDropboxToken(refreshToken);
  return {
    async listImages(folderRef: string): Promise<SourceFile[]> {
      return withDropboxRetry(() => dropboxListFolder(accessToken, folderRef));
    },
    downloadFile(fileId: string): Promise<Buffer> {
      return withDropboxRetry(() => dropboxDownload(accessToken, fileId));
    },
  };
}
