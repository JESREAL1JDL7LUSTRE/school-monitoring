import { RecordEditDialog } from "@/components/record-editor";
import { InventoryBackButton } from "@/modules/inventory/back-button";
import { inventoryReturnTo } from "@/modules/inventory/return-navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/modules/auth/session";
import { getInventoryCategories } from "@/modules/inventory/queries";
import { InventoryCategoryForm } from "@/modules/inventory/maintenance-forms";

const CategoriesPage = async ({ searchParams }: PageProps<"/inventory/categories">) => {
  await requirePermission("inventory.write");
  const [categories, { returnTo }] = await Promise.all([getInventoryCategories(), searchParams]);
  return (
    <div className="max-w-4xl space-y-5">
      <header className="space-y-2">
        <InventoryBackButton href={inventoryReturnTo(returnTo, false) ?? "/inventory"} />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">Inventory categories</h1>
          <RecordEditDialog trigger="Add category" description="Enter the category name and inventory type.">
            <InventoryCategoryForm />
          </RecordEditDialog>
        </div>
      </header>
      <Card>
        <CardHeader><CardTitle><h2>Categories</h2></CardTitle></CardHeader>
        <CardContent className="divide-y">
          {categories.map((category) => (
            <div key={category.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <h3 className="font-medium wrap-anywhere">{category.name}</h3>
                <p className="text-sm text-muted-foreground capitalize">{category.category_type}</p>
              </div>
              <RecordEditDialog trigger={`Edit ${category.name}`} title="Edit inventory category" description={category.name}>
                <InventoryCategoryForm category={category} />
              </RecordEditDialog>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default CategoriesPage;
