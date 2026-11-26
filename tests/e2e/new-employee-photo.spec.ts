import { expect, test } from "@playwright/test";
import { databaseAs, loginAs } from "./fixtures";

test("a photo chosen during employee creation appears on the profile", async ({ page }) => {
  const number = `PIC-${crypto.randomUUID().slice(0, 8)}`;
  const database = await databaseAs("personnel");
  await loginAs(page, "personnel");
  await page.goto("/employees/new");
  try {
    await page.getByLabel("Employee ID").fill(number);
    await page.getByLabel("Full name").fill("Photo Creation Fixture");
    await page.getByLabel("Position").fill("Teacher");
    await page.getByLabel("Employee photo (optional)").setInputFiles({
      name: "portrait.png", mimeType: "image/png",
      buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aKTEAAAAASUVORK5CYII=", "base64"),
    });
    await expect(page.getByAltText("Selected employee photo")).toBeVisible();
    await page.getByRole("button", { name: "Add employee", exact: true }).click();
    await expect(page.getByRole("button", { name: "Replace photo" })).toBeVisible();
    await expect.poll(() => page.locator('img[src^="/api/employee-photos/"]').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1);
  } finally {
    const { data } = await database.from("employees").select("id,photo_id").eq("employee_no", number).maybeSingle();
    if (data) {
      await database.from("employees").update({ photo_id: null }).eq("id", data.id);
      if (data.photo_id) await database.storage.from("employee-photos").remove([`${data.id}/${data.photo_id}`]);
      await database.from("employees").update({ archived_at: new Date().toISOString() }).eq("id", data.id);
    }
  }
});
