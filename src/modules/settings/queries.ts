import "server-only";

import { cache } from "react";
import { requirePermission } from "@/modules/auth/session";

export const getStaffRoles = async () => {
  const { supabase } = await requirePermission("settings.write");
  const { data, error } = await supabase.rpc("list_staff_roles");
  if (error) throw new Error("Could not load staff roles.");
  return data;
};

export const getSchoolSettings = cache(async () => {
  const { supabase } = await requirePermission("settings.read");
  const { data, error } = await supabase.from("school_settings").select("*").eq("id", 1).single();
  if (error) throw new Error("Could not load school settings.");
  return data;
});

export const getSchoolLogoUrl = cache(async (logoPath: string | null) => {
  if (!logoPath) return null;
  const { supabase } = await requirePermission("settings.read");
  const { data, error } = await supabase.storage.from("school-logos").createSignedUrl(logoPath, 300);
  if (error) throw new Error("Could not load the school logo.");
  return data.signedUrl;
});
