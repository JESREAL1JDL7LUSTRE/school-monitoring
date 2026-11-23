import "server-only";

import { requirePermission } from "@/modules/auth/session";

const pageSize = 25;

export async function getLeavePage(page: number) {
  const { supabase } = await requirePermission("personnel.read");
  const first = (page - 1) * pageSize;
  const { data, count, error } = await supabase.from("employee_leaves")
    .select("id,leave_type,start_date,end_date,employees(full_name,employee_no)", { count: "exact" })
    .order("start_date", { ascending: false }).order("id", { ascending: false })
    .range(first, first + pageSize - 1);
  if (error?.code === "PGRST103" && page > 1) return { records: [], totalPages: 1 };
  if (error) throw new Error("Could not load leave records.");
  return { records: data, totalPages: Math.max(1, Math.ceil((count ?? 0) / pageSize)) };
}

export async function getLeaveRecord(id: string) {
  const { supabase } = await requirePermission("personnel.read");
  const { data, error } = await supabase.from("employee_leaves")
    .select("id,employee_id,leave_type,start_date,end_date,updated_at,employees(full_name,employee_no)")
    .eq("id", id).maybeSingle();
  if (error) throw new Error("Could not load the leave record.");
  return data;
}
