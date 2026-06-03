import {
  getDriveClient,
  listImagesInFolder,
  downloadDriveFile,
  type DriveFile,
} from "@/lib/google-drive-api";
import type { StorageProvider, SourceFile } from "./types";

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
      const files = await listImagesInFolder(drive, folderRef);
      return files.map(mapDriveFile);
    },
    downloadFile(fileId: string): Promise<Buffer> {
      return downloadDriveFile(drive, fileId);
    },
  };
}
