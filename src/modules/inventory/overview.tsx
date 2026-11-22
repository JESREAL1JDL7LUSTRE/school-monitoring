import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { inventoryConditions, type InventoryIssuedLine, type PhysicalCount } from "./database";
import type { StockItem } from "./queries";
import { money } from "./rules";

export const InventoryOverview = ({ items, issued, counts, query }: {
  items: StockItem[];
  issued: InventoryIssuedLine[];
  counts: Map<string, PhysicalCount>;
  query: URLSearchParams;
}) => {
  const link = (values: Record<string, string>) => "/inventory?" +
    new URLSearchParams({ ...Object.fromEntries(query), ...values }).toString();
  const itemIds = new Set(items.map((item) => item.id));
  const custodyIds = new Set(issued.filter((line) => line.form_type !== "RIS" && line.outstanding > 0 && itemIds.has(line.item_id))
    .map((line) => line.item_id));
  const low = items.filter((item) => item.balance <= item.reorder_point).length;
  const stockValue = items.reduce((sum, item) => sum + item.balance * item.unit_cost, 0);
  const variance = items.reduce((sum, item) => {
    const count = counts.get(item.id);
    return sum + (count ? (count.counted_quantity - count.recorded_quantity) * count.unit_cost : 0);
  }, 0);
  const valueGroups = new Map<string, { name: string; value: number }>();
  for (const item of items) {
    const current = valueGroups.get(item.category.id);
    const value = item.balance * item.unit_cost;
    valueGroups.set(item.category.id, { name: item.category.name, value: (current?.value ?? 0) + value });
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Active items", value: items.length, target: link({ view: "items", active: "1" }) },
          { label: "At or below reorder point", value: low, target: link({ view: "items", low: "1" }) },
          { label: "Recorded stock value", value: money(stockValue), target: link({ view: "items", active: "1" }) },
          { label: "Net recorded count variance", value: money(variance), target: link({ view: "counts" }) },
        ].map(({ label, value, target }) => (
          <Card key={label}>
            <CardContent><Link href={target} className="block rounded outline-offset-4 hover:text-primary">
              <dl><dt className="text-sm text-muted-foreground">{label}</dt><dd className="text-2xl font-semibold tabular-nums">{value}</dd></dl>
            </Link></CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle><h2>Value by category</h2></CardTitle></CardHeader>
          <CardContent>
            {valueGroups.size ? <dl className="divide-y">
              {[...valueGroups].sort(([, left], [, right]) => right.value - left.value).map(([id, entry]) => (
                <div key={id} className="flex items-center justify-between gap-2 py-1">
                  <dt><Link className="inline-flex min-h-9 items-center hover:underline" href={link({ category: id, view: "items", active: "1" })}>{entry.name}</Link></dt>
                  <dd className="tabular-nums">{money(entry.value)}</dd>
                </div>
              ))}
            </dl> : <p className="text-sm text-muted-foreground">No stock matches these filters.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle><h2>Item condition</h2></CardTitle></CardHeader>
          <CardContent>
            <dl className="divide-y">
              {inventoryConditions.map((condition) => {
                const count = items.filter((item) => item.condition === condition).length;
                return <div key={condition} className="flex items-center justify-between gap-2 py-1">
                  <dt><Link className="inline-flex min-h-9 items-center hover:underline" href={link({ view: "items", active: "1", condition })}>{condition}</Link></dt>
                  <dd className="tabular-nums">{count}</dd>
                </div>;
              })}
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle><h2>Accountability</h2></CardTitle></CardHeader>
          <CardContent>
            <dl className="divide-y">
              <div className="flex items-center justify-between gap-2 py-1">
                <dt><Link className="inline-flex min-h-9 items-center hover:underline" href={link({ view: "issued", custody: "1" })}>With an accountable person</Link></dt>
                <dd className="tabular-nums">{custodyIds.size}</dd>
              </div>
              <div className="flex items-center justify-between gap-2 py-3">
                <dt>Without active custody</dt><dd className="tabular-nums">{items.length - custodyIds.size}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>
    </>
  );
};
