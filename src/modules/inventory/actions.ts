"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/modules/auth/session";
import { inventoryCategoryInput, inventoryCountInput, inventoryDocumentInput, inventoryItemInput } from "./validation";
import { inventoryDetailFields } from "./rules";
import { parseInventoryWorkbook } from "./workbook";
import { inventoryHref, inventoryReturnTo } from "./return-navigation";

export type InventoryActionState = { error?: string; message?: string };

const errorState = (error: string): InventoryActionState => ({ error });
const read = (form: FormData, name: string) => String(form.get(name) ?? "");
const updateInventoryPages = () => {
  revalidatePath("/inventory", "layout");
  revalidatePath("/", "page");
};

export const saveInventoryItem = async (
  _previous: InventoryActionState, form: FormData,
): Promise<InventoryActionState> => {
  const { supabase } = await requirePermission("inventory.write");
  const parsed = inventoryItemInput.safeParse({
    ...Object.fromEntries(form),
    opening_quantity: read(form, "opening_quantity") || 0,
    details: Object.fromEntries(inventoryDetailFields.map(([key]) => [key, read(form, key)])),
  });
  if (!parsed.success) return errorState("Check the item details, cost, and quantities.");
  const id = read(form, "item_id") || null;
  const expected = read(form, "updated_at") || null;
  const { opening_quantity, ...item } = parsed.data;
  if (!id) {
    const { error } = await supabase.rpc("import_inventory_master", { p_rows: [{ ...item, opening_quantity }] });
    if (error) return errorState(error.code === "23505" ? "This item code is already used." : "Could not save this item.");
    updateInventoryPages();
    redirect("/inventory?category=" + item.category_id + "&view=items");
  }

  const { data, error } = await supabase.rpc("save_inventory_item", {
    p_id: id,
    p_expected: expected,
    p_values: { ...item, archived_at: form.get("archived") === "on" ? new Date().toISOString() : null },
  });
  if (error) return errorState(error.code === "23505" ? "This item code is already used." : error.code === "P0001" ? error.message : "Could not save this item.");
  if (!data) return errorState("Another staff member changed this item. Reload before saving.");
  updateInventoryPages();
  return { message: "Item details saved." };
};

export const saveInventoryCategory = async (
  _previous: InventoryActionState, form: FormData,
): Promise<InventoryActionState> => {
  const { supabase } = await requirePermission("inventory.write");
  const parsed = inventoryCategoryInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return errorState("Enter a category name and choose a type.");
  const { data, error } = await supabase.rpc("save_inventory_category", {
    p_id: read(form, "category_id") || null, p_expected: read(form, "updated_at") || null,
    p_name: parsed.data.name, p_type: parsed.data.category_type,
  });
  if (error) return errorState(error.code === "23505" ? "This category name is already used." : "Could not save this category.");
  if (!data) return errorState("Another staff member changed this category. Reload before saving.");
  updateInventoryPages();
  return { message: "Category saved." };
};

export const postInventoryDocument = async (
  _previous: InventoryActionState, form: FormData,
): Promise<InventoryActionState> => {
  const { supabase } = await requirePermission("inventory.write");
  const unitCosts = form.getAll("unit_cost");
  const returnLines = form.getAll("issue_line");
  const quantities = form.getAll("quantity");
  const lines = form.getAll("item_id").map((item, index) => {
    const [returnLine, returnItem] = String(returnLines[index] ?? "").split(":");
    return {
      item_id: returnItem || item,
      quantity: quantities[index],
      unit_cost: unitCosts[index] ? unitCosts[index] : undefined,
      issue_line_id: returnLine ? Number(returnLine) : undefined,
    };
  });
  const parsed = inventoryDocumentInput.safeParse({
    kind: read(form, "kind"), date: read(form, "date"), employee: read(form, "employee") || undefined,
    reference: read(form, "reference"), requestId: read(form, "request_id"), lines,
    disposal: read(form, "kind") === "disposal" ? {
      method: read(form, "disposal_method"),
      receipt_number: read(form, "receipt_number") || undefined,
      proceeds: read(form, "proceeds") || undefined,
    } : undefined,
  });
  if (!parsed.success) {
    if (parsed.error.issues.some((issue) => issue.path[0] === "disposal")) {
      return errorState("Choose a disposal method and enter an official receipt number if recording proceeds.");
    }
    return errorState("Check the date, recipient, and transaction lines.");
  }
  const input = parsed.data;
  if (input.lines.some(({ quantity }) => quantity === 0 || (quantity < 0 && input.kind !== "adjustment"))) {
    return errorState("Enter a positive quantity or a nonzero signed adjustment.");
  }
  const { data, error } = await supabase.rpc("post_inventory_document", {
    p_kind: input.kind, p_date: input.date, p_employee_id: input.employee, p_reference: input.reference,
    p_request_id: input.requestId, p_lines: input.lines,
    p_disposal_details: input.disposal,
  });
  if (error) return errorState(error.code === "P0001" ? error.message : "The transaction could not be posted. Check the details and try again.");
  updateInventoryPages();
  redirect(inventoryHref("/inventory/documents/" + data, undefined, inventoryReturnTo(form.get("returnTo"))));
};

export const savePhysicalCount = async (
  _previous: InventoryActionState, form: FormData,
): Promise<InventoryActionState> => {
  const { supabase } = await requirePermission("inventory.write");
  const parsed = inventoryCountInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return errorState("Check the count date, item, and quantity.");
  const input = parsed.data;
  const { error } = await supabase.rpc("record_inventory_count", {
    p_item_id: input.item, p_date: input.date, p_quantity: input.quantity, p_location: input.location, p_remarks: input.remarks,
  });
  if (error) return errorState(error.code === "P0001" ? error.message : "Could not save the physical count.");
  updateInventoryPages();
  return { message: "Physical count recorded." };
};

export const importInventoryWorkbook = async (
  _previous: InventoryActionState, form: FormData,
): Promise<InventoryActionState> => {
  const { supabase } = await requirePermission("inventory.write");
  const file = form.get("file");
  if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".xlsx") || file.size > 2 * 1024 * 1024) {
    return errorState("Choose an Excel workbook (.xlsx) up to 2 MB.");
  }
  const categories = await supabase.from("inventory_categories").select("id,name");
  if (categories.error) return errorState("Could not load inventory categories.");
  let rows;
  try {
    rows = await parseInventoryWorkbook(await file.arrayBuffer(), categories.data);
  } catch (error) {
    return errorState(error instanceof Error ? error.message : "Could not read this workbook.");
  }
  const { data, error } = await supabase.rpc("import_inventory_master", { p_rows: rows });
  if (error) return errorState(error.code === "23505" ? "A code in this import is already used. No items were added." : "The import failed. No items were added.");
  updateInventoryPages();
  return { message: `${data} inventory item${data === 1 ? "" : "s"} imported.` };
};
