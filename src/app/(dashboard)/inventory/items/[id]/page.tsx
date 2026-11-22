import Link from "next/link";
import { TablePageLinks } from "@/components/table-page-links";
import { InventoryBackButton } from "@/modules/inventory/back-button";
import { inventoryHref, inventoryListHref, inventoryReturnTo } from "@/modules/inventory/return-navigation";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { hasPermission, requirePermission } from "@/modules/auth/session";
import { InventoryItemForm } from "@/modules/inventory/item-form";
import { InventoryCountForm } from "@/modules/inventory/maintenance-forms";
import { getInventoryCategories, getInventoryItem, getItemCounts, getItemLedgerPage } from "@/modules/inventory/queries";
import { dateInManila, money } from "@/modules/inventory/rules";
import { InventoryTable } from "@/modules/inventory/table";

const InventoryItemPage = async ({ params, searchParams }: PageProps<"/inventory/items/[id]">) => {
  const [{ id }, search] = await Promise.all([params, searchParams]);
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id)) notFound();
  const session = await requirePermission("inventory.read");
  const canWrite = hasPermission(session, "inventory.write");
  const [categories, item, ledger, counts] = await Promise.all([
    canWrite ? getInventoryCategories() : [], getInventoryItem(id), getItemLedgerPage(id, search), getItemCounts(id),
  ]);
  const back = inventoryReturnTo(search.returnTo, false) ?? inventoryListHref("items", item.category_id);
  const itemHref = inventoryHref(`/inventory/items/${id}`, undefined, back);
  const itemParams = new URLSearchParams({ item: id });
  const ledgerHref = (direction: "older" | "newer", row: { transaction_date: string; id: string }) =>
    inventoryHref(`/inventory/items/${id}`, new URLSearchParams({ [direction]: `${row.transaction_date},${row.id}` }), back);
  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <InventoryBackButton href={back} />
        <h1 className="text-3xl font-semibold tracking-tight">{item.name}</h1>
        <p className="text-muted-foreground">{item.item_code} · {item.category.name} · {item.condition}{item.archived_at && " · Archived"}</p>
      </header>
      <div className="flex flex-wrap gap-2 print:hidden">
        <Button variant="outline" asChild><Link href={inventoryHref("/inventory/reports/stock-card", itemParams, itemHref)}>Print stock card</Link></Button>
        <Button variant="outline" asChild><Link href={inventoryHref("/inventory/reports/tags", itemParams, itemHref)}>Print tag</Link></Button>
        {item.category.category_type === "building" && <Button asChild variant="outline"><Link href={inventoryHref("/inventory/reports/building-card", itemParams, itemHref)}>Print building card</Link></Button>}
        {canWrite && !item.archived_at && <Button asChild><Link href={inventoryHref("/inventory/transactions/receipt", itemParams, itemHref)}>Receive stock</Link></Button>}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["On hand", `${item.balance} ${item.unit}`],
          ["Reorder point", item.reorder_point],
          ["Unit cost", money(item.unit_cost)],
        ].map(([label, value]) => (
          <Card key={String(label)}><CardContent><dl><dt className="text-sm text-muted-foreground">{label}</dt><dd className="text-2xl font-semibold tabular-nums">{value}</dd></dl></CardContent></Card>
        ))}
      </div>
      {canWrite && (
        <Card>
          <CardHeader><CardTitle><h2>Edit item</h2></CardTitle></CardHeader>
          <CardContent><InventoryItemForm categories={categories} item={item} /></CardContent>
        </Card>
      )}
      <Card>
        <CardHeader><CardTitle><h2>Stock card</h2></CardTitle></CardHeader>
        <CardContent>
          <InventoryTable headings={["Transaction date", "Document", "Type", "Quantity change", "Balance"]} rows={ledger.rows.map((entry) => ({
            id: String(entry.id), columns: [
              entry.transaction_date, <Link key={entry.id} className="underline" href={inventoryHref(`/inventory/documents/${entry.document_id}`, undefined, itemHref)}>{entry.document_no}</Link>,
              entry.kind, entry.quantity_delta, entry.running_balance,
            ],
          }))} empty="No transactions have been posted for this item." />
          <TablePageLinks previous={ledger.previous ? ledgerHref("newer", ledger.previous) : ledger.emptyCursor ? itemHref : undefined}
            next={ledger.next ? ledgerHref("older", ledger.next) : undefined} label={`${ledger.rows.length} stock movements`} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle><h2>Physical counts</h2></CardTitle></CardHeader>
        <CardContent className="space-y-5">
          {canWrite && !item.archived_at && <InventoryCountForm items={[item]} date={dateInManila()} />}
          <InventoryTable headings={["Count date", "Recorded", "Counted", "Variance", "Location", "Remarks"]}
            rows={counts.map((count) => ({
              id: count.id, columns: [count.count_date, count.recorded_quantity, count.counted_quantity,
                count.counted_quantity - count.recorded_quantity, count.location || "—", count.remarks || "—"],
            }))} empty="No counts have been recorded." />
        </CardContent>
      </Card>
    </div>
  );
};

export default InventoryItemPage;
