import "server-only";

import { notFound } from "next/navigation";
import { z } from "zod";
import { hasPermission, requireSession } from "@/modules/auth/session";
import { getSchoolLogoUrl } from "@/modules/settings/queries";
import { formPermissions, type FormScope } from "./catalog";
import { snapshotSchema } from "./snapshot";

export function canAccessForm(session: Awaited<ReturnType<typeof requireSession>>, scope: FormScope, mode: "read" | "write") {
  return formPermissions(scope, mode).every((permission) => hasPermission(session, permission));
}

const draftsPerPage = 20;

export async function listGeneratedDocuments(page: number) {
  const { supabase } = await requireSession();
  const start = (page - 1) * draftsPerPage;
  const { data, error } = await supabase.from("generated_documents").select("id,template_slug,title,created_at")
    .order("created_at", { ascending: false }).order("id", { ascending: false }).range(start, start + draftsPerPage);
  if (error) throw new Error("Could not load saved drafts.");
  return { drafts: data.slice(0, draftsPerPage), hasNext: data.length > draftsPerPage };
}

export async function readGeneratedDocument(id: string) {
  if (!z.uuid().safeParse(id).success) notFound();
  const session = await requireSession();
  const { data, error } = await session.supabase.from("generated_documents").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error("Could not load the saved draft.");
  if (!data || !canAccessForm(session, data.scope, "read")) notFound();
  const snapshot = snapshotSchema.parse(data.snapshot);
  return { ...data, snapshot, logoUrl: await getSchoolLogoUrl(snapshot.school.logoPath) };
}
