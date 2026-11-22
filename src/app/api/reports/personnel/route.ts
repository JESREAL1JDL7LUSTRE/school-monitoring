import ExcelJS from "exceljs";
import { getSession, hasPermission } from "@/modules/auth/session";
import { getPersonnelReport, readReportKey } from "@/modules/reports/personnel";

const spreadsheetCell = (value: string) => /^[\s\uFEFF]*[=+@\-]/u.test(value) ? `'${value}` : value;
const csvCell = (value: string) => `"${spreadsheetCell(value).replaceAll('"', '""')}"`;

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return new Response("Sign in to export reports.", { status: 401 });
  if (!hasPermission(session, "personnel.read")) return new Response("Report access denied.", { status: 403 });
  const params = new URL(request.url).searchParams;
  const key = readReportKey(params.get("report"));
  const format = params.get("format");
  if (!key || !format || !["csv", "xlsx"].includes(format)) return new Response("Choose a report and export format.", { status: 400 });

  const { definition, settings, context, header, rows, attentionCount } = await getPersonnelReport(key, params.get("show") === "all");
  const data: string[][] = [
    [settings.school_name], [settings.division], [definition.title],
    ["As of", context.asOf, "Reporting year", String(context.reportingYear)],
    ["Prepared by", settings.prepared_by, "Employees requiring attention", String(attentionCount)],
    [], header, ...rows.map((row) => row.values),
  ];
  const headers = new Headers({ "Cache-Control": "private, no-store", "Content-Disposition": `attachment; filename="school-desk-${key}.${format}"` });

  if (format === "csv") {
    headers.set("Content-Type", "text/csv; charset=utf-8");
    return new Response(`\uFEFF${data.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`, { headers });
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Personnel report");
  sheet.addRows(data);
  sheet.getRow(7).font = { bold: true };
  sheet.columns.forEach((column, index) => { column.width = index === 2 ? 30 : 22; });
  const bytes = new Uint8Array(await workbook.xlsx.writeBuffer());
  headers.set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  return new Response(bytes, { headers });
}
