import { z } from "zod";
import type { SchoolSettings } from "@/types/database";
import { formatPersonnelDate, formatSalary, personnelFilters, personnelMetrics, filterPersonnel } from "@/modules/personnel/rules";
import type { getEmployeeDraftProfile, getPersonnelOverview } from "@/modules/personnel/queries";
import type { Template } from "./catalog";

const text = z.string();
const sectionSchema = z.object({
  heading: text.optional(),
  paragraphs: z.array(text).optional(),
  fields: z.array(z.tuple([text, text])).optional(),
  table: z.object({ headers: z.array(text), rows: z.array(z.array(text)) }).optional(),
});

export const snapshotSchema = z.object({
  layout: z.literal(1),
  school: z.object({ name: text, division: text, region: text, code: text, logoPath: text.nullable() }),
  issuedOn: z.iso.date(),
  sections: z.array(sectionSchema),
  signatories: z.array(z.tuple([text, text])),
  parameters: z.record(text, text),
});

export type DocumentSnapshot = z.infer<typeof snapshotSchema>;
type Section = z.infer<typeof sectionSchema>;
type Profile = Awaited<ReturnType<typeof getEmployeeDraftProfile>>;
type Overview = Awaited<ReturnType<typeof getPersonnelOverview>>;

export function parseDraftInput(form: FormData, template: Template) {
  const issuedOn = z.iso.date().safeParse(form.get("issuedOn"));
  if (!issuedOn.success) throw new Error("Enter a valid issue date.");
  const employeeId = template.employee ? z.uuid().safeParse(form.get("employee")) : null;
  if (employeeId && !employeeId.success) throw new Error("Choose an employee.");

  const parameters: Record<string, string> = {};
  for (const field of template.fields) {
    const input = form.get(field.name);
    const value = typeof input === "string" ? input.trim() : "";
    if (!value && field.optional) continue;
    if (!value || value.length > 2000) throw new Error(`Enter ${field.label.toLowerCase()} (up to 2,000 characters).`);
    if (field.type === "date" && !z.iso.date().safeParse(value).success) throw new Error(`Enter a valid ${field.label.toLowerCase()}.`);
    if (field.type === "number" && (!/^\d+(\.\d{1,2})?$/.test(value) || Number(value) > 9999999999)) throw new Error(`Enter a valid ${field.label.toLowerCase()}.`);
    parameters[field.name] = value;
  }
  if (parameters.from && parameters.through < parameters.from) throw new Error("The end date must follow the start date.");
  return { issuedOn: issuedOn.data, employeeId: employeeId?.data ?? null, parameters };
}

function employeeFields(profile: Profile): [string, string][] {
  const { employee } = profile;
  return [
    ["Employee", employee.full_name], ["Employee no.", employee.employee_no],
    ["Position", employee.position], ["Employment status", employee.employment_status],
  ];
}

function personnelSection(template: Template, profile: Profile, settings: SchoolSettings, issuedOn: string, fields: Record<string, string>): Section[] {
  const { employee, context, checklist, salaryHistory } = profile;
  const metrics = personnelMetrics(employee, context);

  switch (template.slug) {
    case "certificate-of-employment":
      if (!employee.date_hired) throw new Error("Add the employee’s hire date before preparing a certificate.");
      return [{ paragraphs: [
        "To whom it may concern:",
        `This draft records that ${employee.full_name} is employed at ${settings.school_name} as ${employee.position} under ${employee.employment_status} status, with employment starting ${formatPersonnelDate(employee.date_hired)}.`,
        metrics.yearsOfService === null ? `Service length could not be determined as of ${formatPersonnelDate(context.asOf)}.` : `Completed years of service as of ${formatPersonnelDate(context.asOf)}: ${metrics.yearsOfService}.`,
        employee.current_salary ? `The recorded monthly basic salary as of ${formatPersonnelDate(context.asOf)} is ${formatSalary(employee.current_salary.monthly_salary)}.` : "No current monthly salary is on file.",
        `Prepared for ${fields.purpose} on ${formatPersonnelDate(issuedOn)}.`,
      ] }];
    case "service-record":
      return [{ fields: [...employeeFields(profile), ["Date hired", formatPersonnelDate(employee.date_hired)], ["Completed years of service", String(metrics.yearsOfService ?? "—")]] },
        { heading: "Salary and step history", table: { headers: ["Effective date", "Grade / step", "Monthly salary", "Reference", "Reason"], rows: salaryHistory.map((row) => [formatPersonnelDate(row.effective_from), `${row.grade} / ${row.step}`, formatSalary(row.monthly_salary), row.reference_no, row.reason]) } }];
    case "employee-201":
      return [{ fields: [...employeeFields(profile), ["Last reviewed", formatPersonnelDate(employee.checklist_review_date)], ["Completion", `${employee.checklist_done} of ${employee.checklist_total}`], ["Remarks", employee.checklist_remarks]] },
        { heading: "201 documents", table: { headers: ["Document type", "Status"], rows: checklist.map((entry) => [entry.name, entry.entry?.status ?? "Pending"]) } }];
    case "nosi":
      return [{ fields: [
        ...employeeFields(profile),
        ["Current grade / step", employee.current_salary ? `${employee.current_salary.grade} / ${employee.current_salary.step}` : "—"],
        ["Last step date", formatPersonnelDate(employee.step_date)], ["Calculated eligibility", formatPersonnelDate(metrics.eligibleOn)],
        ["Current monthly salary", formatSalary(employee.current_salary?.monthly_salary ?? null)],
        ["Estimated monthly salary (draft)", formatSalary(metrics.estimatedSalary)], ["NOSI status", employee.nosi_status],
      ] }];
    default:
      return [{ fields: employeeFields(profile) }];
  }
}

function totalsSection({ staff, context }: Overview): Section {
  const filters = ["all", "permanent", "substitute", "job-order", "cos", "t", "tr", "n"] as const;
  return { heading: "Staff summary", table: { headers: ["Group", "Headcount"], rows: filters.map((filter) => [personnelFilters[filter], String(filterPersonnel(staff, filter, context).length)]) } };
}

export function buildSnapshot(template: Template, settings: SchoolSettings, input: ReturnType<typeof parseDraftInput>, profile?: Profile, overview?: Overview): DocumentSnapshot {
  const fields: [string, string][] = template.fields
    .filter((field) => field.name in input.parameters)
    .map((field) => [field.label, field.type === "date" ? formatPersonnelDate(input.parameters[field.name]) : input.parameters[field.name]]);
  const sections = profile ? personnelSection(template, profile, settings, input.issuedOn, input.parameters) : [];
  if (overview) sections.push(totalsSection(overview));
  if (fields.length && template.slug !== "certificate-of-employment") sections.push({ heading: "Details", fields });

  return snapshotSchema.parse({
    layout: 1,
    school: { name: settings.school_name, division: settings.division, region: settings.region, code: settings.school_code, logoPath: settings.logo_path },
    issuedOn: input.issuedOn,
    sections,
    signatories: (template.group === "Financial" ? [["Disbursing Officer", settings.disbursing_officer], ["School Head", settings.school_head]]
      : [["Prepared by", settings.prepared_by], ["School Head", settings.school_head]]).filter(([, name]) => name),
    parameters: input.parameters,
  });
}
