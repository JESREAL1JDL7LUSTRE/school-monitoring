import { z } from "zod";
import { classifications, employmentStatuses } from "./database";

export const uuid = z.uuid();
export const version = z.iso.datetime({ offset: true });
export const optionalDate = z.union([z.literal(""), z.iso.date()]).transform((value) => value || null);
export const grade = z.coerce.number().int().min(1).max(33);
export const step = z.coerce.number().int().min(1).max(8);
export const money = z.string().trim().regex(/^\d{1,12}(?:\.\d{1,2})?$/, "Enter an amount with up to two decimal places.").transform(Number);

export const profileSchema = z.object({
  employee_no: z.string().trim().min(1, "Enter the employee ID.").max(40).transform((value) => value.toUpperCase()),
  full_name: z.string().trim().min(1, "Enter the employee’s full name.").max(180),
  position: z.string().trim().min(1, "Enter the employee’s position.").max(150),
  employment_status: z.enum(employmentStatuses),
  classification: z.enum(classifications),
  date_of_birth: optionalDate,
  date_hired: optionalDate,
  initial_step_date: optionalDate,
}).refine(({ date_of_birth, date_hired }) => !date_of_birth || !date_hired || date_of_birth <= date_hired, {
  message: "The hire date must be on or after the birth date.",
}).refine(({ date_hired, initial_step_date }) => !date_hired || !initial_step_date || date_hired <= initial_step_date, {
  message: "The last step date must be on or after the hire date.",
});

export type PersonnelActionState = { ok: boolean; message: string };
export type PersonnelAction = (state: PersonnelActionState, formData: FormData) => Promise<PersonnelActionState>;
export const personnelFormInitial: PersonnelActionState = { ok: false, message: "" };

export function personnelFailure(message: string): PersonnelActionState {
  return { ok: false, message };
}

export function mutationFailure(error: { code?: string } | null, duplicateMessage: string) {
  if (!error) return null;
  if (error.code === "23505") return personnelFailure(duplicateMessage);
  if (error.code === "42501") return personnelFailure("You do not have permission to save this record.");
  if (error.code === "23503") return personnelFailure("A referenced record is missing. Refresh the page and try again.");
  return personnelFailure("The record could not be saved. Check the values and try again.");
}

export const stalePersonnel = "This record changed after you opened the page. Reload it and review the latest values before saving again.";
