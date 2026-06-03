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

/**
 * True when the input is a Dropbox share link (https://www.dropbox.com/...).
 * Such links can't be turned into an account path locally — they must be
 * resolved server-side via sharing/get_shared_link_metadata. The full URL
 * (including the ?rlkey=... query) must be preserved for that call.
 */
export function isDropboxShareLink(input: string): boolean {
  return /^https?:\/\/(www\.)?dropbox\.com\//i.test(input.trim());
}
