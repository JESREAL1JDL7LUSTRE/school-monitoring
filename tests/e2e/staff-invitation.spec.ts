import { expect, test } from "@playwright/test";
import { databaseAs, loginAs } from "./fixtures";

test("an administrator can copy and dismiss a manual staff invitation", async ({ page, context }) => {
  await loginAs(page, "admin");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/settings/access");
  const email = `manual-${crypto.randomUUID()}@school.example`;
  await page.getByRole("button", { name: "Invite staff" }).click();
  await page.getByLabel("Staff email").fill(email);
  await page.getByLabel("Role", { exact: true }).selectOption("auditor");
  await page.getByRole("button", { name: "Review invitation" }).click();
  await page.getByRole("button", { name: "Create account" }).click();
  const message = await page.getByLabel("Invitation message").inputValue();
  expect(message).toContain(email);
  await page.getByRole("button", { name: "Copy invitation" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Invitation copied." })).toBeVisible();
  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard.replaceAll("\r\n", "\n")).toBe(message);
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("button", { name: "Invite staff" }).click();
  await expect(page.getByLabel("Staff email")).toBeEmpty();
  const admin = await databaseAs("admin");
  await admin.rpc("update_staff_role", { target_email: email, target_role: "auditor", enabled: false });
});
