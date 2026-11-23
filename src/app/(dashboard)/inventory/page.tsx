import Link from "next/link";
import { TablePageLinks, tablePage, tablePageSize } from "@/components/table-page-links";
import { WorkspaceNavigation } from "@/components/workspace-navigation";
import { inventoryHref, inventoryViews } from "@/modules/inventory/return-navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { recordId, recordSlug } from "@/lib/record-slug";
import { hasPermission, requirePermission } from "@/modules/auth/session";
import { getSchoolSettings } from "@/modules/settings/queries";
import { InventoryActivity, InventoryCounts, InventoryIssuedSummary, InventoryMasterlist } from "@/modules/inventory/masterlist";
import { getInventoryCategories, getInventoryDocuments, getInventoryIssued, getInventoryItemsPage, getInventoryMaster, getLatestInventoryCounts } from "@/modules/inventory/queries";
import { inventoryConditions } from "@/modules/inventory/database";
import { InventoryCategoryNavigation, InventoryCategoryTools } from "@/modules/inventory/navigation";
import { InventoryOverview } from "@/modules/inventory/overview";

const reports = [
  ["rsmi", "Report of Supplies and Materials Issued (RSMI)"],
  ["rpci", "Report on the Physical Count of Inventories (RPCI)"],
  ["rpcppe", "Report on the Physical Count of Property, Plant and Equipment (RPCPPE)"],
  ["iirup", "Inventory and Inspection Report of Unserviceable Property (IIRUP)"],
  ["waste", "Waste Materials Report"],
  ["annex-a", "Inventory Count Form (Annex A)"],
  ["annex-1", "Science and Mathematics Equipment Certification (Annex 1)"],
  ["nsbi", "School Building Inventory Report (NSBI)"],
  ["issued", "Issued summary"],
  ["tags", "Property tags"],
] as const;

