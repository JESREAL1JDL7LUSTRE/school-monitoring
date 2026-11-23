import { expect, test } from "@playwright/test";
import { recordId } from "../../src/lib/record-slug";
import { manilaDate } from "../../src/modules/personnel/rules";
import { databaseAs, employeeId, laptopId, loginAs } from "./fixtures";

test("category shortcuts preserve the selected inventory view and report scope", async ({ page }) => {
  await loginAs(page, "head");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/inventory?view=items&q=DEMO");

  const categories = page.getByRole("navigation", { name: "Inventory categories" });
  await categories.getByRole("link", { name: "Office Supplies", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Office Supplies", exact: true })).toBeVisible();
  await expect(categories.getByRole("link", { name: "Office Supplies", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("navigation", { name: "Inventory views" }).getByRole("link", { name: "Item masterlist" })).toHaveAttribute("aria-current", "page");
  expect(new URL(page.url()).searchParams.get("q")).toBe("DEMO");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

  const tools = page.getByRole("navigation", { name: "Inventory tools" });
  await expect(tools.getByRole("link", { name: "New RIS" })).toHaveCount(0);
  const activeCategory = new URL(page.url()).searchParams.get("category");
  await tools.getByRole("link", { name: "Stock card", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Stock Card", exact: true })).toBeVisible();
  expect(new URL(page.url()).searchParams.get("category")).toBe(activeCategory);
  await page.getByRole("link", { name: "Back to inventory" }).click();
  await expect(categories.getByRole("link", { name: "Office Supplies", exact: true })).toHaveAttribute("aria-current", "page");
  expect(new URL(page.url()).searchParams.get("view")).toBe("items");
});

test("inventory back button restores the issue view and filters after reload", async ({ page }) => {
  await loginAs(page, "property");
  await page.goto("/inventory?view=issued&q=DEMO&scope=all");
  await page.getByRole("navigation", { name: "Inventory categories" })
    .getByRole("link", { name: "Office Supplies", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Office Supplies", exact: true })).toBeVisible();
  const activeCategory = new URL(page.url()).searchParams.get("category");
  expect(activeCategory).toBeTruthy();

  const returnLinks = [
    page.getByRole("navigation", { name: "Inventory tools" }).getByRole("link", { name: "Return stock" }),
    page.locator('[data-slot="card-header"]').filter({ has: page.getByRole("heading", { name: "Issued items and custody" }) })
      .getByRole("link", { name: "Return stock" }),
  ];
  for (const link of returnLinks) {
    await link.click();
    await expect(page.getByRole("heading", { name: "Return stock", exact: true })).toBeVisible();
    await page.reload();
    const back = page.getByRole("link", { name: "Back to inventory" });
    await expect(back).toBeVisible();
    await back.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Office Supplies", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Issued items", exact: true })).toHaveAttribute("aria-current", "page");
    const params = new URL(page.url()).searchParams;
    expect(params.get("category")).toBe(activeCategory);
    expect(params.get("q")).toBe("DEMO");
    expect(params.get("scope")).toBe("all");
  }
});

test("inventory issues and returns stock with a ledger and employee custody", async ({ page }) => {
  await loginAs(page, "property");
  const db = await databaseAs("property");
  const lookupBalance = async () => {
    const { data, error } = await db.from("inventory_balances").select("balance").eq("item_id", laptopId).single();
    expect(error).toBeNull();
    return Number(data?.balance);
  };
  const startingBalance = await lookupBalance();
  expect(startingBalance).toBeGreaterThanOrEqual(2);

  const reference = "Synthetic issue " + crypto.randomUUID();
  await page.goto("/inventory/transactions/issue");
  await page.getByLabel("Employee", { exact: true }).selectOption(employeeId);
  await page.getByLabel("Item 1", { exact: true }).selectOption(laptopId);
  await page.getByLabel("Quantity 1").fill("2");
  await page.getByLabel("Reference or notes").fill(reference);
  await page.getByRole("button", { name: "Post issue" }).click();
  await expect(page).toHaveURL(/inventory\/documents\/[\w-]+--[\w-]{22}(?:\?|$)/);
  const issueDocumentId = recordId(new URL(page.url()).pathname.split("/").at(-1)) ?? "";
  const { data: issue, error: issueError } = await db.from("inventory_issued_lines").select("*").eq("document_id", issueDocumentId).single();
  expect(issueError).toBeNull();
  expect(issue).toMatchObject({ employee_id: employeeId, item_id: laptopId, form_type: "ICS", issued_quantity: 2, outstanding: 2 });
  if (!issue) throw new Error("The issue has no persisted ledger line.");
  expect(await lookupBalance()).toBe(startingBalance - 2);

  const custody = await db.rpc("employee_custody_summary", { p_employee_id: employeeId });
  expect(custody.data).toContainEqual(expect.objectContaining({ document_no: issue.document_no, item_code: "DEMO-LAPTOP", outstanding: 2 }));

  const insufficient = await db.rpc("post_inventory_document", {
    p_kind: "issue", p_date: manilaDate(), p_employee_id: employeeId, p_request_id: crypto.randomUUID(),
    p_lines: [{ item_id: laptopId, quantity: startingBalance + 1 }],
  });
  expect(insufficient.error?.message).toMatch(/insufficient stock/i);
  expect(await lookupBalance()).toBe(startingBalance - 2);

  await page.goto("/inventory/transactions/return");
  await page.getByLabel("Issued line 1").selectOption(issue.issue_line_id + ":" + laptopId);
  await page.getByLabel("Quantity 1").fill("1");
  await page.getByRole("button", { name: "Post return" }).click();
  await expect(page).toHaveURL(/inventory\/documents\/[\w-]+--[\w-]{22}(?:\?|$)/);
  const returns = await db.from("inventory_issued_lines").select("returned_quantity,outstanding").eq("issue_line_id", issue.issue_line_id).single();
  expect(returns.data).toMatchObject({ returned_quantity: 1, outstanding: 1 });
  expect(await lookupBalance()).toBe(startingBalance - 1);

  const excess = await db.rpc("post_inventory_document", {
    p_kind: "return", p_date: manilaDate(), p_request_id: crypto.randomUUID(),
    p_lines: [{ item_id: laptopId, issue_line_id: issue.issue_line_id, quantity: 2 }],
  });
  expect(excess.error).toBeTruthy();
  expect(await lookupBalance()).toBe(startingBalance - 1);

  await page.goto("/inventory/transactions/return");
  await page.getByLabel("Issued line 1").selectOption(issue.issue_line_id + ":" + laptopId);
  await page.getByLabel("Quantity 1").fill("1");
  await page.getByRole("button", { name: "Post return" }).click();
  await expect(page).toHaveURL(/inventory\/documents\/[\w-]+--[\w-]{22}(?:\?|$)/);
  expect(await lookupBalance()).toBe(startingBalance);

  const closed = await db.from("inventory_issued_lines").select("returned_quantity,outstanding").eq("issue_line_id", issue.issue_line_id).single();
  expect(closed.data).toMatchObject({ returned_quantity: 2, outstanding: 0 });
  const ledger = await db.from("inventory_transactions").select("quantity_delta").eq("issue_line_id", issue.issue_line_id);
  expect(ledger.data).toEqual([{ quantity_delta: 1 }, { quantity_delta: 1 }]);
  await page.goto("/inventory/items/" + laptopId);
  await expect(page.getByText("DEMO-LAPTOP", { exact: false }).first()).toBeVisible();
});
