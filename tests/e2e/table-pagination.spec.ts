import { expect, test } from "@playwright/test";
import { loginAs } from "./fixtures";

test("audit history displays at most 25 records per page", async ({ page }) => {
  await loginAs(page, "admin");
  await page.goto("/logs?view=audit");

  const records = page.getByRole("table").locator("tbody tr");
  const pagination = page.getByRole("navigation", { name: "Table pagination" });
  await expect(records).toHaveCount(25);
  await expect(pagination.getByText(/Rows 1–25 of/)).toBeVisible();
  const firstRecordCells = records.first().getByRole("cell");
  const firstRecord = await firstRecordCells.allTextContents();

  await pagination.getByRole("button", { name: "Next page" }).click();
  await expect(pagination.getByText(/Rows 26–\d+ of/)).toBeVisible();
  expect(await records.count()).toBeLessThanOrEqual(25);
  await expect(firstRecordCells).not.toHaveText(firstRecord);

  await pagination.getByRole("button", { name: "Previous page" }).click();
  await expect(pagination.getByText(/Rows 1–25 of/)).toBeVisible();
  await expect(records).toHaveCount(25);
  await expect(firstRecordCells).toHaveText(firstRecord);
});
