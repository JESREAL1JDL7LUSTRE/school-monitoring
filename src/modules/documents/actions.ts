"use server";

import { notFound, redirect } from "next/navigation";
import { requireSession } from "@/modules/auth/session";
import { recordSlug } from "@/lib/record-slug";
import { getEmployeeDraftProfile, getPersonnelOverview } from "@/modules/personnel/queries";
import { getSchoolLogoUrl, getSchoolSettings } from "@/modules/settings/queries";
import { getTemplate } from "./catalog";
import { buildSnapshot, parseDraftInput, type DocumentSnapshot } from "./snapshot";
import { canAccessForm } from "./queries";

export type DraftResult = { error?: string; draft?: DocumentSnapshot; logoUrl?: string | null; employeeId?: string | null };

export async function submitDraft(slug: string, _previous: DraftResult, form: FormData): Promise<DraftResult> {
  const template = getTemplate(slug);
  const session = await requireSession();
  const saving = form.get("intent") === "save";
  if (!template || template.href || !canAccessForm(session, template.scope, "read")) notFound();
  if (saving && !canAccessForm(session, template.scope, "write")) notFound();

  let input: ReturnType<typeof parseDraftInput>;
  try {
    input = parseDraftInput(form, template);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Review the draft fields." };
  }

  const [settings, profile, overview] = await Promise.all([
    getSchoolSettings(), input.employeeId ? getEmployeeDraftProfile(input.employeeId, template.slug) : undefined,
    template.slug === "total-personnel" ? getPersonnelOverview() : undefined,
  ]);
  if (template.slug === "certificate-of-employment" && (profile?.employee.archived_at || !profile?.employee.date_hired)) {
    return { error: "Choose an active employee with a hire date on file." };
  }
  const snapshot = buildSnapshot(template, settings, input, profile, overview);
  if (!saving) return { draft: snapshot, logoUrl: await getSchoolLogoUrl(snapshot.school.logoPath), employeeId: input.employeeId };

  const { data, error } = await session.supabase.rpc("save_generated_document", {
    p_slug: template.slug, p_version: template.version, p_employee_id: input.employeeId, p_snapshot: snapshot,
  });
  if (error || !data) return { error: "Could not save the draft. Try again." };
  redirect(`/forms/${recordSlug(template.slug, data)}`);
}
