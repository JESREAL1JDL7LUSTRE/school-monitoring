import { expect, test } from "@playwright/test";
import { recordId, recordSlug } from "../../src/lib/record-slug";
import { databaseAs, employeeId, loginAs } from "./fixtures";

test("profile edits require confirmation and old employee URLs open the same record", async ({ page }) => {
  const database = await databaseAs("personnel");
  const { data: employee, error } = await database.from("employees").select("employee_no,position").eq("id", employeeId).single();
  if (error || !employee) throw new Error("The synthetic employee is missing.");
  const path = `/employees/${recordSlug(employee.employee_no, employeeId)}`;
  const editedPosition = `${employee.position.slice(0, 128)} (dialog test)`;
  await loginAs(page, "personnel");
  await page.goto(`/employees/${employeeId}?source=bookmark`);
  await expect(page).toHaveURL((url) => url.pathname === path && url.searchParams.get("source") === "bookmark");

  const open = page.getByRole("button", { name: "Edit profile" });
  const editor = page.getByRole("dialog", { name: "Edit profile" });
  const confirmation = page.getByRole("alertdialog", { name: "Save employee changes?" });
  const position = editor.getByLabel("Position");
  const save = editor.getByRole("button", { name: "Save employee" });
  const confirm = confirmation.getByRole("button", { name: "Confirm save" });
  const goBack = confirmation.getByRole("button", { name: "Go back" });
  const currentPosition = async () => {
    const { data } = await database.from("employees").select("position").eq("id", employeeId).single();
    return data?.position;
  };

  try {
    await open.focus();
    await page.keyboard.press("Enter");
    await expect(editor).toBeVisible();
    await position.fill(editedPosition);
    await save.click();
    await expect(confirmation).toBeVisible();
    await expect(goBack).toBeFocused();
    expect(await currentPosition()).toBe(employee.position);
    await goBack.click();
    await expect(confirmation).toBeHidden();
    await expect(position).toHaveValue(editedPosition);
    await expect(save).toBeFocused();
    await save.click();
    await confirm.click();
    await expect(editor).toBeHidden();
    await expect(page.getByText("Employee record saved.")).toBeVisible();
    await expect(open).toBeFocused();
    expect(await currentPosition()).toBe(editedPosition);
  } finally {
    if (await currentPosition() === editedPosition) {
      await page.goto(path);
      await open.click();
      await position.fill(employee.position);
      await save.click();
      await confirm.click();
      await expect(editor).toBeHidden();
    }
  }
});

