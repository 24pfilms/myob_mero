export interface ParsedUrlItem {
  url: string;
  custom_title?: string;
}

export function isValidUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function parseUrlTextFile(content: string): ParsedUrlItem[] {
  const items: ParsedUrlItem[] = [];

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const parts = line.split(/\s*[|\t]\s*/, 2);
    const urlFirst = isValidUrl(parts[0]);
    const url = urlFirst ? parts[0] : parts[1];
    const title = urlFirst ? parts[1] : parts[0];
    if (!url || !isValidUrl(url)) continue;

    items.push({ url: url.trim(), ...(title?.trim() ? { custom_title: title.trim() } : {}) });
  }

  return items;
}

export function detectContentType(value: string) {
  const url = value.toLowerCase();
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "youtube";
  if (url.includes("github.com")) return "github";
  if (/\.pdf(?:$|[?#])/.test(url)) return "pdf";
  return "article";
}

export function getContentTypeIcon(contentType: string) {
  return { youtube: "🎬", github: "💻", pdf: "📄", article: "🌐" }[contentType] ?? "🔗";
}
