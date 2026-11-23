import { z } from "zod";
import { calendarDateSchema } from "./dates";

const eventFields = z.object({
  title: z.string().trim().min(1, "Enter an event title.").max(120, "Use 120 characters or fewer for the title."),
  event_date: calendarDateSchema,
  start_time: z.union([z.literal(""), z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)]).transform((value) => value || null),
  notes: z.string().trim().max(2000, "Use 2,000 characters or fewer for the notes.").transform((value) => value || null),
});

export const parseCalendarEvent = (form: FormData) => eventFields.safeParse(Object.fromEntries(form));
