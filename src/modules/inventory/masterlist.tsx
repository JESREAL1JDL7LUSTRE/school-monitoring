import Link from "next/link";
import type { ReactNode } from "react";
import { inventoryHref } from "./return-navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { InventoryActivityRow, InventoryIssuedLine, PhysicalCount } from "./database";
import type { StockItem } from "./queries";
import { classifyItem, dateInManila, money } from "./rules";
import { InventoryTable } from "./table";
import { InventoryCountForm, InventoryImportForm } from "./maintenance-forms";
import type { SchoolSettings } from "@/types/database";

export const InventoryMasterlist = ({ items, category, query, canWrite, settings, returnTo, pagination }: {
  items: StockItem[];
  category?: string;
  query?: string;
  canWrite: boolean;
  returnTo: string;
  pagination: ReactNode;
  settings: Pick<SchoolSettings, "ppe_threshold" | "semi_expendable_threshold">;
}) => {
  const filter = new URLSearchParams();
  if (category) filter.set("category", category);
  if (query) filter.set("q", query);
  const exportUrl = (format: string) => `/api/inventory/export?${new URLSearchParams({ ...Object.fromEntries(filter), format })}`;
  return (
    <Card>
      <CardHeader className="space-y-3">
        <CardTitle><h2>Item masterlist</h2></CardTitle>
        <div className="flex flex-wrap gap-2">
          {canWrite && <Button asChild><Link href={inventoryHref("/inventory/items/new", filter, returnTo)}>Add item</Link></Button>}
          <Button asChild variant="outline"><a href={exportUrl("xlsx")}>Export Excel</a></Button>
          <Button asChild variant="outline"><a href={exportUrl("csv")}>Export backup CSV</a></Button>
          <Button asChild variant="outline"><Link href={inventoryHref("/inventory/reports/tags", filter, returnTo)}>Print all tags</Link></Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <InventoryTable headings={["Code", "Item", "Category", "Purchased or received", "On hand", "Unit cost", "Value", "Condition"]} rows={items.map((item) => ({
          id: item.id, columns: [
            item.item_code,
            <Link key={item.id} href={inventoryHref(`/inventory/items/${item.id}`, undefined, returnTo)} className="font-medium text-primary underline underline-offset-4">{item.name}</Link>,
            item.category.name,
            item.totalReceived,
            <span key={item.id} className="inline-flex items-center gap-2">{item.balance} {item.unit}
              {!item.archived_at && item.balance <= item.reorder_point && <Badge variant="secondary">Low stock</Badge>}</span>,
            money(item.unit_cost),
            money(item.unit_cost * item.balance),
            <span key={item.id}>{item.archived_at ? "Archived" : item.condition} · {classifyItem(item, item.category.category_type, settings).label}</span>,
          ],
        }))} empty="No items match these filters." />
        {pagination}
        {canWrite && (
          <details className="rounded-lg border p-4">
            <summary className="cursor-pointer font-medium">Import Excel</summary>
            <p className="my-3 text-sm text-muted-foreground">Use category names already listed in School Admin Desk. Imports create items and record opening stock as receipts.</p>
            <p className="my-3"><a className="text-sm text-primary underline underline-offset-4" href={exportUrl("template")}>Download blank Excel template</a></p>
            <InventoryImportForm />
          </details>
        )}
      </CardContent>
    </Card>
  );
};

export const InventoryIssuedSummary = ({ lines, items, canWrite, category, all, custody, returnTo }: {
  lines: InventoryIssuedLine[];
  items: StockItem[];
  canWrite: boolean;
  returnTo: string;
  category?: string;
  all: boolean;
  custody: boolean;
}) => {
  const codes = new Map(items.map((item) => [item.id, item.item_code]));
  const query = new URLSearchParams({ view: "issued" });
  if (category) query.set("category", category);
  if (!all) query.set("scope", "all");
  if (custody) query.set("custody", "1");
  return (
    <Card>
      <CardHeader className="space-y-3">
        <CardTitle><h2>Issued items and custody</h2></CardTitle>
        <div className="flex flex-wrap gap-2">
          {canWrite && <Button asChild><Link href={inventoryHref("/inventory/transactions/return", new URLSearchParams(category ? { category } : {}), returnTo)}>Return stock</Link></Button>}
          <Button asChild variant="outline"><Link href={`/inventory?${query}`}>{all ? "Only outstanding" : "Include fully returned"}</Link></Button>
          <Button asChild variant="outline"><Link href={inventoryHref("/inventory/reports/issued", new URLSearchParams(category ? { category } : {}), returnTo)}>Print issued summary</Link></Button>
        </div>
      </CardHeader>
      <CardContent>
        <InventoryTable headings={["Issue document", "Item code", "Employee", "Date", "Issued", "Returned", "Outstanding"]} rows={lines.map((line) => ({
          id: String(line.issue_line_id), columns: [
            <Link key={line.issue_line_id} className="text-primary underline" href={inventoryHref(`/inventory/documents/${line.document_id}`, undefined, returnTo)}>{line.document_no}</Link>,
            codes.get(line.item_id) ?? "—", line.employee_name, line.transaction_date,
            line.issued_quantity, line.returned_quantity, line.outstanding,
          ],
        }))} empty="No issued items match these filters." />
      </CardContent>
    </Card>
  );
};

export const InventoryCounts = ({ items, latest, canWrite, category, returnTo }: {
  items: StockItem[];
  latest: Map<string, PhysicalCount>;
  canWrite: boolean;
  returnTo: string;
  category?: string;
}) => (
  <Card>
    <CardHeader className="space-y-3">
      <CardTitle><h2>Physical counts</h2></CardTitle>
      <div className="flex flex-wrap gap-2">
        {["rpci", "rpcppe", "annex-a"].map((slug) => (
          <Button key={slug} asChild variant="outline">
            <Link href={inventoryHref(`/inventory/reports/${slug}`, new URLSearchParams(category ? { category } : {}), returnTo)}>
              Print {slug === "annex-a" ? "Annex A" : slug.toUpperCase()}
            </Link>
          </Button>
        ))}
      </div>
    </CardHeader>
    <CardContent className="space-y-5">
      {canWrite && items.length > 0 && <InventoryCountForm items={items} date={dateInManila()} />}
      <InventoryTable headings={["Item", "Count date", "Per card", "On hand counted", "Variance", "Variance value"]} rows={items.map((item) => {
        const count = latest.get(item.id);
        return { id: item.id, columns: [item.name, count?.count_date ?? "—", count?.recorded_quantity ?? "—",
          count?.counted_quantity ?? "—", count ? count.counted_quantity - count.recorded_quantity : "—",
          count ? money((count.counted_quantity - count.recorded_quantity) * count.unit_cost) : "—"] };
      })} empty="No items are available to count." />
    </CardContent>
  </Card>
);

export const InventoryActivity = ({ documents, returnTo }: { documents: InventoryActivityRow[]; returnTo: string }) => (
  <Card>
    <CardHeader><CardTitle><h2>Recent transactions</h2></CardTitle></CardHeader>
    <CardContent>
      <InventoryTable headings={["Document", "Type", "Date", "Reference"]} rows={documents.map((document) => ({
        id: document.id, columns: [
          <Link className="text-primary underline underline-offset-4" key={document.id} href={inventoryHref(`/inventory/documents/${document.id}`, undefined, returnTo)}>{document.document_no}</Link>,
          document.kind, document.transaction_date, document.reference || "—",
        ],
      }))} empty="No transactions have been posted." />
    </CardContent>
  </Card>
);
