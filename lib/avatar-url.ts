/** True only for avatars uploaded to our Supabase `avatars` bucket (not Google/OAuth URLs). */
export function isStoredAvatarUrl(url: string | null | undefined): boolean {
  const trimmed = url?.trim();
  if (!trimmed) return false;
  try {
    return new URL(trimmed).pathname.includes("/avatars/");
  } catch {
    return trimmed.includes("/avatars/");
  }
}
