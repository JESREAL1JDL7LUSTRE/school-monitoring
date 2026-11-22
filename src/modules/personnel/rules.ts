import type { Employee, NosiRecord, SalaryRecord } from "./database";

export type PersonnelContext = {
  asOf: string;
  reportingYear: number;
  stepIntervalMonths: number;
  retirementAge: number;
  loyaltyFirstYears: number;
  loyaltyIntervalYears: number;
  salaryEstimatePercent: number;
};
export type PersonnelSummary = Employee & {
  checklist_done: number;
  checklist_total: number;
  license_expiry: string | null;
  current_salary: SalaryRecord | null;
  step_date: string | null;
  nosi_status: NosiRecord["status"];
  nosi_updated_at: string | null;
  nosi_id: string | null;
  custody_quantity: number;
};

export const personnelFilters = {
  all: "All employees", t: "Teaching", tr: "Teaching related", n: "Non-teaching",
  permanent: "Permanent", substitute: "Substitute", "job-order": "Job Order", cos: "COS",
  complete: "Complete 201 file", inc: "Incomplete 201 file",
  over: "Step date overdue", n1: "Step due within 1 month", n2: "Step due within 2 months",
  ny: "Step due within 12 months", upd: "Adjusted in payslip",
  l0: "Loyalty this year", l1: "Loyalty next year",
  r1: "Retiring within 1 year", r2: "Retiring within 2 years", r3: "Retiring within 3 years",
  pr: "Past retirement date", c1: "License due within 1 month", c2: "License due within 2 months",
  exp: "License expired", archived: "Archived employees",
} as const;
export type PersonnelFilter = keyof typeof personnelFilters;

export function readPersonnelFilter(raw?: string): PersonnelFilter {
  return raw && Object.hasOwn(personnelFilters, raw) ? raw as PersonnelFilter : "all";
}

export function personnelFilterLabel(filter: PersonnelFilter, context: PersonnelContext) {
  if (filter === "l0") return `Loyalty ${context.reportingYear}`;
  if (filter === "l1") return `Loyalty ${context.reportingYear + 1}`;
  return personnelFilters[filter];
}

export function manilaDate(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(date);
  return ["year", "month", "day"].map((part) => parts.find((entry) => entry.type === part)!.value).join("-");
}

export function addMonths(iso: string, months: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const result = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result.toISOString().slice(0, 10);
}

function completedYears(start: string | null, asOf: string): number | null {
  if (!start || start > asOf) return null;
  const years = Number(asOf.slice(0, 4)) - Number(start.slice(0, 4));
  return addMonths(start, years * 12) > asOf ? years - 1 : years;
}

function within(date: string | null, asOf: string, months: number) {
  return Boolean(date && date >= asOf && date <= addMonths(asOf, months));
}

export function employeeDateMetrics(
  employee: Pick<Employee, "employment_status" | "date_of_birth" | "date_hired"> & { step_date: string | null },
  context: PersonnelContext,
) {
  return {
    eligibleOn: employee.employment_status === "Permanent" && employee.step_date && employee.step_date <= context.asOf
      ? addMonths(employee.step_date, context.stepIntervalMonths)
      : null,
    retirementDate: employee.date_of_birth ? addMonths(employee.date_of_birth, context.retirementAge * 12) : null,
    age: completedYears(employee.date_of_birth, context.asOf),
    yearsOfService: completedYears(employee.date_hired, context.asOf),
  };
}

