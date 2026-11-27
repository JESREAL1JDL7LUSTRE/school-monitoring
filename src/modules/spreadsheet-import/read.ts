import { Readable } from "node:stream";
import ExcelJS from "exceljs";

const cellText = (cell: ExcelJS.Cell) => {
  if (cell.value instanceof Date) return cell.value.toISOString().slice(0, 10);
  const value = cell.result ?? cell.value;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number" && /^0+$/.test(cell.numFmt ?? "")) {
    return String(value).padStart(cell.numFmt.length, "0");
  }
  return cell.text.trim();
};

export async function readSpreadsheet(file: FormDataEntryValue | null) {
  if (!(file instanceof File) || !file.size || file.size > 2 * 1024 * 1024 || !/\.(csv|xlsx)$/i.test(file.name)) {
    throw new Error("Choose a CSV or Excel (.xlsx) file up to 2 MB.");
  }
  const workbook = new ExcelJS.Workbook();
  try {
    if (/\.csv$/i.test(file.name)) {
      const csv = (await file.text()).replace(/^\uFEFF/, "");
      await workbook.csv.read(Readable.from([csv]), { map: (value) => value });
    } else {
      await workbook.xlsx.load(await file.arrayBuffer());
    }
  } catch {
    throw new Error("The file could not be read. Check that it is a valid CSV or Excel workbook.");
  }
  const sheet = workbook.worksheets[0];
  if (!sheet || sheet.columnCount < 1 || sheet.columnCount > 100 || sheet.actualRowCount > 201) {
    throw new Error("Use up to 100 columns and 200 data rows, with headers in the first row.");
  }
  const cells = (row: ExcelJS.Row) => Array.from({ length: sheet.columnCount }, (_, index) => cellText(row.getCell(index + 1)));
  const headers = cells(sheet.getRow(1));
  const rows: { number: number; values: string[] }[] = [];
  sheet.eachRow((row, number) => {
    if (number === 1) return;
    const values = cells(row);
    if (values.some(Boolean)) rows.push({ number, values });
  });
  if (!headers.some(Boolean) || !rows.length) throw new Error("Put the column headers in row 1, followed by at least one data row.");
  return { headers, rows };
}
