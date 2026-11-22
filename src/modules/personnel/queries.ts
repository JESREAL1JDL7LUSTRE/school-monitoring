import "server-only";

import { cache } from "react";
import { notFound } from "next/navigation";
import { hasPermission, requirePermission } from "@/modules/auth/session";
import { getSchoolSettings } from "@/modules/settings/queries";
import type { DocumentType, Employee, EmployeeAttachment, EmployeeDocument, EmployeeLicense, NosiRecord, SalaryRecord } from "./database";
import { manilaDate, type PersonnelContext, type PersonnelSummary } from "./rules";

type Rows<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

async function allRows<T>(fetch: (start: number, end: number) => Rows<T>): Promise<T[]> {
  const rows: T[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await fetch(offset, offset + pageSize - 1);
    if (error || !data) throw new Error("Could not load personnel records.");
    rows.push(...data);
    if (data.length < pageSize) return rows;
  }
}

export const getPersonnelContext = cache(async (): Promise<PersonnelContext> => {
  const settings = await getSchoolSettings();
  const asOf = settings.reference_date ?? manilaDate();
  return {
    asOf,
    reportingYear: settings.reporting_year ?? Number(asOf.slice(0, 4)),
    stepIntervalMonths: settings.step_interval_months,
    retirementAge: settings.retirement_age,
    loyaltyFirstYears: settings.loyalty_first_years,
    loyaltyIntervalYears: settings.loyalty_interval_years,
    salaryEstimatePercent: settings.salary_estimate_percent,
  };
});

function groupByEmployee<T extends { employee_id: string }>(rows: T[]) {
  const byEmployee = new Map<string, T[]>();
  for (const row of rows) {
    const existing = byEmployee.get(row.employee_id);
    if (existing) existing.push(row);
    else byEmployee.set(row.employee_id, [row]);
  }
  return byEmployee;
}

function summarize(employee: Employee, context: PersonnelContext, documentTypes: DocumentType[], statuses: EmployeeDocument[], licenses: EmployeeLicense[], salary: SalaryRecord[], nosi: NosiRecord[]): PersonnelSummary {
  const currentSalary = salary.find((entry) => entry.effective_from <= context.asOf) ?? null;
  const lastSalaryStep = salary.find((entry) => entry.resets_step_date && entry.effective_from <= context.asOf)?.effective_from ?? null;
  const stepDate = [employee.initial_step_date, lastSalaryStep]
    .filter((value): value is string => Boolean(value && value <= context.asOf)).sort().at(-1) ?? null;
  const nosiRecord = nosi.find((entry) => entry.previous_step_date === stepDate);
  const activeTypes = new Set(documentTypes.map((item) => item.id));
  return {
    ...employee,
    checklist_done: statuses.filter((record) => record.status !== "Pending" && activeTypes.has(record.document_type_id)).length,
    checklist_total: documentTypes.length,
    license_expiry: licenses.filter((entry) => entry.is_active).map((entry) => entry.expiry_date).sort().at(0) ?? null,
    current_salary: currentSalary,
    step_date: stepDate,
    nosi_status: nosiRecord?.status ?? "Not filed",
    nosi_updated_at: nosiRecord?.updated_at ?? null,
    nosi_id: nosiRecord?.id ?? null,
    custody_quantity: 0,
  };
}

