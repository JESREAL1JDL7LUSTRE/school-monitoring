"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/modules/auth/session";
import { parseCalendarEvent } from "./event-input";

type CalendarEventState = { error?: string; savedDate?: string };

export async function addCalendarEvent(_state: CalendarEventState, form: FormData): Promise<CalendarEventState> {
  const { supabase } = await requirePermission("calendar.write");
  const result = parseCalendarEvent(form);
  if (!result.success) {
    const issue = result.error.issues[0];
    const message = issue.path[0] === "event_date" ? "Enter a valid event date."
      : issue.path[0] === "start_time" ? "Enter a valid start time." : issue.message;
    return { error: message };
  }

  const { error } = await supabase.from("calendar_events").insert(result.data);
  if (error) return { error: "Could not save the event. Please try again." };

  revalidatePath("/calendar");
  return { savedDate: result.data.event_date };
}
