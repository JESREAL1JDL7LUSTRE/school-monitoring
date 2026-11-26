"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/modules/auth/session";
import { concernCategories, concernPriorities, concernStatuses, nosiStatuses } from "./database";
import { employeeReference } from "./employee-route";
import { validatePhoto } from "./photo-storage";
import { saveEmployeePhoto } from "./photo-actions";
import { getNosiCycle } from "./queries";
import { employeeDateMetrics, manilaDate } from "./rules";
import { grade, money, mutationFailure, optionalDate, personnelFailure, profileSchema, stalePersonnel, step, uuid, version, type PersonnelActionState } from "./validation";

function success(message: string, employeeId?: string): PersonnelActionState {
  if (employeeId) revalidatePath("/employees/[id]", "page");
  for (const path of ["/", "/employees", "/nosi", "/logs", "/reports", "/forms", "/inventory"]) revalidatePath(path);
  revalidatePath("/inventory/transactions/[kind]", "page");
  return { ok: true, message };
}

export async function saveEmployee(_: PersonnelActionState, form: FormData) {
  const { supabase } = await requirePermission("personnel.write");
  const profile = profileSchema.safeParse(Object.fromEntries(form));
  if (!profile.success) return personnelFailure(profile.error.issues[0].message);
  if (profile.data.date_of_birth && profile.data.date_of_birth > manilaDate()) return personnelFailure("Birth date cannot be in the future.");
  const id = form.get("id");
  if (id) {
    if (!uuid.safeParse(id).success || !version.safeParse(form.get("version")).success) return personnelFailure("Invalid employee version.");
    const { error, data } = await supabase.from("employees").update(profile.data).eq("id", String(id))
      .eq("updated_at", String(form.get("version"))).is("archived_at", null).select("id").maybeSingle();
    const failure = mutationFailure(error, "This employee ID is already in use.");
    return failure ?? (data ? success("Employee record saved.", data.id) : personnelFailure(stalePersonnel));
  }
  const expiry = optionalDate.safeParse(form.get("license_expiry") ?? "");
  if (!expiry.success) return personnelFailure("Enter a valid license expiry date.");
  const salaryFields = [form.get("grade"), form.get("step"), form.get("monthly_salary"), form.get("effective_from")];
  const salary = salaryFields.some(Boolean) ? z.object({
    grade, step, monthly_salary: money, effective_from: z.iso.date(),
  }).safeParse(Object.fromEntries(form)) : null;
  if (salary && !salary.success) return personnelFailure("Enter a salary grade (1–33), step (1–8), monthly salary and effective date.");
  const selected = form.get("photo");
  const photo = selected instanceof File && selected.size ? await validatePhoto(selected) : null;
  if (typeof photo === "string") return personnelFailure(photo);
  const { data, error } = await supabase.rpc("create_employee", {
    p_profile: profile.data,
    ...(salary?.success ? { p_salary: salary.data } : {}),
    ...(expiry.data ? { p_license_expiry: expiry.data } : {}),
  });
  const failure = mutationFailure(error, "This employee ID is already in use.");
  if (failure || !data) return failure ?? personnelFailure("The employee could not be created.");
  success("Employee added.", data);
  const { data: employee } = await supabase.from("employees").select("slug,updated_at").eq("id", data).maybeSingle();
  const path = `/employees/${employeeReference({ id: data, employee_no: profile.data.employee_no, slug: employee?.slug })}`;
  if (photo) {
    if (!employee) redirect(path + "?photo=retry");
    const upload = new FormData();
    upload.set("employee_id", data);
    upload.set("version", employee.updated_at);
    upload.set("operation", "upload");
    upload.set("photo", photo);
    const result = await saveEmployeePhoto({ ok: false, message: "" }, upload);
    if (!result.ok) redirect(path + "?photo=retry");
  }
  redirect(path);
}

export async function changeArchive(_: PersonnelActionState, form: FormData) {
  const { supabase } = await requirePermission("personnel.write");
  const input = z.object({ employee_id: uuid, version, operation: z.enum(["archive", "restore"]) }).safeParse(Object.fromEntries(form));
  if (!input.success) return personnelFailure("Invalid employee version.");
  const { employee_id, operation } = input.data;
  const { error, data } = await supabase.from("employees").update({ archived_at: operation === "archive" ? new Date().toISOString() : null })
    .eq("id", employee_id).eq("updated_at", input.data.version).select("id").maybeSingle();
  return mutationFailure(error, stalePersonnel) ?? (data ? success(operation === "archive" ? "Employee archived." : "Employee restored.", employee_id) : personnelFailure(stalePersonnel));
}

