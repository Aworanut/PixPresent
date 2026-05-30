/**
 * Dropbox HTTP API v2 client (no SDK — raw fetch).
 *
 * Env:
 *   DROPBOX_APP_KEY      — app key
 *   DROPBOX_APP_SECRET   — app secret
 *   DROPBOX_REDIRECT_URI — OAuth redirect (e.g. http://localhost:3000/auth/dropbox/callback)
 *
 * The organizer's long-lived refresh token is stored in
 * tenants.dropbox_refresh_token. Access tokens are short-lived (~4h) and are
 * minted on demand via refreshDropboxToken().
 *
 * Scopes: files.metadata.read files.content.read
 */
import type { SourceFile } from "@/lib/storage/types";

const AUTHORIZE_URL = "https://www.dropbox.com/oauth2/authorize";
const TOKEN_URL = "https://api.dropbox.com/oauth2/token";
const RPC_BASE = "https://api.dropboxapi.com/2";
const CONTENT_BASE = "https://content.dropboxapi.com/2";

const IMAGE_EXT = /\.(jpe?g|png|heic|heif|webp|gif|tiff?|bmp)$/i;

function ext2mime(name: string): string {
  const m = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  switch (m?.[1]) {
    case "jpg":
    case "jpeg": return "image/jpeg";
    case "png": return "image/png";
    case "heic":
    case "heif": return "image/heic";
    case "webp": return "image/webp";
    case "gif": return "image/gif";
    case "tif":
    case "tiff": return "image/tiff";
    case "bmp": return "image/bmp";
    default: return "application/octet-stream";
  }
}

export type DropboxEntry = {
  ".tag": "file" | "folder" | "deleted";
  id: string;
  name: string;
  path_lower?: string;
  size?: number;
  client_modified?: string;
  server_modified?: string;
};

/** Map a Dropbox file entry to the provider-agnostic SourceFile. */
export function mapDropboxEntry(e: DropboxEntry): SourceFile {
  return {
    id: e.id,
    name: e.name,
    mimeType: ext2mime(e.name),
    size: e.size,
    modifiedTime: e.client_modified ?? e.server_modified,
  };
}

export function isDropboxRetryable(status: number): boolean {
  return status === 429 || status >= 500;
}

function appCreds() {
  const { DROPBOX_APP_KEY, DROPBOX_APP_SECRET, DROPBOX_REDIRECT_URI } = process.env;
  if (!DROPBOX_APP_KEY || !DROPBOX_APP_SECRET) {
    throw new Error("Dropbox OAuth credentials not configured");
  }
  return { DROPBOX_APP_KEY, DROPBOX_APP_SECRET, DROPBOX_REDIRECT_URI };
}

/** OAuth consent URL — offline access so we get a long-lived refresh token. */
export function getDropboxAuthUrl(state: string): string {
  const { DROPBOX_APP_KEY, DROPBOX_REDIRECT_URI } = appCreds();
  const params = new URLSearchParams({
    client_id: DROPBOX_APP_KEY,
    response_type: "code",
    token_access_type: "offline",
    scope: "files.metadata.read files.content.read",
    state,
  });
  if (DROPBOX_REDIRECT_URI) params.set("redirect_uri", DROPBOX_REDIRECT_URI);
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

/** Exchange an authorization code → { refresh_token, access_token }. */
export async function exchangeDropboxCode(
  code: string,
): Promise<{ refresh_token?: string; access_token?: string }> {
  const { DROPBOX_APP_KEY, DROPBOX_APP_SECRET, DROPBOX_REDIRECT_URI } = appCreds();
  const body = new URLSearchParams({
    code,
    grant_type: "authorization_code",
    client_id: DROPBOX_APP_KEY,
    client_secret: DROPBOX_APP_SECRET,
  });
  if (DROPBOX_REDIRECT_URI) body.set("redirect_uri", DROPBOX_REDIRECT_URI);

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Dropbox token exchange failed: ${res.status} ${await res.text()}`);
  return res.json();
}

/** Mint a short-lived access token from a stored refresh token. */
export async function refreshDropboxToken(refreshToken: string): Promise<string> {
  const { DROPBOX_APP_KEY, DROPBOX_APP_SECRET } = appCreds();
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: DROPBOX_APP_KEY,
    client_secret: DROPBOX_APP_SECRET,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Dropbox token refresh failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("Dropbox token refresh returned no access_token");
  return json.access_token;
}

/** Validate a folder path + return its name (for the connect-folder UI). */
export async function dropboxGetFolderMeta(
  accessToken: string,
  path: string,
): Promise<{ ok: true; name: string } | { ok: false; status: number }> {
  // Root has no metadata endpoint; treat "" as a valid folder named "Dropbox".
  if (path === "") return { ok: true, name: "Dropbox" };
  const res = await fetch(`${RPC_BASE}/files/get_metadata`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ path }),
  });
  if (!res.ok) return { ok: false, status: res.status };
  const json = (await res.json()) as DropboxEntry;
  if (json[".tag"] !== "folder") return { ok: false, status: 409 };
  return { ok: true, name: json.name };
}

/** List image files in a folder (non-recursive), following pagination. */
export async function dropboxListFolder(
  accessToken: string,
  path: string,
): Promise<SourceFile[]> {
  const out: SourceFile[] = [];
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };

  let res = await fetch(`${RPC_BASE}/files/list_folder`, {
    method: "POST",
    headers,
    body: JSON.stringify({ path, recursive: false, limit: 2000 }),
  });
  if (!res.ok) throw new Error(`Dropbox list_folder failed: ${res.status} ${await res.text()}`);
  let json = (await res.json()) as { entries: DropboxEntry[]; cursor: string; has_more: boolean };

  const collect = (entries: DropboxEntry[]) => {
    for (const e of entries) {
      if (e[".tag"] === "file" && IMAGE_EXT.test(e.name)) out.push(mapDropboxEntry(e));
    }
  };
  collect(json.entries);

  while (json.has_more) {
    res = await fetch(`${RPC_BASE}/files/list_folder/continue`, {
      method: "POST",
      headers,
      body: JSON.stringify({ cursor: json.cursor }),
    });
    if (!res.ok) throw new Error(`Dropbox list_folder/continue failed: ${res.status} ${await res.text()}`);
    json = (await res.json()) as { entries: DropboxEntry[]; cursor: string; has_more: boolean };
    collect(json.entries);
  }

  return out;
}

/** Download a file's bytes by its Dropbox file id. */
export async function dropboxDownload(accessToken: string, fileId: string): Promise<Buffer> {
  const res = await fetch(`${CONTENT_BASE}/files/download`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      // Download endpoints carry the JSON arg in a header; body is empty.
      "Dropbox-API-Arg": JSON.stringify({ path: fileId }),
    },
  });
  if (!res.ok) {
    const err = new Error(`Dropbox download failed: ${res.status}`);
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }
  return Buffer.from(await res.arrayBuffer());
}
