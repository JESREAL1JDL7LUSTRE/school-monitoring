import "server-only";

import ExcelJS from "exceljs";
import type { InventoryCategory } from "./database";
import type { StockItem } from "./queries";
import { inventoryItemInput } from "./validation";
import { inventoryDetail, inventoryDetailFields } from "./rules";

const baseHeaders = [
  "Item code", "Name", "Category", "Unit", "Unit cost", "Reorder point", "Condition", "Description", "Opening quantity",
];
const workbookHeaders = [...baseHeaders, ...inventoryDetailFields.map(([, label]) => label)];

const workbookRows = (items: readonly StockItem[]) => items.map((item) => [
  item.item_code, item.name, item.category.name, item.unit, item.unit_cost, item.reorder_point,
  item.condition, item.description, item.balance, ...inventoryDetailFields.map(([key]) => inventoryDetail(item, key)),
]);

export const spreadsheetInventory = async (items: readonly StockItem[]) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Inventory");
  sheet.addRow(workbookHeaders).font = { bold: true };
  sheet.addRows(workbookRows(items));
  sheet.columns.forEach((column) => { column.width = 22; });
  return workbook.xlsx.writeBuffer();
};

const csvCell = (value: string | number) => {
  const text = String(value);
  const safe = typeof value === "string" && /^[\s\uFEFF]*[=+@-]/.test(text) ? "'" + text : text;
  return '"' + safe.replaceAll('"', '""') + '"';
};

export const csvInventory = (items: readonly StockItem[]) =>
  [workbookHeaders, ...workbookRows(items)].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";

export const parseInventoryWorkbook = async (
  bytes: ArrayBuffer, categories: Pick<InventoryCategory, "id" | "name">[],
) => {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(bytes);
  } catch {
    throw new Error("Could not read this Excel workbook.");
  }
  const sheet = workbook.worksheets[0];
  if (!sheet || sheet.actualRowCount < 2 || sheet.actualRowCount > 201 ||
    baseHeaders.some((header, index) => sheet.getRow(1).getCell(index + 1).text.trim() !== header)) {
    throw new Error("Use the inventory workbook template and include 1 to 200 item rows.");
  }
  const categoryMap = new Map(categories.map((category) => [category.name.toLowerCase(), category.id]));
  const rows: ReturnType<typeof inventoryItemInput.parse>[] = [];
  sheet.eachRow((row, number) => {
    if (number === 1) return;
    const fields = baseHeaders.map((_, index) => row.getCell(index + 1).value);
    if (fields.every((value) => value === null || value === "")) return;
    if (fields.some((value) => value && typeof value === "object")) throw new Error(`Row ${number}: Use plain values instead of formulas or rich text.`);
    const [item_code, name, category, unit, unit_cost, reorder_point, condition, description, opening_quantity] = fields;
    const details = Object.fromEntries(inventoryDetailFields.map(([key, label], index) => {
      const column = baseHeaders.length + index + 1;
      const value = sheet.getRow(1).getCell(column).text.trim() === label ? row.getCell(column).value : null;
      if (value && typeof value === "object") throw new Error(`Row ${number}: Use plain text in ${label}.`);
      return [key, String(value ?? "")];
    }));
    const parsed = inventoryItemInput.safeParse({
      item_code, name, category_id: categoryMap.get(String(category).trim().toLowerCase()), unit,
      unit_cost, reorder_point: reorder_point ?? 5, condition: condition || "Serviceable", description: description ?? "",
      opening_quantity: opening_quantity ?? 0, details,
    });
    if (!parsed.success) throw new Error(`Row ${number}: Check the required cells and use an existing category name.`);
    rows.push(parsed.data);
  });
  if (!rows.length) throw new Error("The workbook contains no items.");
  return rows;
};
