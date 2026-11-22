import { getInventoryMaster } from "@/modules/inventory/queries";
import { csvInventory, spreadsheetInventory } from "@/modules/inventory/workbook";

export const GET = async (request: Request) => {
  const { items } = await getInventoryMaster();
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const q = searchParams.get("q")?.trim().toLowerCase();
  const format = searchParams.get("format");
  const filtered = items.filter((item) => (!category || category === item.category_id)
    && (!q || `${item.item_code} ${item.name}`.toLowerCase().includes(q)));
  if (format === "csv") {
    return new Response("\uFEFF" + csvInventory(filtered), { headers: {
      "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="inventory.csv"',
      "Cache-Control": "private, no-store",
    } });
  }
  if (format !== "xlsx" && format !== "template") return new Response("Choose a supported export format.", { status: 400 });
  const bytes = await spreadsheetInventory(format === "template" ? [] : filtered);
  return new Response(new Uint8Array(bytes), { headers: {
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": `attachment; filename="${format === "template" ? "inventory-template" : "inventory"}.xlsx"`,
    "Cache-Control": "private, no-store",
  } });
};
