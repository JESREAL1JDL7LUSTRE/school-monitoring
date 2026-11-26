"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/modules/auth/session";
import { employeePhotoBucket, employeePhotoPath, validatePhoto } from "./photo-storage";
import { mutationFailure, personnelFailure, stalePersonnel, uuid, version, type PersonnelActionState } from "./validation";

const photoChange = z.object({ employee_id: uuid, version, operation: z.enum(["upload", "remove"]) });

export async function saveEmployeePhoto(_: PersonnelActionState, form: FormData) {
  const { supabase } = await requirePermission("personnel.write");
  const input = photoChange.safeParse(Object.fromEntries(form));
  if (!input.success) return personnelFailure("Refresh the employee profile and try again.");
  const { employee_id: id, version: expected, operation } = input.data;
  const current = await supabase.from("employees").select("photo_id")
    .eq("id", id).eq("updated_at", expected).is("archived_at", null).maybeSingle();
  if (current.error) return personnelFailure("The employee photo could not be loaded.");
  if (!current.data) return personnelFailure(stalePersonnel);

  const storage = supabase.storage.from(employeePhotoBucket);
  let photoId: string | null = null;
  if (operation === "upload") {
    const file = await validatePhoto(form.get("photo"));
    if (typeof file === "string") return personnelFailure(file);
    photoId = crypto.randomUUID();
    const { error } = await storage.upload(employeePhotoPath(id, photoId), file, { contentType: file.type, cacheControl: "0" });
    if (error) return personnelFailure("The photo could not be uploaded. Try again.");
  }

  const { data, error } = await supabase.from("employees").update({ photo_id: photoId }).eq("id", id)
    .eq("updated_at", expected).is("archived_at", null).select("id").maybeSingle();
  if (!data) {
    if (photoId) await storage.remove([employeePhotoPath(id, photoId)]);
    return mutationFailure(error, stalePersonnel) ?? personnelFailure(stalePersonnel);
  }
  if (current.data.photo_id) await storage.remove([employeePhotoPath(id, current.data.photo_id)]);
  revalidatePath("/employees");
  revalidatePath("/employees/[id]", "page");
  revalidatePath("/logs");
  return { ok: true, message: photoId ? "Photo saved." : "Photo removed." };
}
