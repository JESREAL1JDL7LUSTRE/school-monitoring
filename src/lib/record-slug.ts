const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*--([a-zA-Z0-9_-]{22})$/;

function recordKey(id: string): string {
  const hex = id.replaceAll("-", "");
  const bytes = Array.from({ length: 16 }, (_, index) => Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16));
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

/** Keeps the readable label separate from the record key so renamed records keep their old links. */
export function recordSlug(label: string, id: string): string {
  const prefix = label.normalize("NFKD").replace(/\p{Mark}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-")
    .slice(0, 64).replace(/^-+|-+$/g, "");
  return `${prefix || "record"}--${recordKey(id)}`;
}

export function recordId(reference: unknown): string | undefined {
  if (typeof reference !== "string" || reference.length > 88) return;
  if (uuid.test(reference)) return reference.toLowerCase();
  const key = slug.exec(reference)?.[1];
  if (!key) return;
  const bytes = atob(key.replaceAll("-", "+").replaceAll("_", "/"));
  const hex = Array.from(bytes, (byte) => byte.charCodeAt(0).toString(16).padStart(2, "0")).join("");
  const id = [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join("-");
  return recordKey(id) === key ? id : undefined;
}

export function withRouteQuery(path: string, search: Record<string, string | string[] | undefined> = {}): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    for (const entry of Array.isArray(value) ? value : [value]) {
      if (entry !== undefined) params.append(key, entry);
    }
  }
  return params.size ? `${path}?${params}` : path;
}