export function personnelMetrics(employee: PersonnelSummary, context: PersonnelContext) {
  const { asOf, reportingYear } = context;
  const dates = employeeDateMetrics(employee, context);
  const { eligibleOn, retirementDate } = dates;
  const hiredYear = employee.date_hired ? Number(employee.date_hired.slice(0, 4)) : null;
  const firstYear = hiredYear === null ? null : hiredYear + context.loyaltyFirstYears;
  const loyaltyYear = firstYear === null ? null : firstYear + Math.max(0, Math.ceil((reportingYear - firstYear) / context.loyaltyIntervalYears)) * context.loyaltyIntervalYears;
  const loyaltyDate = loyaltyYear && employee.date_hired && hiredYear !== null
    ? addMonths(employee.date_hired, (loyaltyYear - hiredYear) * 12)
    : null;
  const licenseExpiry = employee.license_expiry;
  const checklistStatus = employee.checklist_done === employee.checklist_total
    ? "Complete" : employee.checklist_done === 0 ? "Not started" : "Incomplete";
  const stepStatus = !eligibleOn ? "Not applicable"
    : employee.nosi_status === "Adjusted in payslip" ? "Updated"
    : eligibleOn < asOf ? "Overdue"
    : within(eligibleOn, asOf, 1) ? "Within 1 month" : "Scheduled";
  const retirementStatus = !retirementDate ? "No birth date"
    : retirementDate < asOf ? "Past retirement date"
    : within(retirementDate, asOf, 12) ? "Within 1 year"
    : within(retirementDate, asOf, 24) ? "Within 2 years"
    : within(retirementDate, asOf, 36) ? "Within 3 years" : "Later";
  const licenseStatus = !licenseExpiry ? "No active license"
    : licenseExpiry < asOf ? "Expired"
    : within(licenseExpiry, asOf, 1) ? "Within 1 month"
    : within(licenseExpiry, asOf, 2) ? "Within 2 months" : "Active";
  return {
    ...dates,
    loyaltyYear,
    loyaltyDate,
    licenseExpiry,
    checklistStatus,
    stepStatus,
    retirementStatus,
    licenseStatus,
    estimatedSalary: employee.current_salary && eligibleOn
      ? Math.round(employee.current_salary.monthly_salary * (100 + context.salaryEstimatePercent)) / 100
      : null,
  };
}

export function matchesPersonnelFilter(employee: PersonnelSummary, filter: PersonnelFilter, context: PersonnelContext): boolean {
  if (filter === "archived") return Boolean(employee.archived_at);
  if (employee.archived_at) return false;

  const m = personnelMetrics(employee, context);
  const stepOpen = employee.nosi_status !== "Adjusted in payslip";
  const { asOf } = context;
  switch (filter) {
    case "all": return true;
    case "t": return employee.classification === "Teaching";
    case "tr": return employee.classification === "Teaching Related";
    case "n": return employee.classification === "NTP";
    case "permanent": return employee.employment_status === "Permanent";
    case "substitute": return employee.employment_status === "Substitute";
    case "job-order": return employee.employment_status === "Job Order";
    case "cos": return employee.employment_status === "COS";
    case "complete": return m.checklistStatus === "Complete";
    case "inc": return m.checklistStatus !== "Complete";
    case "over": return m.stepStatus === "Overdue";
    case "n1": return stepOpen && within(m.eligibleOn, asOf, 1);
    case "n2": return stepOpen && within(m.eligibleOn, asOf, 2);
    case "ny": return stepOpen && within(m.eligibleOn, asOf, 12);
    case "upd": return m.stepStatus === "Updated";
    case "l0": return m.loyaltyYear === context.reportingYear;
    case "l1": return m.loyaltyYear === context.reportingYear + 1;
    case "r1": return within(m.retirementDate, asOf, 12);
    case "r2": return within(m.retirementDate, asOf, 24);
    case "r3": return within(m.retirementDate, asOf, 36);
    case "pr": return m.retirementStatus === "Past retirement date";
    case "c1": return within(m.licenseExpiry, asOf, 1);
    case "c2": return within(m.licenseExpiry, asOf, 2);
    case "exp": return m.licenseStatus === "Expired";
  }
}

export function filterPersonnel(staff: PersonnelSummary[], filter: PersonnelFilter, context: PersonnelContext) {
  return staff.filter((employee) => matchesPersonnelFilter(employee, filter, context));
}

export function formatPersonnelDate(date: string | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(date));
}

export function formatSalary(amount: number | null) {
  return amount === null ? "—" : new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(amount);
}
