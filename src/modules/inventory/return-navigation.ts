const origin = "https://inventory.invalid";
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
export const inventoryViews = [
  ["overview", "Overview"], ["items", "Item masterlist"], ["issued", "Issued items"],
  ["counts", "Physical counts"], ["reports", "Forms and reports"],
] as const;

export type InventoryView = (typeof inventoryViews)[number][0];
const filters = ["category", "view", "q", "condition", "scope", "active", "low", "custody", "page"];

export function inventoryHref(path: string, params: URLSearchParams = new URLSearchParams(), returnTo?: string) {
  const query = new URLSearchParams(params);
  if (returnTo) query.set("returnTo", returnTo);
  return query.size ? `${path}?${query}` : path;
}

export function inventoryListHref(view: InventoryView, category?: string) {
  const params = new URLSearchParams({ view });
  if (category && uuid.test(category)) params.set("category", category);
  return inventoryHref("/inventory", params);
}

export function inventoryReturnTo(value: unknown, allowItem = true): string | undefined {
  if (typeof value !== "string" || !value.startsWith("/inventory") || value.length > 2000) return;
  const target = new URL(value, origin);
  if (target.origin !== origin || target.hash) return;
  if (target.pathname === "/inventory") {
    const query = new URLSearchParams();
    for (const field of filters) {
      const entry = target.searchParams.get(field);
      if (!entry) continue;
      if (field === "category" && !uuid.test(entry)) continue;
      if (field === "view" && !inventoryViews.some(([view]) => view === entry)) continue;
      if (field === "page" && !/^\d{1,7}$/.test(entry)) continue;
      query.set(field, entry);
    }
    return inventoryHref(target.pathname, query);
  }
  const itemId = target.pathname.slice("/inventory/items/".length);
  if (allowItem && target.pathname.startsWith("/inventory/items/") && uuid.test(itemId)) {
    return inventoryHref(target.pathname, undefined, inventoryReturnTo(target.searchParams.get("returnTo"), false));
  }
}
