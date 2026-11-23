import { InventoryBackButton } from "@/modules/inventory/back-button";
import { inventoryListHref, inventoryReturnTo } from "@/modules/inventory/return-navigation";
import { Card, CardContent } from "@/components/ui/card";
import { recordId } from "@/lib/record-slug";
import { requirePermission } from "@/modules/auth/session";
import { InventoryItemForm } from "@/modules/inventory/item-form";
import { getInventoryCategories } from "@/modules/inventory/queries";

const NewInventoryItemPage = async ({ searchParams }: { searchParams: Promise<{ category?: string; returnTo?: string }> }) => {
  await requirePermission("inventory.write");
  const [categories, { category, returnTo }] = await Promise.all([getInventoryCategories(), searchParams]);
  return (
    <div className="max-w-4xl space-y-5">
      <header className="space-y-2">
        <InventoryBackButton href={inventoryReturnTo(returnTo, false) ?? inventoryListHref("items", category)} />
        <h1 className="text-3xl font-semibold tracking-tight">Add inventory item</h1>
      </header>
      <Card><CardContent><InventoryItemForm categories={categories} categoryId={recordId(category)} /></CardContent></Card>
    </div>
  );
};

export default NewInventoryItemPage;
