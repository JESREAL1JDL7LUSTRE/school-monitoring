import "server-only";

import ExcelJS from "exceljs";
import type { StockItem } from "./queries";
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
