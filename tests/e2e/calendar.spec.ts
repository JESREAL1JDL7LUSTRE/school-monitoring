import { expect, test } from "@playwright/test";
import { databaseAs, loginAs } from "./fixtures";

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

test("month navigation works by keyboard and stays in the mobile viewport", async ({ page }) => {
  await loginAs(page, "personnel");
  await page.goto("/calendar");
  await expect(page.getByRole("heading", { name: "Calendar", exact: true })).toBeVisible();
  const period = page.locator("#calendar-month");
  const today = await period.innerText();
  const next = page.getByRole("button", { name: "Next month" });
  await next.focus();
  await expect(next).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(period).not.toHaveText(today);
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await expect(period).toHaveText(today);
  await page.getByRole("button", { name: "January", exact: true }).click();
  await expect(page.getByRole("button", { name: "January", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(period).toHaveText(/January/);
  await page.getByRole("button", { name: "Previous month" }).click();
  await expect(period).toHaveText(/December/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("same-month day selection uses browser history without a Calendar request", async ({ page }) => {
  await loginAs(page, "personnel");
  await page.goto("/calendar?month=2041-03&day=2041-03-14");
  const day = (date: number) => page.getByRole("button", { name: new RegExp(`March ${date}, 2041`) });
  await expect(day(14)).toHaveAttribute("aria-pressed", "true");
  const requests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname === "/calendar" && url.searchParams.has("day")) requests.push(request.method());
  });
  await day(15).click();
  await expect(page).toHaveURL(/day=2041-03-15/);
  await expect(day(15)).toHaveAttribute("aria-pressed", "true");
  await page.goBack();
  await expect(day(14)).toHaveAttribute("aria-pressed", "true");
  await page.goForward();
  await expect(day(15)).toHaveAttribute("aria-pressed", "true");
  expect(requests).toHaveLength(0);
});

test("Calendar shows a pending event before confirmation and removes it when the save fails", async ({ page }) => {
  await loginAs(page, "personnel");
  await page.goto("/calendar?month=2041-06&day=2041-06-14");
  const agenda = page.locator("#calendar-events");
  const rejected = `Synthetic pending event ${crypto.randomUUID()}`;
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/calendar?**", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await held;
    return route.abort("failed");
  });
  try {
    await page.getByRole("button", { name: "Add event" }).click();
    await page.getByLabel("Event title").fill(rejected);
    await page.getByRole("button", { name: "Save event" }).click();
    const pending = agenda.getByRole("listitem").filter({ hasText: rejected });
    await expect(pending.getByText("Saving…")).toBeVisible();
  } finally {
    release();
  }
  await expect(page.locator("#calendar-event-form").getByRole("alert")).toContainText("Could not confirm the event.");
  await expect(agenda.getByText(rejected)).toHaveCount(0);
  await expect(page.getByLabel("Event title")).toHaveValue(rejected);
});

test("staff save school calendar events and auditors can read them", async ({ page, browser }) => {
  await loginAs(page, "personnel");
  await page.goto("/calendar?month=2041-03&day=2041-03-14");
  const eventKey = crypto.randomUUID();
  const title = `Synthetic staff meeting ${eventKey}`;
  const notes = `Synthetic calendar test notes ${eventKey}.`;
  await page.getByRole("button", { name: "Add event" }).click();
  await expect(page.getByLabel("Date", { exact: true })).toHaveValue("2041-03-14");
  await page.getByLabel("Event title").fill(title);
  await page.getByLabel("Start time (optional)").fill("09:15");
  await page.getByLabel("Notes (optional)").fill(notes);
  await page.getByRole("button", { name: "Save event" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Event saved." })).toBeVisible();

  const agenda = page.locator("#calendar-events");
  await expect(agenda.getByText(title, { exact: true })).toBeVisible();
  await expect(agenda.getByText(title, { exact: true })).toHaveCount(1);
  await expect(agenda.getByText(notes, { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /March 14, 2041, \d+ events?/ })).toBeVisible();
  await page.reload();
  await expect(agenda.getByText(title, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Next month" }).click();
  await expect(page.locator("#calendar-month")).toHaveText("April 2041");
  await expect(agenda.getByText(title, { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Previous month" }).click();
  await expect(agenda.getByText(title, { exact: true })).toBeVisible();

  const auditContext = await browser.newContext();
  try {
    const auditPage = await auditContext.newPage();
    await loginAs(auditPage, "auditor");
    await auditPage.goto("/calendar?month=2041-03");
    await expect(auditPage.locator("#calendar-events").getByText(title, { exact: true })).toBeVisible();
    await expect(auditPage.getByRole("button", { name: "Add event" })).toHaveCount(0);
    const auditor = await databaseAs("auditor");
    const denied = await auditor.from("calendar_events").insert({
      title: "Synthetic denied event", event_date: "2041-03-14", start_time: null, notes: null,
    });
    expect(denied.error?.code).toBe("42501");
  } finally {
    await auditContext.close();
  }
});
