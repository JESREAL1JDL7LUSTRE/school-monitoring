"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/modules/auth/session";
import { checklistStatuses } from "./database";
import { mutationFailure, optionalDate, personnelFailure, stalePersonnel, uuid, version, type PersonnelActionState } from "./validation";

const documentKey = z.object({ employee_id: uuid, document_type_id: z.coerce.number().int().min(1).max(32767) });
const bucket = "employee-documents";
const signatures = {
  "application/pdf": [0x25, 0x50, 0x44, 0x46, 0x2d],
  "image/png": [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  "image/jpeg": [0xff, 0xd8, 0xff],
};

function saved(employeeId: string, message: string) {
  revalidatePath(`/employees/${employeeId}`);
  revalidatePath("/", "layout");
  return { ok: true, message };
}

export async function saveChecklist(_: PersonnelActionState, form: FormData) {
  const { supabase } = await requirePermission("personnel.write");
  const input = documentKey.extend({ status: z.enum(checklistStatuses) }).safeParse(Object.fromEntries(form));
  if (!input.success) return personnelFailure("Choose a valid checklist status.");
  const { employee_id, document_type_id, status } = input.data;
  const expected = form.get("version");
  if (expected && !version.safeParse(expected).success) return personnelFailure("Invalid checklist version.");
  const { error, data } = expected
    ? await supabase.from("employee_documents").update({ status }).eq("employee_id", employee_id)
      .eq("document_type_id", document_type_id).eq("updated_at", String(expected)).select("id").maybeSingle()
    : await supabase.from("employee_documents").insert(input.data).select("id").single();
  return mutationFailure(error, stalePersonnel) ?? (data ? saved(employee_id, "Checklist status saved.") : personnelFailure(stalePersonnel));
}

export async function saveChecklistReview(_: PersonnelActionState, form: FormData) {
  const { supabase } = await requirePermission("personnel.write");
  const input = z.object({
    employee_id: uuid, version, checklist_review_date: optionalDate,
    checklist_remarks: z.string().trim().max(2000),
  }).safeParse(Object.fromEntries(form));
  if (!input.success) return personnelFailure("Enter a valid review date and remarks of at most 2,000 characters.");
  const { employee_id, version: expected, ...fields } = input.data;
  const { error, data } = await supabase.from("employees").update(fields).eq("id", employee_id)
    .eq("updated_at", expected).is("archived_at", null).select("id").maybeSingle();
  return mutationFailure(error, stalePersonnel) ?? (data ? saved(employee_id, "Checklist review saved.") : personnelFailure(stalePersonnel));
}

export async function uploadEmployeeAttachment(_: PersonnelActionState, form: FormData) {
  const { supabase, user } = await requirePermission("files.write");
  const input = documentKey.safeParse(Object.fromEntries(form));
  const file = form.get("file");
  if (!input.success || !(file instanceof File) || !file.size) return personnelFailure("Choose a document to upload.");
  if (file.size > 10 * 1024 * 1024) return personnelFailure("Choose a file of 10 MB or less.");
  if (!Object.hasOwn(signatures, file.type)) return personnelFailure("Choose a PDF, PNG, or JPEG file.");
  const signature = signatures[file.type as keyof typeof signatures];
  const header = new Uint8Array(await file.slice(0, signature.length).arrayBuffer());
  if (!signature.every((byte, index) => header[index] === byte)) return personnelFailure("The file contents do not match the selected file type.");

  const { employee_id, document_type_id } = input.data;
  const storagePath = `${user.id}/${employee_id}/${document_type_id}/${crypto.randomUUID()}`;
  const storage = supabase.storage.from(bucket);
  const { error: uploadError } = await storage.upload(storagePath, file, { contentType: file.type, upsert: false });
  if (uploadError) return personnelFailure("The file could not be uploaded. Try again or check that the employee is active.");

  const { error } = await supabase.from("employee_attachments").insert({
    employee_id, document_type_id, storage_path: storagePath,
    file_name: file.name.trim().replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 240) || "Attachment",
    content_type: file.type,
  });
  if (error) {
    await storage.remove([storagePath]);
    return personnelFailure("The upload could not be linked to the checklist. Refresh the page and retry.");
  }
  return saved(employee_id, "Attachment uploaded.");
}
