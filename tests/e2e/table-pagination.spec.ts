import { expect, test } from "@playwright/test";
import { loginAs } from "./fixtures";

test("audit history displays at most 25 records per page", async ({ page }) => {
  await loginAs(page, "admin");
  await page.goto("/logs?view=audit");

  const records = page.getByRole("table").locator("tbody tr");
  const pagination = page.getByRole("navigation", { name: "Table pagination" });
  await expect(records).toHaveCount(25);
  await expect(pagination.getByText("25 audit records")).toBeVisible();
  const firstRecordCells = records.first().getByRole("cell");
  const firstRecord = await firstRecordCells.allTextContents();

  await pagination.getByRole("link", { name: "Next page" }).click();
  await expect(page).toHaveURL(/older=/);
  expect(await records.count()).toBeLessThanOrEqual(25);
  await expect(firstRecordCells).not.toHaveText(firstRecord);

  await pagination.getByRole("link", { name: "Previous page" }).click();
  await expect(page).toHaveURL(/newer=/);
  await expect(records).toHaveCount(25);
  await expect(firstRecordCells).toHaveText(firstRecord);
});

test("employee and inventory pages keep filters and return complete exports", async ({ page }) => {
  await loginAs(page, "admin");
  await page.goto("/employees");
  const employeeLinks = page.locator("#main-content tbody a[href^='/employees/']");
  await expect(employeeLinks).toHaveCount(25);
  const first = await employeeLinks.evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  await page.getByRole("link", { name: "Next page" }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(employeeLinks.first()).toBeVisible();
  const second = await employeeLinks.evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  expect(second.some((link) => first.includes(link))).toBe(false);
  await page.reload();
  await expect(employeeLinks).toHaveCount(second.length);

  await page.goto("/inventory?view=items&active=1");
  const items = page.locator("#main-content tbody a[href^='/inventory/items/']");
  await expect(items).toHaveCount(25);
  await page.getByRole("link", { name: "Next page" }).click();
  await expect(page).toHaveURL(/active=1.*page=2/);
  await expect(items.first()).toBeVisible();
  const response = await page.request.get("/api/inventory/export?format=csv");
  expect(response.ok()).toBe(true);
  expect((await response.text()).trim().split("\r\n").length).toBeGreaterThan(26);
});
