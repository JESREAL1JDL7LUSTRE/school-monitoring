import "server-only";

import { requirePermission } from "@/modules/auth/session";
import type { CalendarEvent } from "./database";

export type CalendarEntry = Pick<CalendarEvent, "id" | "title" | "event_date" | "start_time" | "notes">;

export const getCalendarEntries = async (month: string): Promise<CalendarEntry[]> => {
  const { supabase } = await requirePermission("calendar.read");
  const [year, index] = month.split("-").map(Number);
  const endOfMonth = new Date(Date.UTC(year, index, 0)).getUTCDate();
  const pageSize = 500;
  const entries: CalendarEntry[] = [];

  for (let start = 0; ; start += pageSize) {
    const { data, error } = await supabase.from("calendar_events")
      .select("id,title,event_date,start_time,notes")
      .gte("event_date", `${month}-01`)
      .lte("event_date", `${month}-${endOfMonth}`)
      .order("event_date").order("start_time", { nullsFirst: true }).order("id")
      .range(start, start + pageSize - 1);
    if (error) throw new Error("Could not load calendar events.");

    entries.push(...data);
    if (data.length < pageSize) return entries;
  }
};
