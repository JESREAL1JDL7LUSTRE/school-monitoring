import { getSession, hasPermission } from "@/modules/auth/session";
import { getInventoryMaster } from "@/modules/inventory/queries";
import { csvInventory, spreadsheetInventory } from "@/modules/inventory/workbook";

export const GET = async (request: Request) => {
  const session = await getSession();
  if (!session) return new Response("Sign in to export inventory.", { status: 401 });
  if (!hasPermission(session, "inventory.read")) return new Response("Inventory access is required.", { status: 403 });
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const q = searchParams.get("q")?.trim().toLowerCase();
  const format = searchParams.get("format");
  if (format !== "csv" && format !== "xlsx" && format !== "template") {
    return new Response("Choose a supported export format.", { status: 400 });
  }
  const items = format === "template" ? [] : (await getInventoryMaster()).items;
  const filtered = items.filter((item) => (!category || category === item.category_id)
    && (!q || `${item.item_code} ${item.name}`.toLowerCase().includes(q)));
  if (format === "csv") {
    return new Response("\uFEFF" + csvInventory(filtered), { headers: {
      "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="inventory.csv"',
      "Cache-Control": "private, no-store",
    } });
  }
  const bytes = await spreadsheetInventory(filtered);
  return new Response(new Uint8Array(bytes), { headers: {
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": `attachment; filename="${format === "template" ? "inventory-template" : "inventory"}.xlsx"`,
    "Cache-Control": "private, no-store",
  } });
};
