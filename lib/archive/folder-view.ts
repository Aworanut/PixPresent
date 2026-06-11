/** A photo only needs its folder_path for the folder-tree derivation. */
export type FolderViewPhoto = { folder_path: string };

export type SubfolderEntry = {
  /** Display name of the immediate subfolder. */
  name: string;
  /** Full folder_path of the subfolder (used as the next `path`). */
  path: string;
  /** Total photos anywhere under this subfolder (recursive). */
  count: number;
};

export type FolderView<T> = {
  /** Immediate subfolders of `path`, in first-seen order. */
  subfolders: SubfolderEntry[];
  /** Photos whose folder_path equals `path` (live directly in this folder). */
  photosHere: T[];
};

/**
 * Split a flat photo list (each carrying folder_path) into the folder view at
 * `path`: the immediate subfolders (with recursive photo counts) and the photos
 * sitting directly in `path`. Pure — drives the file-explorer UI.
 */
export function deriveFolderView<T extends FolderViewPhoto>(
  photos: T[],
  path: string,
): FolderView<T> {
  const prefix = path === "" ? "" : `${path}/`;
  const photosHere: T[] = [];
  const counts = new Map<string, number>();
  const order: string[] = [];

  for (const p of photos) {
    const fp = p.folder_path;
    if (fp === path) {
      photosHere.push(p);
      continue;
    }
    if (prefix !== "" && !fp.startsWith(prefix)) continue;
    const rest = fp.slice(prefix.length); // path below the current folder
    if (rest === "") continue;
    const name = rest.split("/")[0]; // immediate child segment
    const childPath = prefix + name;
    if (!counts.has(childPath)) {
      counts.set(childPath, 0);
      order.push(childPath);
    }
    counts.set(childPath, counts.get(childPath)! + 1);
  }

  const subfolders: SubfolderEntry[] = order.map((childPath) => ({
    name: childPath.slice(prefix.length),
    path: childPath,
    count: counts.get(childPath)!,
  }));

  return { subfolders, photosHere };
}
