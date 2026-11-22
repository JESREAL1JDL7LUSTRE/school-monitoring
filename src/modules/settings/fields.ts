import { z } from "zod";

export const settingsSections = {
  identity: "School identity",
  signatories: "Signatories",
  rules: "Reporting and calculation rules",
} as const;

export type SettingsSection = keyof typeof settingsSections;

export function readSettingsSection(value: unknown): SettingsSection {
  return typeof value === "string" && Object.hasOwn(settingsSections, value) ? value as SettingsSection : "identity";
}

export const textFields = [
  ["school_name", "School name"],
  ["school_code", "School ID"],
  ["division", "Schools Division Office"],
  ["region", "Region"],
] as const;

export const signatoryFields = [
  ["school_head", "School head"],
  ["administrative_officer", "Administrative officer"],
  ["disbursing_officer", "Disbursing officer"],
  ["inventory_chair", "Inventory committee chair"],
  ["superintendent", "Schools Division Superintendent"],
  ["coa_auditor", "COA auditor"],
  ["prepared_by", "Prepared by"],
] as const;

export const numberFields = [
  ["reporting_year", "Reporting year", 1900, 2199, 1],
  ["step_interval_months", "Months between step increments", 1, 240, 1],
  ["retirement_age", "Retirement age", 18, 120, 1],
  ["loyalty_first_years", "Years until first loyalty award", 1, 60, 1],
  ["loyalty_interval_years", "Years between loyalty awards", 1, 60, 1],
  ["ppe_threshold", "PPE threshold (₱)", 0, 999999999999.99, 0.01],
  ["semi_expendable_threshold", "High-value semi-expendable threshold (₱)", 0, 999999999999.99, 0.01],
  ["salary_estimate_percent", "Estimated salary increase (%)", 0, 100, 0.01],
] as const;

const text = z.string().trim().max(180);
const number = (minimum: number, maximum: number) =>
  z.preprocess((value) => typeof value === "string" && value.trim() ? Number(value) : value,
    z.number().min(minimum).max(maximum));

export const settingsSchemas = {
  identity: z.object({ school_name: text.min(1), school_code: text, region: text, division: text }),
  signatories: z.object({
    school_head: text,
    administrative_officer: text,
    disbursing_officer: text,
    inventory_chair: text,
    superintendent: text,
    coa_auditor: text,
    prepared_by: text,
  }),
  rules: z.object({
    reference_date: z.preprocess((value) => value === "" ? null : value, z.iso.date().nullable()),
    reporting_year: z.preprocess((value) => value === "" ? null : value, number(1900, 2199).pipe(z.int()).nullable()),
    step_interval_months: number(1, 240).pipe(z.int()),
    retirement_age: number(18, 120).pipe(z.int()),
    loyalty_first_years: number(1, 60).pipe(z.int()),
    loyalty_interval_years: number(1, 60).pipe(z.int()),
    ppe_threshold: number(0, 999999999999.99),
    semi_expendable_threshold: number(0, 999999999999.99),
    salary_estimate_percent: number(0, 100),
  }).refine((settings) => settings.semi_expendable_threshold <= settings.ppe_threshold, {
    path: ["semi_expendable_threshold"],
    message: "The semi-expendable threshold must be at or below the PPE threshold.",
  }),
};
