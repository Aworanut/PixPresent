import {
  getDriveClient,
  listImagesInFolder,
  downloadDriveFile,
  isDriveRetryable,
  type DriveFile,
} from "@/lib/google-drive-api";
import type { StorageProvider, SourceFile } from "./types";

/** Retry a Drive call on transient network / 429 / 5xx / 403-rate-limit with exponential backoff. */
async function withDriveRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastErr = err;
      if (!isDriveRetryable(err) || attempt === maxRetries) throw err;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    }
  }
  throw lastErr;
}

/** Map a Drive file into the provider-agnostic shape. */
function mapDriveFile(f: DriveFile): SourceFile {
  return {
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    size: f.size,
    // Drive exposes the photo's capture time via imageMediaMetadata.time;
    // fall back to modifiedTime.
    modifiedTime: f.imageMediaMetadata?.time ?? f.modifiedTime,
  };
}

/** Build a StorageProvider backed by Google Drive. */
export function createGoogleDriveProvider(refreshToken: string): StorageProvider {
  const drive = getDriveClient(refreshToken);
  return {
    async listImages(folderRef: string): Promise<SourceFile[]> {
      const files = await withDriveRetry(() => listImagesInFolder(drive, folderRef));
      return files.map(mapDriveFile);
    },
    downloadFile(fileId: string): Promise<Buffer> {
      return withDriveRetry(() => downloadDriveFile(drive, fileId));
    },
  };
}
