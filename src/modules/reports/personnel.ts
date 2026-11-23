import "server-only";

import { getPersonnelOverview } from "@/modules/personnel/queries";
import { filterPersonnel, formatPersonnelDate, matchesPersonnelFilter, personnelMetrics, type PersonnelFilter } from "@/modules/personnel/rules";
import { getSchoolSettings } from "@/modules/settings/queries";

type Metrics = ReturnType<typeof personnelMetrics>;

type Report = {
  title: string; dateHeading: string; statusHeading: string;
  date: (metrics: Metrics) => string | null; status: (metrics: Metrics) => string; filters: PersonnelFilter[];
};

export const personnelReports = {
  "201-completeness": { title: "201 completeness", dateHeading: "201 review date", statusHeading: "201 file status", date: () => null, status: (m) => m.checklistStatus, filters: ["inc"] },
  nosi: { title: "NOSI / step update", dateHeading: "NOSI due date", statusHeading: "NOSI alert", date: (m) => m.eligibleOn, status: (m) => m.stepStatus, filters: ["over", "n1"] },
  loyalty: { title: "Loyalty award", dateHeading: "Eligibility date", statusHeading: "Loyalty year", date: (m) => m.loyaltyDate, status: (m) => String(m.loyaltyYear ?? "—"), filters: ["l0", "l1"] },
  retirement: { title: "Retirement", dateHeading: "Retirement date", statusHeading: "Retirement alert", date: (m) => m.retirementDate, status: (m) => m.retirementStatus, filters: ["pr", "r3"] },
  "license-renewal": { title: "License renewal", dateHeading: "PRC expiry", statusHeading: "PRC monitoring", date: (m) => m.licenseExpiry, status: (m) => m.licenseStatus, filters: ["exp", "c2"] },
} satisfies Record<string, Report>;

export const inventoryReports = {
  rsmi: "Report of Supplies and Materials Issued (RSMI)",
  rpci: "Report on the Physical Count of Inventories (RPCI)",
  rpcppe: "Report on the Physical Count of PPE (RPCPPE)",
  iirup: "Inventory and Inspection Report of Unserviceable Property (IIRUP)",
  waste: "Waste Materials Report",
  "annex-a": "Inventory Count Form (Annex A)",
  "annex-1": "Science and Mathematics Delivery Certification (Annex 1)",
  nsbi: "School Building Inventory Report (NSBI)",
  issued: "Issued property summary",
  tags: "Property tags",
};

export type PersonnelReportKey = keyof typeof personnelReports;

export function readReportKey(key?: string | null): PersonnelReportKey | null {
  return key && Object.hasOwn(personnelReports, key) ? key as PersonnelReportKey : null;
}

export async function getPersonnelReport(key: PersonnelReportKey, showAll: boolean) {
  const [{ staff, context }, settings] = await Promise.all([getPersonnelOverview(), getSchoolSettings()]);
  const definition = personnelReports[key];
  const header = ["Attention", "Employee ID", "Name", "Status", "Classification", definition.dateHeading, definition.statusHeading,
    "201 file", "Salary grade / step", "Remarks", "Outstanding custody"];
  const rows = filterPersonnel(staff, "all", context).map((employee) => {
    const metrics = personnelMetrics(employee, context);
    const attention = definition.filters.some((filter) => matchesPersonnelFilter(employee, filter, context));
    const date = key === "201-completeness" ? employee.checklist_review_date : definition.date(metrics);
    const salary = employee.current_salary;
    const values = [attention ? "YES" : "", employee.employee_no, employee.full_name, employee.employment_status, employee.classification,
      formatPersonnelDate(date), definition.status(metrics), `${employee.checklist_done}/${employee.checklist_total}`,
      salary ? `${salary.grade} / ${salary.step}` : "—", employee.checklist_remarks, String(employee.custody_quantity)];
    return { id: employee.id, employeeNo: employee.employee_no, attention, values };
  });

  return {
    definition, settings, context, header,
    attentionCount: rows.filter((row) => row.attention).length,
    rows: showAll ? rows : rows.filter((row) => row.attention),
  };
}