const InventoryPage = async ({ searchParams }: {
  searchParams: Promise<{ category?: string; q?: string; view?: string; scope?: string; low?: string; active?: string; condition?: string; custody?: string; page?: string }>;
}) => {
  const { category, q, view, scope, low, active: activeOnly, condition, custody, page: pageParam } = await searchParams;
  const match = typeof q === "string" ? q.trim() : "";
  const activeView = inventoryViews.find(([value]) => value === view)?.[0] ?? "overview";
  const selectedCondition = inventoryConditions.find((value) => value === condition);
  const categoryId = recordId(category);
  const page = tablePage(pageParam);
  const dbFilters = {
    p_category: categoryId,
    p_q: match, p_condition: selectedCondition, p_active: activeOnly === "1", p_low: low === "1",
  };
  const [session, { items, categories, total }, settings, documents, issued, counts] = await Promise.all([
    requirePermission("inventory.read"),
    activeView === "items" ? getInventoryItemsPage(dbFilters, page, tablePageSize)
      : activeView === "reports" ? getInventoryCategories().then((categories) => ({ categories, items: [], total: 0 }))
      : getInventoryMaster().then((master) => ({ ...master, total: 0 })),
    activeView === "items" ? getSchoolSettings() : null,
    activeView === "overview" ? getInventoryDocuments(dbFilters) : [],
    activeView === "issued" || activeView === "overview" ? getInventoryIssued() : [],
    activeView === "counts" || activeView === "overview" ? getLatestInventoryCounts() : new Map(),
  ]);
  const selected = categories.find((row) => row.id === categoryId);
  const selectedReference = selected && recordSlug(selected.name, selected.id);
  const filtered = items.filter((item) => (!selected || selected.id === item.category_id)
    && (!match || `${item.item_code} ${item.name}`.toLowerCase().includes(match.toLowerCase()))
    && (!selectedCondition || item.condition === selectedCondition)
    && (activeOnly !== "1" || !item.archived_at)
    && (low !== "1" || (!item.archived_at && item.balance <= item.reorder_point)));
  const active = filtered.filter((item) => item.archived_at === null);
  const itemIds = new Set(filtered.map(({ id }) => id));
  const canWrite = hasPermission(session, "inventory.write");
  const query = new URLSearchParams();
  if (selectedReference) query.set("category", selectedReference);
  if (match) query.set("q", match);
  const categoryFilters = new URLSearchParams(query);
  if (selectedCondition) categoryFilters.set("condition", selectedCondition);
  if (activeOnly === "1") categoryFilters.set("active", activeOnly);
  if (low === "1") categoryFilters.set("low", low);
  if (custody === "1") categoryFilters.set("custody", custody);
  if (scope === "all") categoryFilters.set("scope", scope);

  categoryFilters.set("view", activeView);
  const pageHref = (number: number) => {
    const params = new URLSearchParams(categoryFilters);
    if (number > 1) params.set("page", String(number));
    return inventoryHref("/inventory", params);
  };
  const returnTo = pageHref(activeView === "items" ? page : 1);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="desk-heading">{selected?.name ?? "Property and inventory"}</h1>
        {canWrite && <Button asChild variant="outline"><Link href={inventoryHref("/inventory/categories", undefined, returnTo)}>Manage categories</Link></Button>}
      </header>
      <InventoryCategoryNavigation categories={categories} selected={selected} activeView={activeView} filters={categoryFilters} />
      <WorkspaceNavigation label="Inventory views" items={inventoryViews.map(([value, label]) => {
        const target = new URLSearchParams(query);
        target.set("view", value);
        return { href: inventoryHref("/inventory", target), active: activeView === value, label };
      })} />
      <form className="flex flex-wrap items-end gap-3" action="/inventory">
        <input type="hidden" name="view" value={activeView} />
        {selectedReference && <input type="hidden" name="category" value={selectedReference} />}
        {["scope", "active", "low", "custody"].map((field) => {
          const value = categoryFilters.get(field);
          return value && <input key={field} type="hidden" name={field} value={value} />;
        })}
        <div className="grid w-full gap-2 sm:max-w-80"><Label htmlFor="q">Search items</Label><Input variant="touch" id="q" name="q" placeholder="Name or code" defaultValue={match} /></div>
        {activeView === "items" && <div className="grid w-full gap-2 sm:w-auto">
          <Label htmlFor="condition">Condition</Label>
          <NativeSelect id="condition" name="condition" size="touch" className="w-full" defaultValue={selectedCondition ?? ""}>
            <NativeSelectOption value="">All conditions</NativeSelectOption>
            {inventoryConditions.map((value) => <NativeSelectOption key={value} value={value}>{value}</NativeSelectOption>)}
          </NativeSelect>
        </div>}
        <div className="ml-auto flex flex-wrap justify-end gap-2">
          {(low === "1" || activeOnly === "1" || custody === "1") && <Button asChild variant="ghost"><Link href={`/inventory?view=${activeView}&${query}`}>Clear focused filter</Link></Button>}
          <Button type="submit" variant="outline">Apply filters</Button>
        </div>
      </form>
      <InventoryCategoryTools category={selected} filters={query} canWrite={canWrite} returnTo={returnTo} />
      {activeView === "overview" && (
        <>
          <InventoryOverview items={active} issued={issued} counts={counts} query={query} />
          <InventoryActivity returnTo={returnTo} documents={documents} />
        </>
      )}
      {activeView === "items" && settings && <InventoryMasterlist returnTo={returnTo} items={items} category={selectedReference} query={match} canWrite={canWrite} settings={settings}
        pagination={<TablePageLinks previous={page > 1 ? pageHref(Math.min(page - 1, Math.max(1, Math.ceil(total / tablePageSize)))) : undefined}
          next={page * tablePageSize < total ? pageHref(page + 1) : undefined}
          label={items.length ? `Rows ${(page - 1) * tablePageSize + 1}–${(page - 1) * tablePageSize + items.length} of ${total}` : `${total} matching items`} />} />}
      {activeView === "issued" && <InventoryIssuedSummary returnTo={returnTo} lines={issued.filter((line) => itemIds.has(line.item_id) && (scope === "all" || line.outstanding > 0)
        && (custody !== "1" || line.form_type !== "RIS"))}
        items={filtered} category={selectedReference} canWrite={canWrite} all={scope === "all"} custody={custody === "1"} />}
      {activeView === "counts" && <InventoryCounts returnTo={returnTo} items={active} latest={counts} canWrite={canWrite} category={selectedReference} />}
      {activeView === "reports" && (
        <Card><CardHeader><CardTitle><h2>Printable property reports</h2></CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {reports.map(([slug, name]) => <li key={slug}><Button asChild variant="ghost" className="h-auto min-h-11 whitespace-normal"><Link href={inventoryHref(`/inventory/reports/${slug}`, query, returnTo)}>{name}</Link></Button></li>)}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default InventoryPage;
