import "server-only";

import { cache } from "react";
import { notFound } from "next/navigation";
import { hasPermission, requirePermission } from "@/modules/auth/session";
import { getSchoolSettings } from "@/modules/settings/queries";
import type { DocumentType, Employee, EmployeeAttachment, EmployeeDocument, EmployeeLicense, NosiRecord, PersonnelListRow, SalaryRecord } from "./database";
import { manilaDate, type PersonnelContext, type PersonnelFilter, type PersonnelSummary } from "./rules";

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

const contextArgs = (context: PersonnelContext) => ({
  p_as_of: context.asOf,
  p_reporting_year: context.reportingYear,
  p_step_months: context.stepIntervalMonths,
  p_retirement_age: context.retirementAge,
  p_loyalty_first: context.loyaltyFirstYears,
  p_loyalty_interval: context.loyaltyIntervalYears,
});

const toPersonnelSummary = ({ employee, ...record }: PersonnelListRow): PersonnelSummary =>
  ({ ...employee, ...record });

export async function getPersonnelPage(filter: PersonnelFilter, query: string, page: number, pageSize: number) {
  const [{ supabase }, context] = await Promise.all([requirePermission("personnel.read"), getPersonnelContext()]);
  const { data, error } = await supabase.rpc("personnel_list_page", {
    ...contextArgs(context), p_q: query, p_filter: filter, p_offset: (page - 1) * pageSize, p_limit: pageSize,
  });
  if (error || !data) throw new Error("Could not load the employee masterlist.");
  return { context, employees: data.rows.map(toPersonnelSummary), total: data.total, facets: data.facets };
}

export const getPersonnelDirectory = cache(async (activeOnly = true) => {
  const { supabase } = await requirePermission("personnel.read");
  return allRows((start, end) => {
    const query = supabase.from("employees").select("id,full_name,employee_no,archived_at").order("full_name").order("id");
    return (activeOnly ? query.is("archived_at", null) : query).range(start, end);
  });
});

const effectiveStepDate = (initial: string | null, reset: string | null, asOf: string) =>
  [initial, reset].filter((value): value is string => Boolean(value && value <= asOf)).sort().at(-1) ?? null;

function summarize(employee: Employee, context: PersonnelContext, documentTypes: DocumentType[], statuses: EmployeeDocument[], licenses: EmployeeLicense[], salary: SalaryRecord[], nosi: NosiRecord[]): PersonnelSummary {
  const currentSalary = salary.find((entry) => entry.effective_from <= context.asOf) ?? null;
  const lastSalaryStep = salary.find((entry) => entry.resets_step_date && entry.effective_from <= context.asOf)?.effective_from ?? null;
  const stepDate = effectiveStepDate(employee.initial_step_date, lastSalaryStep, context.asOf);
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

type PersonnelRead = "profile" | "checklist" | "salary" | "nosi" | "employee";

const personnelData = cache(async (employeeId: string, mode: PersonnelRead = "profile") => {
  const { supabase } = await requirePermission("personnel.read");
  const checklist = mode === "profile" || mode === "checklist";
  const salary = mode === "profile" || mode === "salary" || mode === "nosi";
  const [context, employees, documentTypes, statuses, licenses, salaryHistory, nosiHistory] = await Promise.all([
    getPersonnelContext(),
    allRows((start, end) => supabase.from("employees").select("*").eq("id", employeeId).range(start, end)),
    checklist ? allRows((start, end) => supabase.from("document_types").select("*").eq("active", true).order("sort_order").order("id").range(start, end)) : [],
    checklist ? allRows((start, end) => {
      const query = supabase.from("employee_documents").select("*").order("id");
      return query.eq("employee_id", employeeId).range(start, end);
    }) : [],
    mode === "profile" ? allRows((start, end) => {
      const query = supabase.from("employee_licenses").select("*").order("expiry_date").order("id");
      return query.eq("employee_id", employeeId).range(start, end);
    }) : [],
    salary ? allRows((start, end) => {
      const query = supabase.from("employee_salary_history").select("*").order("effective_from", { ascending: false }).order("id");
      return query.eq("employee_id", employeeId).range(start, end);
    }) : [],
    mode === "profile" || mode === "nosi" ? allRows((start, end) => {
      const query = supabase.from("nosi_records").select("*").order("previous_step_date", { ascending: false }).order("id");
      return query.eq("employee_id", employeeId).range(start, end);
    }) : [],
  ]);
  return { context, employees, documentTypes, statuses, licenses, salaryHistory, nosiHistory };
});

export async function getEmployeeDraftProfile(id: string, template: string) {
  const mode: PersonnelRead = template === "employee-201" ? "checklist"
    : template === "nosi" ? "nosi"
    : template === "certificate-of-employment" || template === "service-record" ? "salary"
    : "employee";
  const { context, employees, documentTypes, statuses, licenses, salaryHistory, nosiHistory } = await personnelData(id, mode);
  if (!employees[0]) notFound();
  const employee = summarize(employees[0], context, documentTypes, statuses, licenses, salaryHistory, nosiHistory);
  const checklist = documentTypes.map((document) => ({
    name: document.name,
    entry: statuses.find((status) => status.document_type_id === document.id) ?? null,
  }));
  return { employee, context, checklist, salaryHistory };
}

export const getPersonnelOverview = cache(async () => {
  const [{ supabase }, context] = await Promise.all([requirePermission("personnel.read"), getPersonnelContext()]);
  const rows = await allRows((start, end) => supabase.rpc("personnel_list_rows", contextArgs(context))
    .order("full_name").order("id").range(start, end));
  const staff = rows.map(toPersonnelSummary);
  return { staff, context };
});

export async function getNosiCycle(id: string, expectedStep: string) {
  const [{ supabase }, context] = await Promise.all([requirePermission("personnel.write"), getPersonnelContext()]);
  const [employee, reset, nosi] = await Promise.all([
    supabase.from("employees").select("id,archived_at,employment_status,initial_step_date,date_of_birth,date_hired").eq("id", id).maybeSingle(),
    supabase.from("employee_salary_history").select("effective_from").eq("employee_id", id).eq("resets_step_date", true)
      .lte("effective_from", context.asOf).order("effective_from", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("nosi_records").select("id,updated_at").eq("employee_id", id).eq("previous_step_date", expectedStep).maybeSingle(),
  ]);
  if (employee.error || reset.error || nosi.error) throw new Error("Could not load the current step cycle.");
  if (!employee.data) return null;
  const step_date = effectiveStepDate(employee.data.initial_step_date, reset.data?.effective_from ?? null, context.asOf);
  return { employee: { ...employee.data, step_date }, context, nosi: nosi.data };
}

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

export async function getConcerns() {
  const { supabase } = await requirePermission("personnel.read");
  return allRows((start, end) => supabase.from("concern_logs").select("*")
    .order("created_at", { ascending: false }).order("id").range(start, end));
}

export async function getSalaryHistory() {
  const { supabase } = await requirePermission("personnel.read");
  return allRows((start, end) => supabase.from("employee_salary_history").select("*")
    .order("effective_from", { ascending: false }).order("id").range(start, end));
}
