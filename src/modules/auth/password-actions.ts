"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createSchoolClient } from "@/lib/supabase/server";

type PasswordState = { error?: string; message?: string };
export async function updatePassword(_: PasswordState, form: FormData): Promise<PasswordState> {
  const password = z.string().min(12).max(72).safeParse(form.get("password"));
  if (!password.success || new TextEncoder().encode(password.data).length > 72) {
    return { error: "Use a password with at least 12 characters and up to 72 bytes." };
  }
  if (password.data !== form.get("confirm-password")) return { error: "Enter the same password in both fields." };
  if (!getSupabaseConfig()) return { error: "Password reset is unavailable. Contact your school administrator." };

  const supabase = await createSchoolClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: "Your session expired. Sign in again." };
  const { error } = await supabase.auth.updateUser({ password: password.data });
  if (error?.code === "same_password") return { error: "Choose a password different from your current password." };
  if (error?.code === "weak_password") return { error: "Choose a stronger password that meets the school’s password requirements." };
  if (error) return { error: "The password could not be updated. Sign in again and retry." };
  const signOut = await supabase.auth.signOut({ scope: "global" });
  if (signOut.error) await supabase.auth.signOut({ scope: "local" });
  redirect("/login?password=updated");
}
