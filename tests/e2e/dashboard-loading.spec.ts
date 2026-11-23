import { expect, test } from "@playwright/test";
import { databaseAs, loginAs } from "./fixtures";

test("Employees streams a skeleton before the server-rendered results", async ({ page }) => {
  await loginAs(page, "admin");
  const response = await page.goto("/employees");
  expect(response?.status()).toBe(200);
  if (!response) throw new Error("The Employees page returned no document.");
  const html = await response.text();
  const skeleton = html.indexOf('data-dashboard-loading="table"');
  const firstTable = html.indexOf('data-slot="table"');
  expect(skeleton >= 0 && firstTable > skeleton).toBe(true);
  await expect(page.locator("#main-content tbody a[href^='/employees/']").first()).toBeVisible();
  await expect(page.locator("[data-dashboard-loading]")).toHaveCount(0);
});

test("school identity is refreshed after a save and is shared across authorized staff", async ({ page, browser }) => {
  const database = await databaseAs("admin");
  const { data: original, error } = await database.from("school_settings").select("school_name").single();
  if (error || !original) throw new Error("The local school settings are missing.");
  const updated = `Synthetic school ${crypto.randomUUID().slice(0, 8)}`;
  const identity = "header[aria-label='School identity']";
  const reader = await browser.newPage();
  await loginAs(page, "admin");
  await loginAs(reader, "property");
  await expect(reader.locator(identity)).toContainText(original.school_name);

  const saveName = async (name: string) => {
    await page.goto("/settings?section=identity");
    await page.getByRole("button", { name: "Edit settings" }).click();
    const dialog = page.getByRole("dialog", { name: "Edit school identity" });
    await dialog.getByLabel("School name", { exact: true }).fill(name);
    await dialog.getByRole("button", { name: "Save settings" }).click();
    await page.getByRole("alertdialog", { name: "Save school settings?" }).getByRole("button", { name: "Confirm save" }).click();
    await expect(page.getByText("School settings saved.")).toBeVisible();
    await expect(dialog).toBeHidden();
  };

  try {
    await saveName(updated);
    await expect(page.locator(identity)).toContainText(updated);
    await reader.reload();
    await expect(reader.locator(identity)).toContainText(updated);
    await reader.goto("/settings");
    await expect(reader.locator("[data-settings-values]")).toContainText(updated);
    await expect(reader.getByRole("button", { name: "Edit settings" })).toHaveCount(0);
  } finally {
    await saveName(original.school_name);
    await reader.close();
  }
});
