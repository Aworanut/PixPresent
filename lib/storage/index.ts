import type { StorageProvider, SourceType } from "./types";
import { createGoogleDriveProvider } from "./google-drive-provider";
import { createDropboxProvider } from "./dropbox-provider";

export type ProviderCreds = {
  googleRefreshToken?: string | null;
  dropboxRefreshToken?: string | null;
};

/** Resolve a StorageProvider for the given source type using tenant credentials. */
export async function getProvider(
  sourceType: SourceType,
  creds: ProviderCreds,
): Promise<StorageProvider> {
  if (sourceType === "gdrive") {
    if (!creds.googleRefreshToken) throw new Error("Google Drive not connected");
    return createGoogleDriveProvider(creds.googleRefreshToken);
  }
  if (sourceType === "dropbox") {
    if (!creds.dropboxRefreshToken) throw new Error("Dropbox not connected");
    return createDropboxProvider(creds.dropboxRefreshToken);
  }
  throw new Error(`Unknown source type: ${sourceType}`);
}

export type { StorageProvider, SourceType, SourceFile } from "./types";
