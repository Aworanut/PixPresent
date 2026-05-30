/**
 * Normalize a user-entered Dropbox folder reference into a path usable with
 * the Dropbox API's files/list_folder (which takes "" for the account root,
 * or "/Folder/Sub" for a subfolder).
 *
 * MVP accepts a typed path only. Share links (https://www.dropbox.com/...)
 * cannot be turned into an account path reliably, so they return "" and the
 * caller surfaces a "paste a path, not a link" error.
 */
export function normalizeDropboxFolderPath(input: string): string {
  const t = input.trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return "";
  let p = t.startsWith("/") ? t : `/${t}`;
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  return p === "/" ? "" : p;
}
