import { expect, test } from "@playwright/test";
import ExcelJS from "exceljs";
import { manilaDate, matchesPersonnelFilter, personnelFilters, type PersonnelContext, type PersonnelFilter } from "../../src/modules/personnel/rules";
import { databaseAs, loginAs } from "./fixtures";

test("employee filter membership and totals agree with the existing personnel rules", async () => {
  const admin = await databaseAs("admin");
  const { data: settings, error } = await admin.from("school_settings").select("*").single();
  expect(error).toBeNull();
  if (!settings) throw new Error("The school settings seed is missing.");
  const asOf = settings.reference_date ?? manilaDate();
  const context: PersonnelContext = {
    asOf, reportingYear: settings.reporting_year ?? Number(asOf.slice(0, 4)),
    stepIntervalMonths: settings.step_interval_months, retirementAge: settings.retirement_age,
    loyaltyFirstYears: settings.loyalty_first_years, loyaltyIntervalYears: settings.loyalty_interval_years,
    salaryEstimatePercent: settings.salary_estimate_percent,
  };
  const args = {
    p_as_of: asOf, p_reporting_year: context.reportingYear, p_step_months: context.stepIntervalMonths,
    p_retirement_age: context.retirementAge, p_loyalty_first: context.loyaltyFirstYears, p_loyalty_interval: context.loyaltyIntervalYears,
  };
  const { data: rows, error: rowsError } = await admin.rpc("personnel_list_rows", args).order("full_name").order("id");
  expect(rowsError).toBeNull();
  expect(rows?.length).toBeGreaterThan(25);
  const keys = Object.keys(personnelFilters) as PersonnelFilter[];
  const expectedCounts = Object.fromEntries(keys.map((key) => [key, 0]));
  for (const { employee, filter_keys, ...summary } of rows ?? []) {
    const expected = keys.filter((key) => matchesPersonnelFilter({ ...employee, ...summary }, key, context));
    expect([...filter_keys].sort()).toEqual(expected.sort());
    for (const key of expected) expectedCounts[key]++;
  }
  const { data: page, error: pageError } = await admin.rpc("personnel_list_page", {
    ...args, p_filter: "all", p_q: "", p_offset: 0, p_limit: 25,
  });
  expect(pageError).toBeNull();
  expect(page?.rows).toHaveLength(25);
  expect(page?.total).toBe(expectedCounts.all);
  for (const key of keys) expect(page?.facets[key] ?? 0).toBe(expectedCounts[key]);

  const home = await admin.rpc("personnel_home_counts").single();
  expect(home.error).toBeNull();
  expect(home.data?.as_of).toBe(context.asOf);
  expect(home.data?.reporting_year).toBe(context.reportingYear);
  expect(home.data?.facets).toEqual(page?.facets);
  const workspace = await admin.rpc("personnel_workspace_page", {
    p_filter: "all", p_q: "", p_offset: 0, p_limit: 25,
  }).single();
  expect(workspace.error).toBeNull();
  expect(workspace.data?.context).toEqual(context);
  expect(workspace.data?.result).toEqual(page);

  const property = await databaseAs("property");
  const restricted = await property.rpc("personnel_list_page", {
    ...args, p_filter: "all", p_q: "", p_offset: 0, p_limit: 25,
  });
  expect(restricted.data?.total).toBe(0);
  const audit = await property.rpc("audit_log_page", {});
  expect(audit.data).toEqual([]);
  const propertyHome = await property.rpc("personnel_home_counts");
  expect(propertyHome.data).toEqual([]);
  const propertyPage = await property.rpc("personnel_workspace_page", {
    p_filter: "all", p_q: "", p_offset: 0, p_limit: 25,
  });
  expect(propertyPage.data).toEqual([]);
  const propertyIdentity = await property.from("school_identity").select("*").single();
  expect(propertyIdentity.error).toBeNull();
  expect(Object.keys(propertyIdentity.data ?? {}).sort()).toEqual(["division", "region", "school_name"]);
});

test("export authenticates first and returns a header-only template", async ({ page, request }) => {
  expect((await request.get("/api/inventory/export?format=invalid")).status()).toBe(401);
  await loginAs(page, "property");
  expect((await page.request.get("/api/inventory/export?format=invalid")).status()).toBe(400);
  const response = await page.request.get("/api/inventory/export?format=template");
  expect(response.status()).toBe(200);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await response.body());
  expect(workbook.worksheets[0].actualRowCount).toBe(1);
  expect(workbook.worksheets[0].getCell("A1").text).toBe("Item code");
});
