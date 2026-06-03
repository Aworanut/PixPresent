"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getProvider, type SourceType } from "@/lib/storage";

export type FolderSyncState = "not_synced" | "partial" | "synced";

export type FolderSyncStatus = {
  /** event_storage_folders.id */
  folderId: string;
  state: FolderSyncState;
  /** Photos already indexed from this folder. */
  synced: number;
  /** Live image count in the source folder; null when it couldn't be listed. */
  total: number | null;
};

/**
 * Per-folder sync status for the Photo Sources modal.
 *
 * Compares the photos already indexed from each folder
 * (`photos.event_storage_folder_id`) against the live image count in the
 * source folder (`provider.listImages`), yielding not_synced / partial /
 * synced. When the source can't be listed (no creds / network) it falls back
 * to a binary guess from the indexed count.
 */
export async function getFolderSyncStatus(
  eventId: string,
): Promise<FolderSyncStatus[]> {
  const supabase = await createClient();
  const admin = createServiceRoleClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  // Resolve tenant + provider creds, and verify ownership.
  const { data: event } = await admin
    .from("events")
    .select("tenant_id")
    .eq("id", eventId)
    .single();
  if (!event) return [];

  const { data: tenant } = await admin
    .from("tenants")
    .select("owner_user_id, google_refresh_token, dropbox_refresh_token")
    .eq("id", event.tenant_id)
    .single();
  if (!tenant || tenant.owner_user_id !== user.id) return [];

  const { data: folders } = await admin
    .from("event_storage_folders")
    .select("id, folder_id, source_type")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });
  if (!folders || folders.length === 0) return [];

  // Live synced count per folder, from the photos table.
  const { data: photos } = await admin
    .from("photos")
    .select("event_storage_folder_id")
    .eq("event_id", eventId);
  const syncedByFolder = new Map<string, number>();
  for (const p of photos ?? []) {
    const fid = p.event_storage_folder_id;
    if (!fid) continue;
    syncedByFolder.set(fid, (syncedByFolder.get(fid) ?? 0) + 1);
  }

  return Promise.all(
    folders.map(async (f): Promise<FolderSyncStatus> => {
      const synced = syncedByFolder.get(f.id) ?? 0;

      let total: number | null = null;
      try {
        const provider = await getProvider(f.source_type as SourceType, {
          googleRefreshToken: tenant.google_refresh_token,
          dropboxRefreshToken: tenant.dropbox_refresh_token,
        });
        total = (await provider.listImages(f.folder_id)).length;
      } catch {
        total = null; // couldn't list — fall back to a binary guess below
      }

      let state: FolderSyncState;
      if (total === null) {
        state = synced > 0 ? "synced" : "not_synced";
      } else if (synced === 0) {
        state = "not_synced";
      } else if (synced >= total) {
        state = "synced";
      } else {
        state = "partial";
      }

      return { folderId: f.id, state, synced, total };
    }),
  );
}
