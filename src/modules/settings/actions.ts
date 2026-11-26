"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/modules/auth/session";
import { roleLabels, type Role } from "@/modules/auth/permissions";
import { z } from "zod";
import { settingsSchemas, type SettingsSection } from "./fields";
import type { Json } from "@/types/database";

const logoFormats = {
  "image/png": { extension: "png", matches: (bytes: Uint8Array) => bytes.slice(0, 8).toString() === "137,80,78,71,13,10,26,10" },
  "image/jpeg": { extension: "jpg", matches: (bytes: Uint8Array) => bytes.slice(0, 3).toString() === "255,216,255" },
  "image/webp": {
    extension: "webp",
    matches: (bytes: Uint8Array) => String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
      && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP",
  },
};

export type SettingsActionState = {
  error?: string;
  message?: string;
  values?: Record<string, string>;
};

const staffRoleChange = z.object({
  target_email: z.string().trim().toLowerCase().pipe(z.email()),
  target_role: z.enum(Object.keys(roleLabels) as Role[]),
  operation: z.enum(["grant", "revoke"]),
});

export const saveStaffRole = async (_previous: SettingsActionState, form: FormData): Promise<SettingsActionState> => {
  const { supabase } = await requirePermission("settings.write");
  const parsed = staffRoleChange.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Select a role and enter the staff account email." };
  const { operation, ...target } = parsed.data;
  const { data, error } = await supabase.rpc("update_staff_role", { ...target, enabled: operation === "grant" });
  if (error) return { error: "Could not change this role. Try again." };
  if (data === "account_missing") return { error: "Use Invite staff to create this account and assign its first role." };
  if (data === "protected_administrator") return { error: "Only that administrator can change their own roles." };
  if (data === "last_administrator") return { error: "Assign an active administrator before removing this role." };
  revalidatePath("/", "layout");
  return { message: "Staff access saved." };
};

export const saveSchoolSettings = async (section: SettingsSection, _previous: SettingsActionState, form: FormData): Promise<SettingsActionState> => {
  const { supabase } = await requirePermission("settings.write");
  if (!Object.hasOwn(settingsSchemas, section)) return { error: "Open a settings section before saving." };
  const entries = Object.fromEntries(
    Array.from(form.entries()).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
  const { updated_at: updatedAt, ...values } = entries;
  const fail = (error: string): SettingsActionState => ({ error, values });
  const parsed = settingsSchemas[section].safeParse(values);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return fail(issue.code === "custom" ? issue.message : "Check the school details and rule values.");
  }
  if (!updatedAt || !Number.isFinite(Date.parse(updatedAt))) return fail("Reload the settings before saving.");

  const current = await supabase.from("school_settings").select("updated_at").eq("id", 1).single();
  if (current.error) return fail("Could not check the current settings. Try again.");
  if (current.data.updated_at !== updatedAt) return fail("Another staff member changed these settings. Reload before saving.");

  let changes: Json = parsed.data;
  const logo = section === "identity" ? form.get("logo") : null;
  if (logo instanceof File && logo.size > 0) {
    const format = logoFormats[logo.type as keyof typeof logoFormats];
    if (logo.size > 2 * 1024 * 1024 || !format || !format.matches(new Uint8Array(await logo.slice(0, 12).arrayBuffer()))) {
      return fail("Choose a PNG, JPEG, or WebP image up to 2 MB.");
    }
    const logoPath = `logos/${crypto.randomUUID()}.${format.extension}`;
    const { error } = await supabase.storage.from("school-logos").upload(logoPath, logo, { contentType: logo.type });
    if (error) return fail("Could not upload the logo. Try again.");
    changes = { ...parsed.data, logo_path: logoPath };
  } else if (section === "identity" && form.get("remove_logo") === "on") {
    changes = { ...parsed.data, logo_path: null };
  }

  const { data, error } = await supabase.rpc("update_school_settings", { expected_updated_at: updatedAt, changes });
  if (error) return fail("Could not save the school settings. Check the values and try again.");
  if (!data) return fail("Another staff member changed these settings. Reload before saving.");

  revalidatePath("/", "layout");
  return { message: "School settings saved." };
};
