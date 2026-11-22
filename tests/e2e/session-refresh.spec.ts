import { expect, test } from "@playwright/test";
import { databaseAs, employeeId, loginAs } from "./fixtures";

test("proxy refreshes an expiring session and protects a signed-out browser", async ({ page }) => {
  await loginAs(page, "head");
  const context = page.context();
  const cookies = (await context.cookies()).filter((cookie) => /-auth-token(?:\.\d+)?$/.test(cookie.name))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  if (!cookies.length) throw new Error("The seeded local session has no SSR auth cookie.");
  const encoded = cookies.map((cookie) => cookie.value).join("");
  if (!encoded.startsWith("base64-")) throw new Error("Expected a base64 Supabase session cookie.");
  const savedSession = JSON.parse(Buffer.from(encoded.slice(7), "base64url").toString("utf8"));
  const packed = "base64-" + Buffer.from(JSON.stringify({ ...savedSession, expires_at: 1 })).toString("base64url");
  const [cookie] = cookies;
  for (const entry of cookies) await context.clearCookies({ name: entry.name });
  const name = cookie.name.replace(/\.\d+$/, "");
  const chunks = packed.match(/.{1,3180}/g) ?? [];
  await context.addCookies(chunks.map((value, index) => ({ ...cookie, value, name: chunks.length === 1 ? name : `${name}.${index}` })));
  await page.goto("/employees");
  await expect(page.getByRole("heading", { name: "Employees" })).toBeVisible();
  const refreshed = (await context.cookies()).filter((entry) => /-auth-token(?:\.\d+)?$/.test(entry.name))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })).map((entry) => entry.value).join("");
  expect(refreshed.startsWith("base64-") && refreshed !== packed).toBe(true);

  await page.getByRole("button", { name: "Sign out" }).filter({ visible: true }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/employees");
  await expect(page).toHaveURL(/\/login/);
});

test("a live role revocation removes file, list and write access from an existing session", async ({ page }) => {
  await loginAs(page, "personnel");
  const administrator = await databaseAs("admin");
  const personnel = await databaseAs("personnel");
  const { data: attachment, error } = await personnel.from("employee_attachments").select("id").eq("employee_id", employeeId).limit(1).single();
  expect(error).toBeNull();
  if (!attachment) throw new Error("The local demo attachment is missing.");
  const path = `/api/employee-documents/${attachment.id}`;
  expect((await page.request.get(path, { maxRedirects: 0 })).status()).toBe(303);
  const args = { target_email: "personnel@school.example", target_role: "administrative_officer" as const };
  try {
    const revoke = await administrator.rpc("update_staff_role", { ...args, enabled: false });
    expect(revoke.data).toBe("saved");
    const response = await page.request.get(path, { maxRedirects: 0 });
    expect(response.status()).toBe(403);
    const write = await personnel.from("concern_logs").insert({
      employee_id: employeeId, category: "Other", priority: "Low", description: "Synthetic denied write",
    });
    expect(write.error?.code).toBe("42501");
    await page.goto("/employees");
    await expect(page).toHaveURL(/\/login\?access=pending/);
  } finally {
    const restore = await administrator.rpc("update_staff_role", { ...args, enabled: true });
    expect(restore.data).toBe("saved");
  }
});
