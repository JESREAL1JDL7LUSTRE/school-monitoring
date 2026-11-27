import { randomUUID } from "node:crypto";
import ExcelJS from "exceljs";
import { expect, test } from "@playwright/test";
import { databaseAs, loginAs } from "./fixtures";

test("maps custom CSV and Excel headers before importing records", async ({ page }) => {
  const id = "IMPORT-" + randomUUID().slice(0, 8).toUpperCase();
  const admin = await databaseAs("admin");
  await loginAs(page, "admin");
  await page.goto("/employees");
  await page.getByRole("link", { name: "Import spreadsheet" }).click();
  const file = page.getByLabel("CSV or Excel file");
  const read = page.getByRole("button", { name: "Read spreadsheet" });
  const csv = (contents: string) => ({ name: "employees.csv", mimeType: "text/csv", buffer: Buffer.from(contents) });
  await file.setInputFiles(csv(`Staff code,Person,Job\n${id},"Teacher, Sample",Teacher I\nBAD,Missing position,\n`));
  await read.click();
  await page.getByLabel("Employee ID").selectOption("0");
  await page.getByLabel("Full name").selectOption("1");
  await page.getByLabel("Position").selectOption("2");
  await expect(page.getByText("2. Teacher, Sample")).toBeVisible();
  await page.getByRole("button", { name: "Import 2 records" }).click();
  await expect(page.getByText(/Row 3.*Position/)).toBeVisible();
  const absent = await admin.from("employees").select("id").eq("employee_no", id).maybeSingle();
  expect(absent.error).toBeNull();
  expect(absent.data).toBeNull();

  await file.setInputFiles(csv(`Staff code,Name,Position\n${id},"Teacher, Sample",Teacher I\n`));
  await read.click();
  await page.getByLabel("Employee ID").selectOption("0");
  await page.getByRole("button", { name: "Import 1 record" }).click();
  await expect(page.getByText("1 employee record imported.")).toBeVisible();
  const employee = await admin.from("employees").select("full_name,entered_by_email").eq("employee_no", id).single();
  expect(employee.data).toEqual({ full_name: "Teacher, Sample", entered_by_email: "admin@school.example" });

  await page.goto("/import/inventory");
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet("Stock").addRows([
    ["SKU", "Name", "Category", "Unit", "Unit cost", "Opening quantity"],
    [id, "Sample stock", "Office Supplies", "pcs", 12, 3],
  ]);
  await file.setInputFiles({
    name: "stock.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
  });
  await read.click();
  await page.getByLabel("Item code").selectOption("0");
  await page.getByRole("button", { name: "Import 1 record" }).click();
  await expect(page.getByText("1 inventory item imported.")).toBeVisible();
  const stock = await admin.from("inventory_item_stock").select("name,balance").eq("item_code", id).single();
  expect(stock.data).toEqual({ name: "Sample stock", balance: 3 });
});
