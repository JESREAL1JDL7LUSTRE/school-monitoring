"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createSchoolClient } from "@/lib/supabase/server";

const credentials = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(1).max(1024),
});

export const signIn = async (_previousState: string | null, form: FormData): Promise<string | null> => {
  if (!getSupabaseConfig()) return "Configure the Supabase connection before signing in.";
  const parsed = credentials.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return "Enter a valid email address and your password.";

  const supabase = await createSchoolClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return "Sign-in failed. Check your email and password, then try again.";
  redirect("/");
};

export const signOut = async () => {
  if (getSupabaseConfig()) {
    const supabase = await createSchoolClient();
    await supabase.auth.signOut({ scope: "local" });
  }
  redirect("/login");
};
