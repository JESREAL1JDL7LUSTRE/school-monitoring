import "server-only";

import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createSchoolClient } from "@/lib/supabase/server";
import { permissions, type Permission } from "./permissions";

export type { Permission, Role } from "./permissions";

export const getSession = cache(async () => {
  if (!getSupabaseConfig()) return null;
  const supabase = await createSchoolClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  const { data, error: accessError } = await supabase.rpc("get_staff_access");
  if (accessError || !data) throw new Error("Could not check your school account permissions.");
  return {
    user,
    supabase,
    roles: data.roles,
    permissions: permissions.filter((permission) => data.permissions.includes(permission)),
  };
});

export const requireSession = async () => {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.roles.length) redirect("/login?access=pending");
  return session;
};

export const hasPermission = (session: { permissions: readonly Permission[] }, permission: Permission) =>
  session.permissions.includes(permission);

export const requirePermission = async (permission: Permission) => {
  const session = await requireSession();
  if (!hasPermission(session, permission)) notFound();
  return session;
};
