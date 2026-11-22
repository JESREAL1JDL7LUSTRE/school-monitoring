"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/modules/auth/session";
import { calendarDateSchema } from "./dates";

const eventInput = z.object({
  title: z.string().trim().min(1, "Enter an event title.").max(120, "Use 120 characters or fewer for the title."),
  event_date: calendarDateSchema,
  start_time: z.union([z.literal(""), z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)]).transform((value) => value || null),
  notes: z.string().trim().max(2000, "Use 2,000 characters or fewer for the notes.").transform((value) => value || null),
});

type CalendarEventState = { error?: string; savedDate?: string };

export async function addCalendarEvent(_state: CalendarEventState, form: FormData): Promise<CalendarEventState> {
  const { supabase } = await requirePermission("calendar.write");
  const result = eventInput.safeParse(Object.fromEntries(form));
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
