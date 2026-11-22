import { chromium } from "@playwright/test";
import nextEnv from "@next/env";

const loopback = new Set(["127.0.0.1", "localhost", "[::1]"]);
const origin = new URL(process.argv[2] ?? "http://127.0.0.1:3000");
const passes = Number(process.argv[3] ?? 10);
const mode = process.argv[4] ?? "all";
nextEnv.loadEnvConfig(process.cwd());
const supabase = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "about:blank");
if (!loopback.has(origin.hostname) || !loopback.has(supabase.hostname) || !Number.isSafeInteger(passes) || passes < 1) {
  throw new Error("Provide a loopback app URL, a seeded local Supabase configuration and a positive pass count.");
}

const routes = [
  ["Home", "/", "#main-content h2"],
  ["Employees", "/employees", "#main-content tbody a[href^='/employees/']"],
  ["Inventory overview", "/inventory", "#main-content h2"],
  ["Inventory items", "/inventory?view=items", "#main-content tbody a[href^='/inventory/items/']"],
  ["NOSI", "/nosi", "#main-content tbody tr"],
  ["201 report", "/reports?report=201", "#main-content tbody tr"],
  ["Audit logs", "/logs?view=audit", "[aria-label='Audit history'] tbody tr"],
  ["Calendar", "/calendar?month=2026-11", "#calendar-month"],
  ["Forms", "/forms", "#main-content a[href*='template=']"],
  ["Settings", "/settings", "#main-content input:not([type=hidden])"],
];

async function login(page) {
  await page.goto(new URL("/login", origin).href);
  await page.getByLabel("Email address").fill("admin@school.example");
  await page.getByLabel("Password", { exact: true }).fill("LocalSchoolDesk!2026");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByRole("heading", { name: "Home", exact: true }).waitFor();
}

async function documentSample(page, [name, path, ready]) {
  const response = await page.goto(new URL(path, origin).href, { waitUntil: "commit" });
  if (!response?.ok()) throw new Error(`${name} returned HTTP ${response?.status()}`);
  await page.locator("#main-content h1").first().waitFor();
  const heading = await page.evaluate(() => performance.now());
  await page.locator(ready).first().waitFor();
  const timing = await page.evaluate(() => ({
    ready: performance.now(),
    finalHeaders: performance.getEntriesByType("navigation")[0].finalResponseHeadersStart,
    interimHeaders: performance.getEntriesByType("navigation")[0].firstInterimResponseStart,
  }));
  await page.waitForLoadState("load");
  const bytes = await page.evaluate(() => performance.getEntriesByType("navigation")[0].encodedBodySize);
  return { name, heading, ...timing, bytes };
}

async function employeeNavigation(page) {
  await page.goto(new URL("/", origin).href);
  const navigation = page.getByRole("link", { name: "Employees", exact: true }).filter({ visible: true }).first();
  const employees = page.locator(routes[1][2]);
  const warmStart = performance.now();
  await navigation.click();
  await employees.first().waitFor();
  const warmMs = performance.now() - warmStart;
  await page.getByRole("searchbox").fill("Teacher");
  const filterStart = performance.now();
  await page.getByRole("button", { name: "Apply filters" }).click();
  await page.waitForURL((url) => url.searchParams.get("q") === "Teacher");
  await employees.first().waitFor();
  return { warmMs, filterMs: performance.now() - filterStart };
}

async function calendarNavigation(page) {
  await page.goto(new URL("/calendar?month=2026-11", origin).href);
  let dayRequests = 0;
  let monthRequests = 0;
  const count = (request) => {
    const url = new URL(request.url());
    if (url.pathname !== "/calendar") return;
    if (url.searchParams.get("day") === "2026-11-15") dayRequests++;
    if (url.searchParams.get("month") === "2026-12") monthRequests++;
  };
  page.on("request", count);
  try {
    const day = page.getByRole("button", { name: /November 15, 2026/ });
    const sameStart = performance.now();
    await day.click();
    await page.waitForURL((url) => url.searchParams.get("day") === "2026-11-15");
    await page.locator('button[aria-pressed=true] time[datetime="2026-11-15"]').waitFor();
    const sameMs = performance.now() - sameStart;
    const crossStart = performance.now();
    await page.getByRole("button", { name: "Next month" }).click();
    await page.locator("#calendar-month").getByText("December 2026").waitFor();
    return { sameMs, dayRequests, crossMs: performance.now() - crossStart, monthRequests };
  } finally {
    page.off("request", count);
  }
}

const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || "chrome" });
try {
  const page = await browser.newPage();
  await login(page);
  const direct = [];
  const navigation = [];
  const calendar = [];
  for (let pass = -1; pass < passes; pass++) {
    if (mode !== "interactions") {
      for (const route of routes) {
        const result = await documentSample(page, route);
        if (pass >= 0) direct.push(result);
      }
    }
    const employee = await employeeNavigation(page);
    const days = await calendarNavigation(page);
    if (pass >= 0) {
      navigation.push(employee);
      calendar.push(days);
    }
  }
  console.log(JSON.stringify({ passes, direct, navigation, calendar }, null, 2));
} finally {
  await browser.close();
}
