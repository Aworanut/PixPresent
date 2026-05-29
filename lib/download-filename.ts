/** Safe download filename from Drive original name (web JPEG output). */
export function downloadPhotoFilename(
  originalFilename: string | null | undefined,
  fallbackStem: string,
): string {
  const raw = originalFilename?.trim();
  if (!raw) return `${fallbackStem}.jpg`;

  const base = raw.split(/[/\\]/).pop() ?? raw;
  const stem = base.replace(/\.[^.]+$/, "").trim() || fallbackStem;
  const sanitized =
    stem
      .replace(/[^\w\s.\-()[\]\u0E00-\u0E7F]/g, "_")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120) || fallbackStem;

  return `${sanitized}.jpg`;
}

export function contentDispositionAttachment(filename: string): string {
  const asciiFallback = filename.replace(/[^\x20-\x7E]/g, "_") || "photo.jpg";
  const encoded = encodeURIComponent(filename);
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}

export function uniqueDownloadFilenames(
  entries: { originalFilename: string | null | undefined; fallbackStem: string }[],
): string[] {
  const used = new Set<string>();
  return entries.map(({ originalFilename, fallbackStem }) => {
    let name = downloadPhotoFilename(originalFilename, fallbackStem);
    if (!used.has(name)) {
      used.add(name);
      return name;
    }

    const stem = name.replace(/\.jpg$/i, "");
    let index = 2;
    while (used.has(`${stem} (${index}).jpg`)) index += 1;
    name = `${stem} (${index}).jpg`;
    used.add(name);
    return name;
  });
}
