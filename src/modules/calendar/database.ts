import type { Table } from "@/types/database";

export type CalendarEvent = {
  id: string;
  title: string;
  event_date: string;
  start_time: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
};

type CalendarEventInput = Pick<CalendarEvent, "title" | "event_date" | "start_time" | "notes">;

export type CalendarTables = {
  calendar_events: Table<CalendarEvent, CalendarEventInput, never>;
};
