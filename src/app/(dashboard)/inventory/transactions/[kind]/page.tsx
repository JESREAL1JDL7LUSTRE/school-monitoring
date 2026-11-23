import { InventoryBackButton } from "@/modules/inventory/back-button";
import { inventoryListHref, inventoryReturnTo } from "@/modules/inventory/return-navigation";
import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { recordId } from "@/lib/record-slug";
import { requirePermission } from "@/modules/auth/session";
import { getSchoolSettings } from "@/modules/settings/queries";
import { inventoryKinds, type InventoryKind } from "@/modules/inventory/database";
import { getInventoryDirectory, getInventoryIssued, getInventoryMaster } from "@/modules/inventory/queries";
import { dateInManila, inventoryKindLabels } from "@/modules/inventory/rules";
import { InventoryTransactionForm } from "@/modules/inventory/transaction-form";

const InventoryTransactionPage = async ({ params, searchParams }: {
  params: Promise<{ kind: string }>;
  searchParams: Promise<{ item?: string; category?: string; returnTo?: string }>;
}) => {
  await requirePermission("inventory.write");
  const [{ kind: raw }, { item, category, returnTo }] = await Promise.all([params, searchParams]);
  const kind = inventoryKinds.find((entry) => entry === raw) as InventoryKind | undefined;
  if (!kind) notFound();
  const [{ items }, employees, issued, settings] = await Promise.all([
    getInventoryMaster(),
    kind === "issue" ? getInventoryDirectory() : [],
    kind === "return" ? getInventoryIssued() : [],
    getSchoolSettings(),
  ]);
  const back = inventoryReturnTo(returnTo) ?? inventoryListHref(kind === "return" ? "issued" : "overview", category);
  const categoryId = recordId(category);
  const itemId = recordId(item);
  const available = items.filter((candidate) => !candidate.archived_at && (!category || candidate.category_id === categoryId)
    && (kind !== "issue" || (candidate.balance > 0 && candidate.condition === "Serviceable"))
    && (kind !== "disposal" || (candidate.balance > 0 && candidate.condition === "Unserviceable")));
  const itemIds = new Set(available.map((row) => row.id));
  const returnable = issued.filter((line) => line.outstanding > 0 && itemIds.has(line.item_id));
  const canPost = kind === "return" ? returnable.length > 0 : available.length > 0 && (kind !== "issue" || employees.length > 0);

  return (
    <div className="max-w-4xl space-y-5">
      <header className="space-y-2">
        <InventoryBackButton href={back} />
        <h1 className="text-3xl font-semibold tracking-tight">{inventoryKindLabels[kind]}</h1>
        <p className="text-muted-foreground">
          {kind === "issue" ? "The item classification determines whether the document is a draft RIS, ICS, or PAR."
            : kind === "return" ? "Returns are linked to the original issued line and update its outstanding quantity."
              : kind === "adjustment" ? "Enter a positive quantity to add stock or a negative quantity to deduct it."
                : kind === "disposal" ? "Record the disposal of unserviceable stock with its approval or reference details."
                  : "Record stock received and its acquisition reference."}
        </p>
      </header>
      <Card>
        <CardContent>
          {canPost ? <InventoryTransactionForm kind={kind} employees={employees} items={available} returns={returnable}
            date={dateInManila()} requestId={crypto.randomUUID()} returnTo={back} preferredItem={itemId && itemIds.has(itemId) ? itemId : undefined} thresholds={settings} />
            : <p className="text-muted-foreground">
              {kind === "return" ? "No outstanding issues are available to return." : "No eligible items or employees are available for this transaction."}
            </p>}
        </CardContent>
      </Card>
    </div>
  );
};

export default InventoryTransactionPage;
