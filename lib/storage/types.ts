/**
 * Provider-agnostic storage source abstraction.
 *
 * A "source folder" lives in some provider (Google Drive, Dropbox). The sync
 * pipeline only needs two operations from it: list the image files, and
 * download one file's bytes. Everything after the bytes (sharp → R2 →
 * Rekognition) is identical regardless of provider.
 */

export type SourceType = "gdrive" | "dropbox";

export const SOURCE_TYPES: SourceType[] = ["gdrive", "dropbox"];

/** A single image file in a source folder, normalized across providers. */
export type SourceFile = {
  /** Stable id used for dedup across syncs. Drive: file id. Dropbox: "id:..." */
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  /** ISO timestamp; best-available "taken/modified" hint, used as taken_at fallback. */
  modifiedTime?: string;
  /** Subfolder path relative to the connected folder root (e.g. 'a/b'). '' = root. */
  relativePath?: string;
};

export interface StorageProvider {
  /** List image files in the given folder reference (Drive folder id / Dropbox path). */
  listImages(folderRef: string): Promise<SourceFile[]>;
  /** Download one file's raw bytes by its `SourceFile.id`. */
  downloadFile(fileId: string): Promise<Buffer>;
}
