import { expect, test } from "@playwright/test";
import { employeeId, loginAs } from "./fixtures";

test("personnel saves a Certificate of Employment snapshot and prints it without navigation", async ({ page, browser }) => {
  await loginAs(page, "personnel");
  await page.goto("/forms?template=certificate-of-employment&employee=" + employeeId);
  const purpose = "Synthetic appointment verification";
  await page.getByLabel("Purpose", { exact: true }).fill(purpose);
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page).toHaveURL(/forms\/[a-f\d-]+/);
  await expect(page.getByRole("heading", { name: /Certificate of Employment/i })).toBeVisible();
  await expect(page.getByText(/Draft · School verification required/i)).toBeVisible();
  await expect(page.getByText(/Template version 1/i)).toBeVisible();
  await expect(page.getByText(new RegExp(purpose, "i"))).toBeVisible();
  await page.reload();
  await expect(page.getByText(new RegExp(purpose, "i"))).toBeVisible();

  const summary = "/api/reports/personnel?report=201-completeness&show=all&format=";
  const csv = await page.request.get(summary + "csv");
  expect(csv.ok()).toBe(true);
  expect(await csv.text()).toContain("Maya H. Rivera");
  const excel = await page.request.get(summary + "xlsx");
  expect(excel.ok()).toBe(true);
  expect((await excel.body()).subarray(0, 2).toString()).toBe("PK");

  const documentUrl = new URL(page.url()).pathname;
  const property = await browser.newContext();
  try {
    const propertyPage = await property.newPage();
    await loginAs(propertyPage, "property");
    await propertyPage.goto(documentUrl);
    await expect(propertyPage.getByText(new RegExp(purpose, "i"))).toHaveCount(0);
    await expect(propertyPage.getByText("This page could not be found.")).toBeVisible();
  } finally {
    await property.close();
  }

  const print = page.getByRole("button", { name: "Print document" });
  await expect(print).toBeVisible();
  await page.emulateMedia({ media: "print" });
  await expect(print).toBeHidden();
  await expect(page.getByRole("link", { name: "Home", exact: true })).toBeHidden();
  await expect(page.getByText(new RegExp(purpose, "i"))).toBeVisible();
  const pdf = await page.pdf({ printBackground: true, preferCSSPageSize: true });
  expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  expect(pdf.length).toBeGreaterThan(1000);
});