test("personnel follows a dashboard filter, updates a checklist and downloads a private attachment", async ({ page, request, browser }) => {
  await loginAs(page, "personnel");
  await page.getByRole("link", { name: /Overdue step increments Review eligibility/ }).click();
  await expect(page).toHaveURL(/employees\?filter=over/);
  await page.getByRole("link", { name: "Maya H. Rivera" }).click();
  const row = page.getByRole("listitem", { name: "Appointment Papers (CSC Form 33)" });
  const status = row.getByRole("combobox");
  const initialStatus = await status.inputValue();
  const newStatus = initialStatus === "Complete" ? "N/A" : "Complete";
  const staleTab = await page.context().newPage();
  try {
    await staleTab.goto("/employees/" + employeeId);
    const staleRow = staleTab.getByRole("listitem", { name: "Appointment Papers (CSC Form 33)" });
    await expect(staleRow.getByRole("combobox")).toHaveValue(initialStatus);

    await status.selectOption(newStatus);
    await row.getByRole("button", { name: "Save status" }).click();
    await expect(row.getByText("Checklist status saved.")).toBeVisible();
    await staleRow.getByRole("combobox").selectOption("Pending");
    await staleRow.getByRole("button", { name: "Save status" }).click();
    await expect(staleRow.getByRole("alert")).toContainText("This record changed");
  } finally {
    await staleTab.close();
  }

  await page.reload();
  await expect(status).toHaveValue(newStatus);
  await row.getByRole("button", { name: "Attach file" }).click();
  const upload = page.getByRole("dialog", { name: "Attach file" });
  const fileName = "synthetic-201-" + Date.now() + ".pdf";
  await upload.getByLabel("Appointment Papers (CSC Form 33) attachment").setInputFiles({
    name: fileName,
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n% Synthetic attachment test\n%%EOF\n", "ascii"),
  });
  await upload.getByRole("button", { name: "Upload attachment" }).click();
  await page.getByRole("alertdialog", { name: "Upload this attachment?" }).getByRole("button", { name: "Confirm upload" }).click();
  await expect(row.getByText("Attachment uploaded.")).toBeVisible();
  const attachment = row.getByRole("link", { name: fileName });
  await expect(attachment).toBeVisible();
  const url = await attachment.getAttribute("href");
  expect(url).toBeTruthy();
  const redirect = await page.request.get(url!, { maxRedirects: 0 });
  expect(redirect.status()).toBe(303);
  expect(redirect.headers()["cache-control"]).toContain("no-store");
  const downloaded = await page.request.get(redirect.headers().location);
  expect(downloaded.ok()).toBe(true);
  expect(await downloaded.text()).toContain("Synthetic attachment test");
  const metadata = await (await databaseAs("personnel")).from("employee_attachments")
    .select("storage_path").eq("id", recordId(url!.split("/").at(-1)) ?? "").single();
  expect(metadata.error).toBeNull();
  if (!metadata.data) throw new Error("The uploaded attachment has no metadata.");
  const auditorDatabase = await databaseAs("auditor");
  const deniedObject = await auditorDatabase.storage.from("employee-documents").createSignedUrl(metadata.data.storage_path, 60);
  expect(deniedObject.error).toBeTruthy();

  const anonymous = await request.get(url!, { maxRedirects: 0 });
  expect(anonymous.status()).toBe(401);
  const auditor = await browser.newContext();
  try {
    const auditorPage = await auditor.newPage();
    await loginAs(auditorPage, "auditor");
    expect((await auditorPage.request.get(url!)).status()).toBe(403);
    await auditorPage.goto("/employees/" + employeeId);
    await expect(auditorPage.getByRole("heading", { name: "Maya H. Rivera" })).toBeVisible();
    await expect(auditorPage.getByRole("button", { name: "Save status" })).toHaveCount(0);
    await expect(auditorPage.getByRole("link", { name: fileName })).toHaveCount(0);
  } finally {
    await auditor.close();
  }

  await status.selectOption(initialStatus);
  await row.getByRole("button", { name: "Save status" }).click();
  await expect(row.getByText("Checklist status saved.")).toBeVisible();
});

test("property account cannot read employee records or write checklist rows", async ({ page }) => {
  await loginAs(page, "property");
  await page.goto("/employees/" + employeeId);
  await expect(page.getByRole("heading", { name: "Maya H. Rivera" })).toHaveCount(0);
  await expect(page.getByText("This page could not be found.")).toBeVisible();

  const property = await databaseAs("property");
  const [personnel, objects, writes, directory] = await Promise.all([
    property.from("employees").select("id").eq("id", employeeId),
    property.from("employee_attachments").select("storage_path"),
    property.from("employee_documents").insert({ employee_id: employeeId, document_type_id: 21, status: "Complete" }),
    property.rpc("inventory_employee_directory"),
  ]);
  expect(personnel.data).toEqual([]);
  expect(objects.data).toEqual([]);
  expect(writes.error?.code).toBe("42501");
  expect(directory.data).toContainEqual({ id: employeeId, employee_no: "EMP-001", full_name: "Maya H. Rivera" });
});

test("signed-in school head can review a profile with no employee edit controls", async ({ page }) => {
  await loginAs(page, "head");
  await page.goto("/employees/" + employeeId);
  await expect(page.getByRole("heading", { name: "Maya H. Rivera" })).toBeVisible();
  await expect(page.getByText("Edit profile", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Print this 201" })).toBeVisible();
});
