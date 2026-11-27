import "server-only";

import type { createSchoolClient } from "@/lib/supabase/server";
import type { Employee } from "./database";
import { employeePhotoBucket, employeePhotoPath } from "./photo-storage";
import { mutationFailure, personnelFailure, stalePersonnel } from "./validation";

export async function updateEmployeePhoto(
  supabase: Awaited<ReturnType<typeof createSchoolClient>>,
  id: string,
  expected: string,
  photo: File | null,
  profile?: Partial<Employee>,
) {
  const current = await supabase.from("employees").select("photo_id")
    .eq("id", id).eq("updated_at", expected).is("archived_at", null).maybeSingle();
  if (current.error) return personnelFailure("The employee photo could not be loaded.");
  if (!current.data) return personnelFailure(stalePersonnel);

  const storage = supabase.storage.from(employeePhotoBucket);
  let photoId: string | null = null;
  if (photo) {
    photoId = crypto.randomUUID();
    const { error } = await storage.upload(employeePhotoPath(id, photoId), photo, { contentType: photo.type, cacheControl: "0" });
    if (error) return personnelFailure("The photo could not be uploaded. Try again.");
  }

  const { data, error } = await supabase.from("employees").update({ ...profile, photo_id: photoId }).eq("id", id)
    .eq("updated_at", expected).is("archived_at", null).select("id").maybeSingle();
  if (!data) {
    if (photoId) await storage.remove([employeePhotoPath(id, photoId)]);
    return mutationFailure(error, "This employee ID is already in use.") ?? personnelFailure(stalePersonnel);
  }
  if (current.data.photo_id) await storage.remove([employeePhotoPath(id, current.data.photo_id)]);
  return null;
}
