"use server";

import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSupabaseConfig } from "@/lib/supabase/config";
import type { Database } from "@/types/database";
import { roleLabels, type Role } from "./permissions";
import { requirePermission } from "./session";

type InvitationState = { error?: string; credentials?: { email: string; password: string } };
const invitation = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  role: z.enum(Object.keys(roleLabels) as Role[]),
});

export async function inviteStaff(_: InvitationState, form: FormData): Promise<InvitationState> {
  const { supabase } = await requirePermission("settings.write");
  const input = invitation.safeParse(Object.fromEntries(form));
  if (!input.success) return { error: "Enter a valid staff email and choose a role." };

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const config = getSupabaseConfig();
  if (!serviceKey || !config) {
    return { error: "Configure staff account creation before inviting staff." };
  }

  const { email, role } = input.data;
  const client = createClient<Database>(config.url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const password = "Aa1!" + randomBytes(18).toString("base64url");
  const { data, error } = await client.auth.admin.createUser({
    email, password, email_confirm: true, app_metadata: { temporary_password: true },
  });
  if (error || !data.user) return { error: "Could not create this account. Check whether the address already has a staff account." };

  const assignment = await supabase.rpc("update_staff_role", { target_email: email, target_role: role, enabled: true });
  if (assignment.data !== "saved") {
    const rollback = await client.auth.admin.deleteUser(data.user.id);
    return { error: rollback.error ? "Role assignment failed. Check Staff access before retrying." : "Role assignment failed. Try creating the account again." };
  }
  revalidatePath("/settings/access");
  return { credentials: { email, password } };
}
