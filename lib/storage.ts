import { Asset, Kind } from "./types";
import { isKind, SEED_ASSETS, STORAGE_KEY } from "./seed";

function parseAssets(raw: string | null): Asset[] | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return null;
    const assets: Asset[] = [];
    for (const item of data) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      if (typeof row.id !== "string" || typeof row.url !== "string") continue;
      if (typeof row.title !== "string" || !isKind(String(row.kind))) continue;
      assets.push({
        id: row.id,
        title: row.title,
        url: row.url,
        kind: row.kind as Kind,
        category: typeof row.category === "string" ? row.category : "Unsorted",
        tags: Array.isArray(row.tags)
          ? row.tags.filter((t): t is string => typeof t === "string")
          : [],
        notes: typeof row.notes === "string" ? row.notes : "",
        favorite: Boolean(row.favorite),
        createdAt:
          typeof row.createdAt === "string"
            ? row.createdAt
            : new Date().toISOString(),
        updatedAt:
          typeof row.updatedAt === "string"
            ? row.updatedAt
            : new Date().toISOString(),
      });
    }
    return assets;
  } catch {
    return null;
  }
}

export function loadAssets(): Asset[] {
  if (typeof window === "undefined") return SEED_ASSETS;
  const parsed = parseAssets(window.localStorage.getItem(STORAGE_KEY));
  if (parsed) return parsed;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_ASSETS));
  return SEED_ASSETS;
}

export function saveAssets(assets: Asset[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(assets));
}

export function exportJson(assets: Asset[]) {
  const blob = new Blob([JSON.stringify(assets, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `myassets-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function parseImport(text: string): Asset[] {
  const parsed = parseAssets(text);
  if (!parsed) throw new Error("That file is not a MyAssets catalog.");
  return parsed;
}

export function hostnameOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function faviconOf(url: string) {
  const host = hostnameOf(url);
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`;
}

export function matchesQuery(asset: Asset, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = [
    asset.title,
    asset.url,
    asset.category,
    asset.notes,
    asset.kind,
    ...asset.tags,
  ]
    .join(" ")
    .toLowerCase();
  return q.split(/\s+/).every((token) => hay.includes(token));
}

export function newId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `a-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
