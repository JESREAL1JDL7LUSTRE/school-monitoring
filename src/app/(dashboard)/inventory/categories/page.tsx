import { InventoryBackButton } from "@/modules/inventory/back-button";
import { inventoryReturnTo } from "@/modules/inventory/return-navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/modules/auth/session";
import { getInventoryMaster } from "@/modules/inventory/queries";
import { InventoryCategoryForm } from "@/modules/inventory/maintenance-forms";

const CategoriesPage = async ({ searchParams }: PageProps<"/inventory/categories">) => {
  await requirePermission("inventory.write");
  const [{ categories }, { returnTo }] = await Promise.all([getInventoryMaster(), searchParams]);
  return (
    <div className="max-w-4xl space-y-5">
      <header className="space-y-2">
        <InventoryBackButton href={inventoryReturnTo(returnTo, false) ?? "/inventory"} />
        <h1 className="text-3xl font-semibold tracking-tight">Inventory categories</h1>
      </header>
      <Card>
        <CardHeader><CardTitle><h2>New category</h2></CardTitle></CardHeader>
        <CardContent><InventoryCategoryForm /></CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle><h2>Edit categories</h2></CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {categories.map((category) => (
            <details key={category.id} className="rounded-lg border p-4">
              <summary className="min-h-8 cursor-pointer font-medium">{category.name}</summary>
              <InventoryCategoryForm category={category} />
            </details>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default CategoriesPage;