const personnelData = cache(async (employeeId?: string) => {
  const { supabase } = await requirePermission("personnel.read");
  const [context, employees, documentTypes, statuses, licenses, salaryHistory, nosiHistory] = await Promise.all([
    getPersonnelContext(),
    allRows((start, end) => {
      const query = supabase.from("employees").select("*").order("full_name").order("id");
      return (employeeId ? query.eq("id", employeeId) : query).range(start, end);
    }),
    allRows((start, end) => supabase.from("document_types").select("*").eq("active", true).order("sort_order").order("id").range(start, end)),
    allRows((start, end) => {
      const query = supabase.from("employee_documents").select("*").order("id");
      return (employeeId ? query.eq("employee_id", employeeId) : query).range(start, end);
    }),
    allRows((start, end) => {
      const query = supabase.from("employee_licenses").select("*").order("expiry_date").order("id");
      return (employeeId ? query.eq("employee_id", employeeId) : query).range(start, end);
    }),
    allRows((start, end) => {
      const query = supabase.from("employee_salary_history").select("*").order("effective_from", { ascending: false }).order("id");
      return (employeeId ? query.eq("employee_id", employeeId) : query).range(start, end);
    }),
    allRows((start, end) => {
      const query = supabase.from("nosi_records").select("*").order("previous_step_date", { ascending: false }).order("id");
      return (employeeId ? query.eq("employee_id", employeeId) : query).range(start, end);
    }),
  ]);
  return { context, employees, documentTypes, statuses, licenses, salaryHistory, nosiHistory };
});

export const getPersonnelOverview = cache(async () => {
  const { supabase } = await requirePermission("personnel.read");
  const [{ context, employees, documentTypes, statuses, licenses, salaryHistory, nosiHistory }, totals] = await Promise.all([
    personnelData(),
    allRows((start, end) => supabase.rpc("employee_custody_totals").order("employee_id").range(start, end)),
  ]);
  const custody = new Map(totals.map((total) => [total.employee_id, total.outstanding]));
  const checklistByEmployee = groupByEmployee(statuses);
  const licenseByEmployee = groupByEmployee(licenses);
  const salaryByEmployee = groupByEmployee(salaryHistory);
  const nosiByEmployee = groupByEmployee(nosiHistory);
  const staff = employees.map((employee) => ({ ...summarize(employee, context, documentTypes,
    checklistByEmployee.get(employee.id) ?? [],
    licenseByEmployee.get(employee.id) ?? [],
    salaryByEmployee.get(employee.id) ?? [],
    nosiByEmployee.get(employee.id) ?? [],
  ), custody_quantity: custody.get(employee.id) ?? 0 }));
  return { staff, context };
});

export const getEmployeeProfile = cache(async (id: string) => {
  if (!/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(id)) notFound();
  const { context, employees, documentTypes, statuses, licenses, salaryHistory, nosiHistory } = await personnelData(id);
  if (!employees[0]) notFound();
  const employee = summarize(employees[0], context, documentTypes, statuses, licenses, salaryHistory, nosiHistory);
  const session = await requirePermission("personnel.read");
  const [attachments, custody] = await Promise.all([
    hasPermission(session, "files.read")
      ? allRows<EmployeeAttachment>((start, end) => session.supabase.from("employee_attachments").select("*")
        .eq("employee_id", id).order("uploaded_at", { ascending: false }).order("id").range(start, end))
      : [],
    allRows((start, end) => session.supabase.rpc("employee_custody_summary", { p_employee_id: id })
      .order("document_no").order("item_code").range(start, end)),
  ]);
  const checklist = documentTypes.map((document) => ({
    ...document,
    entry: statuses.find((status) => status.document_type_id === document.id) ?? null,
    attachments: attachments.filter((attachment) => attachment.document_type_id === document.id),
  }));
  return { employee: { ...employee, custody_quantity: custody.reduce((sum, item) => sum + item.outstanding, 0) },
    context, checklist, licenses, salaryHistory, nosiHistory, custody };
});

export const getPersonnelLogs = cache(async () => {
  const session = await requirePermission("personnel.read");
  const [{ staff, context }, concerns, salaryHistory, audit] = await Promise.all([
    getPersonnelOverview(),
    allRows((start, end) => session.supabase.from("concern_logs").select("*").order("created_at", { ascending: false }).order("id").range(start, end)),
    allRows((start, end) => session.supabase.from("employee_salary_history").select("*").order("effective_from", { ascending: false }).order("id").range(start, end)),
    hasPermission(session, "audit.read")
      ? allRows((start, end) => session.supabase.from("audit_logs").select("id,user_id,action,entity_type,entity_id,created_at")
        .order("created_at", { ascending: false }).order("id", { ascending: false }).range(start, end))
      : [],
  ]);
  return { staff, context, concerns, salaryHistory, audit };
});
