import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { recordSlug } from "@/lib/record-slug";
import { inventoryKinds, type InventoryCategory, type InventoryKind } from "./database";
import { inventoryKindLabels } from "./rules";
import { inventoryHref, type InventoryView } from "./return-navigation";

const reportTools = {
  supplies: [["rsmi", "RSMI"], ["stock-card", "Stock card"], ["rpci", "RPCI"]],
  books: [["stock-card", "Stock card"], ["rpci", "RPCI"], ["iirup", "IIRUP"], ["waste", "Waste materials"], ["issued", "Issued books summary"]],
  equipment: [["rpci", "RPCI"], ["rpcppe", "RPCPPE"], ["iirup", "IIRUP"], ["waste", "Waste materials"], ["issued", "Issued summary"]],
  building: [["building-card", "School building card"], ["nsbi", "NSBI"], ["rpci", "RPCI"], ["rpcppe", "RPCPPE"], ["iirup", "IIRUP"], ["waste", "Waste materials"]],
} as const;

const issueLabels = {
  supplies: "New RIS", books: "Issue stock (ICS or PAR)", equipment: "Issue stock (ICS or PAR)", building: "New PAR",
} satisfies Record<InventoryCategory["category_type"], string>;

const transactionLabel = (kind: InventoryKind, category: InventoryCategory | undefined) => {
  if (kind === "issue" && category) return issueLabels[category.category_type];
  if (kind === "return" && category?.category_type === "books") return "Return books";
  return inventoryKindLabels[kind];
};

export function InventoryCategoryNavigation({ categories, selected, activeView, filters }: {
  categories: InventoryCategory[];
  selected: InventoryCategory | undefined;
  activeView: InventoryView;
  filters: URLSearchParams;
}) {
  const categoryHref = (id?: string) => {
    const target = new URLSearchParams(filters);
    if (id) target.set("category", id);
    else target.delete("category");
    target.set("view", activeView);
    return `/inventory?${target}`;
  };

  return (
    <Card className="py-0">
      <CardContent>
        <details open className="group">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-md text-sm font-semibold [&::-webkit-details-marker]:hidden">
            Inventory categories <ChevronDown size={16} aria-hidden className="motion-safe:transition-transform group-open:rotate-180" />
          </summary>
          <nav aria-label="Inventory categories" className="flex flex-wrap gap-1 pb-3">
            <Button asChild variant={selected ? "ghost" : "secondary"} className="px-3">
              <Link href={categoryHref()} aria-current={selected ? undefined : "page"}>All categories</Link>
            </Button>
            {categories.map(({ id, name }) => (
              <Button asChild key={id} variant={id === selected?.id ? "secondary" : "ghost"} className="h-auto min-h-11 max-w-full px-3 whitespace-normal text-left">
                <Link href={categoryHref(recordSlug(name, id))} aria-current={id === selected?.id ? "page" : undefined}>{name}</Link>
              </Button>
            ))}
          </nav>
        </details>
      </CardContent>
    </Card>
  );
}

export function InventoryCategoryTools({ category, filters, canWrite, returnTo }: {
  category: InventoryCategory | undefined;
  filters: URLSearchParams;
  canWrite: boolean;
  returnTo: string;
}) {
  const reports: ReadonlyArray<readonly [string, string]> = category ? reportTools[category.category_type] : [];
  const transactionParams = new URLSearchParams(category ? { category: recordSlug(category.name, category.id) } : {});
  if (!canWrite && !reports.length) return null;

  return (
    <Card className="py-3">
      <CardContent>
        <nav aria-label="Inventory tools" className="flex flex-wrap gap-2">
          {canWrite && inventoryKinds.map((kind) => (
            <Button asChild key={kind} variant={kind === "issue" ? "default" : "outline"}>
              <Link href={inventoryHref(`/inventory/transactions/${kind}`, transactionParams, returnTo)}>{transactionLabel(kind, category)}</Link>
            </Button>
          ))}
          {reports.map(([slug, label]) => (
            <Button asChild key={slug} variant="outline"><Link href={inventoryHref(`/inventory/reports/${slug}`, filters, returnTo)}>{label}</Link></Button>
          ))}
          {category?.name === "Science and Math" && (
            <Button asChild variant="outline"><Link href={inventoryHref("/inventory/reports/annex-1", filters, returnTo)}>Annex 1</Link></Button>
          )}
        </nav>
      </CardContent>
    </Card>
  );
}