export async function saveLicense(_: PersonnelActionState, form: FormData) {
  const { supabase } = await requirePermission("personnel.write");
  const input = z.object({
    employee_id: uuid, expiry_date: z.iso.date(), license_type: z.string().trim().min(1).max(80),
    license_number: z.string().trim().max(100), is_active: z.enum(["true", "false"]).transform((value) => value === "true"),
  }).safeParse(Object.fromEntries(form));
  if (!input.success) return personnelFailure("Enter a license type and valid expiry date.");
  const { employee_id, is_active, ...fields } = input.data;
  const licenseId = form.get("license_id");
  if (!licenseId) {
    const { error } = await supabase.from("employee_licenses").insert({ employee_id, ...fields });
    return mutationFailure(error, "This license already exists.") ?? success("License added.", employee_id);
  }
  if (!uuid.safeParse(licenseId).success || !version.safeParse(form.get("version")).success) return personnelFailure("Invalid license version.");
  const { error, data } = await supabase.from("employee_licenses").update({ ...fields, is_active })
    .eq("employee_id", employee_id).eq("id", String(licenseId)).eq("updated_at", String(form.get("version"))).select("id").maybeSingle();
  return mutationFailure(error, stalePersonnel) ?? (data ? success("License saved.", employee_id) : personnelFailure(stalePersonnel));
}

export async function appendSalary(_: PersonnelActionState, form: FormData) {
  const { supabase } = await requirePermission("personnel.write");
  const input = z.object({
    employee_id: uuid, grade, step, monthly_salary: money, effective_from: z.iso.date(),
    reason: z.string().trim().min(1).max(300), reference_no: z.string().trim().max(100),
    resets_step_date: z.literal("on").optional().transform(Boolean),
  }).safeParse(Object.fromEntries(form));
  if (!input.success) return personnelFailure("Enter the salary grade (1–33), step (1–8), amount, effective date and reason.");
  const { error } = await supabase.from("employee_salary_history").insert(input.data);
  return mutationFailure(error, "A salary record already exists on that effective date.") ?? success("Salary change recorded.", input.data.employee_id);
}

export async function saveNosi(_: PersonnelActionState, form: FormData) {
  const { supabase } = await requirePermission("personnel.write");
  const input = z.object({
    employee_id: uuid, previous_step_date: z.iso.date(), status: z.enum(nosiStatuses),
  }).safeParse(Object.fromEntries(form));
  if (!input.success) return personnelFailure("Choose a valid NOSI status.");
  const cycle = await getNosiCycle(input.data.employee_id, input.data.previous_step_date);
  if (!cycle) return personnelFailure(stalePersonnel);
  const { employee, context, nosi } = cycle;
  const { eligibleOn } = employeeDateMetrics(employee, context);
  if (!eligibleOn || employee.archived_at || employee.step_date !== input.data.previous_step_date) return personnelFailure(stalePersonnel);
  const expected = form.get("version") || null;
  if ((nosi?.updated_at ?? null) !== expected) return personnelFailure(stalePersonnel);
  const { error, data } = nosi
    ? await supabase.from("nosi_records").update({ status: input.data.status, eligibility_date: eligibleOn }).eq("id", nosi.id)
      .eq("updated_at", String(expected)).select("id").maybeSingle()
    : await supabase.from("nosi_records").insert({ ...input.data, eligibility_date: eligibleOn }).select("id").single();
  return mutationFailure(error, stalePersonnel) ?? (data ? success("NOSI status saved.", employee.id) : personnelFailure(stalePersonnel));
}

export async function addConcern(_: PersonnelActionState, form: FormData) {
  const { supabase } = await requirePermission("personnel.write");
  const input = z.object({
    employee_id: uuid, category: z.enum(concernCategories), priority: z.enum(concernPriorities),
    description: z.string().trim().min(1).max(2000), assigned_to: z.string().trim().max(180),
  }).safeParse(Object.fromEntries(form));
  if (!input.success) return personnelFailure("Choose an employee and enter the concern details.");
  const { error } = await supabase.from("concern_logs").insert(input.data);
  return mutationFailure(error, "This concern could not be saved.") ?? success("Concern logged.", input.data.employee_id);
}

export async function updateConcern(_: PersonnelActionState, form: FormData) {
  const { supabase } = await requirePermission("personnel.write");
  const input = z.object({ id: uuid, status: z.enum(concernStatuses), version }).safeParse(Object.fromEntries(form));
  if (!input.success) return personnelFailure("Choose a valid concern status.");
  const resolved = input.data.status === "Resolved" || input.data.status === "Closed";
  const { data: current, error: readError } = await supabase.from("concern_logs").select("resolved_on").eq("id", input.data.id).maybeSingle();
  if (readError || !current) return personnelFailure("The concern could not be loaded.");
  const { error, data } = await supabase.from("concern_logs").update({ status: input.data.status, resolved_on: resolved ? current.resolved_on ?? manilaDate() : null })
    .eq("id", input.data.id).eq("updated_at", input.data.version).select("id,employee_id").maybeSingle();
  return mutationFailure(error, stalePersonnel) ?? (data ? success("Concern status saved.", data.employee_id) : personnelFailure(stalePersonnel));
}
