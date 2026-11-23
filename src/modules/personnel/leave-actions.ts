"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/modules/auth/session";
import { leaveEmployeeId, leaveRecordId, parseLeaveDetails } from "./leave-input";

type LeaveVersion = { id: string; updated_at: string };
type LeaveResult = { error?: string };

export async function saveLeave(version: LeaveVersion | null, _state: LeaveResult, form: FormData): Promise<LeaveResult> {
  const { supabase } = await requirePermission("personnel.write");
  const details = parseLeaveDetails(form);
  if (!details.success) return { error: details.error.issues[0].message };

  if (version) {
    if (!leaveRecordId.safeParse(version.id).success || !z.iso.datetime({ offset: true }).safeParse(version.updated_at).success) {
      return { error: "Open the leave record again before saving." };
    }
    const { data, error } = await supabase.from("employee_leaves").update(details.data)
      .eq("id", version.id).eq("updated_at", version.updated_at).select("id").maybeSingle();
    if (error) return { error: "Could not save the changes. Try again." };
    if (!data) return { error: "This record changed while you were editing. Reopen it to see the latest version." };
  } else {
    const employee = leaveEmployeeId.safeParse(form.get("employee_id"));
    if (!employee.success) return { error: "Choose an employee." };
    const { error } = await supabase.from("employee_leaves").insert({ employee_id: employee.data, ...details.data });
    if (error?.code === "42501" || error?.code === "23503") return { error: "Choose an active employee and try again." };
    if (error) return { error: "Could not add the leave record. Try again." };
  }

  revalidatePath("/leaves");
  redirect("/leaves?saved=1");
}
