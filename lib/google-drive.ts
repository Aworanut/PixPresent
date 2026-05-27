// Extracts the folder ID from common Google Drive URL shapes, or returns
// the input as-is when it already looks like a raw ID.
//
// Supported shapes:
//   • https://drive.google.com/drive/folders/<ID>
//   • https://drive.google.com/drive/u/0/folders/<ID>?usp=share_link
//   • https://drive.google.com/drive/folders/<ID>?usp=sharing
//   • <ID>
export function extractDriveFolderId(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";

  const urlMatch = trimmed.match(/\/folders\/([A-Za-z0-9_-]{20,})/);
  if (urlMatch) return urlMatch[1];

  // Already an ID (Drive folder IDs are 25-33 chars, alphanumeric + _ -).
  if (/^[A-Za-z0-9_-]{20,}$/.test(trimmed)) return trimmed;

  return trimmed; // best-effort — let the caller decide validity
}

export function driveFolderUrl(folderId: string): string {
  return `https://drive.google.com/drive/folders/${folderId}`;
}
