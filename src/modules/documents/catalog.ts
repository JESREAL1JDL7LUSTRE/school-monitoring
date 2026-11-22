import type { Permission } from "@/modules/auth/permissions";

export type Field = { name: string; label: string; type?: "date" | "textarea" | "number"; optional?: boolean };
export type FormScope = "personnel" | "private-personnel" | "inventory";
export type Template = { slug: string; title: string; group: string; scope: FormScope; employee: boolean; fields: Field[]; version: number; href?: string };

const field = (name: string, label: string, type?: Field["type"], optional = false): Field => ({ name, label, type, optional });
const details = (label: string) => field("details", label, "textarea");
const reference = (label = "Reference number") => field("reference", label);
const purpose = field("purpose", "Purpose");
const startEnd = [field("from", "Start date", "date"), field("through", "End date", "date")];
const group = "Personnel requests";
const maternity = "Maternity leave";
const finance = "Financial";
const division = "Division reports";
const retirement = "Retirement";

function template(slug: string, title: string, section: string, fields: Field[], options: Partial<Pick<Template, "employee" | "scope" | "href">> = {}): Template {
  return { slug, title, group: section, fields, employee: true, scope: "personnel", version: 1, ...options };
}

export const templates = [
  template("service-record", "Service Record", group, []),
  template("leave-form", "Leave Form (CSC Form 6)", group, [field("leave_type", "Type of leave"), ...startEnd, field("work_days", "Working days requested", "number"), field("details", "Leave details", "textarea", true)]),
  template("authority-to-travel", "Authority to Travel", group, [field("destination", "Destination"), purpose, ...startEnd, field("funding", "Funding source")]),
  template("certificate-of-employment", "Certificate of Employment", group, [purpose]),
  template("locator-slip", "Locator Slip", group, [field("destination", "Destination"), purpose, field("depart", "Departure time"), field("return_time", "Expected return time")]),
  template("service-credit", "Request for Service Credit / COC", group, [field("credit_type", "Credit requested"), details("Service performed"), ...startEnd, field("hours", "Hours claimed", "number")]),
  template("certificate-of-appearance", "Certificate of Appearance", group, [field("host", "Office visited"), field("appearance_date", "Appearance date", "date"), purpose]),
  template("4ps-certification", "4Ps Certification", group, [field("beneficiary", "Learner or beneficiary name"), field("school_year", "School year"), details("Enrollment or attendance details")], { employee: false }),
  template("medical-certificate", "CSC Medical Certificate", maternity, [field("physician", "Examining physician"), field("exam_date", "Examination date", "date"), details("Physician’s findings")], { scope: "private-personnel" }),
  template("school-level-clearance", "School Level Clearance", maternity, [purpose, details("School clearance findings")]),
  template("modification-advice", "Modification Advice", finance, [reference(), field("fund", "Fund / account"), field("amount", "Amount (PHP)", "number"), details("Requested modification")], { employee: false }),
  template("waiver-of-responsibility", "Waiver of Responsibility", finance, [purpose, details("Scope of waiver")]),
  template("advice-of-checks-issued", "Advice of Checks Issued", finance, [reference("Check number"), field("payee", "Payee"), field("bank", "Bank / account reference"), field("amount", "Check amount (PHP)", "number")], { employee: false }),
  template("schedule-of-funds", "Schedule of Funds", finance, [field("fund", "Fund source"), ...startEnd, field("amount", "Amount (PHP)", "number"), details("Allocations")], { employee: false }),
  template("transmittal", "Transmittal Form", division, [field("recipient", "Receiving office"), reference(), details("Documents transmitted")], { employee: false }),
  template("total-personnel", "Total Personnel Report", division, [], { employee: false }),
  template("physical-count-ppe", "Physical Count of PPE", division, [], { scope: "inventory", employee: false, href: "/inventory/reports/rpcppe" }),
  template("district-level-clearance", "District Level Clearance", retirement, [field("district", "District"), details("Clearance findings")]),
  template("pendency", "Pendency / Non-Pendency", retirement, [field("certifying_office", "Certifying office"), details("Case status and reference, if any")], { scope: "private-personnel" }),
  template("saln", "SALN", retirement, [field("as_of", "Statement as of", "date"), field("assets", "Assets declaration", "textarea"), field("liabilities", "Liabilities declaration", "textarea"), field("interests", "Business interests and financial connections", "textarea")], { scope: "private-personnel" }),
  template("employee-201", "201 File Checklist", "Personnel records", []),
  template("nosi", "Notice of Step Increment", "Personnel records", []),
];

export function getTemplate(slug: string | undefined) {
  return templates.find((entry) => entry.slug === (slug === "checklist-201" ? "employee-201" : slug));
}

export function formPermissions(scope: FormScope, mode: "read" | "write"): Permission[] {
  if (scope === "inventory") return [mode === "read" ? "inventory.read" : "inventory.write"];
  if (scope === "private-personnel") return mode === "read" ? ["personnel.read", "files.read"] : ["personnel.write", "files.write"];
  return [mode === "read" ? "personnel.read" : "personnel.write"];
}
