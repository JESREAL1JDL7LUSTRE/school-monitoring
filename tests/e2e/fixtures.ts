import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { expect, type Page } from "@playwright/test";
import type { Database } from "../../src/types/database";

loadEnvConfig(process.cwd(), true);

export const employeeId = "11111111-1111-4111-8111-111111111111";
export const laptopId = "22222222-2222-4222-8222-222222222223";
const password = "LocalSchoolDesk!2026";
type Account = "admin" | "head" | "personnel" | "property" | "auditor";

export function localSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key || !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname)) {
    throw new Error("Set a seeded local Supabase URL and publishable key in .env.local before running end-to-end tests.");
  }
  return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function loginAs(page: Page, account: Account) {
  localSupabase();
  await page.goto("/login");
  await page.getByLabel("Email address").fill(account + "@school.example");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Home", exact: true })).toBeVisible();
}

export async function databaseAs(account: Account) {
  const database = localSupabase();
  const { error } = await database.auth.signInWithPassword({ email: account + "@school.example", password });
  if (error) throw error;
  return database;
}
