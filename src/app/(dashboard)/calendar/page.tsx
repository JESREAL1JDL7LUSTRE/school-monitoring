import { CalendarDays } from "lucide-react";
import { MonthCalendar } from "@/components/month-calendar";
import { hasPermission, requirePermission } from "@/modules/auth/session";
import { resolveCalendarDate, resolveCalendarMonth, todayInManila } from "@/modules/calendar/dates";
import { getCalendarEntries } from "@/modules/calendar/queries";

export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const [session, params] = await Promise.all([requirePermission("calendar.read"), searchParams]);
  const today = todayInManila();
  const month = resolveCalendarMonth(params.month, today);
  const selected = resolveCalendarDate(params.day, month);
  const events = await getCalendarEntries(month);

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <div className="grid size-11 place-items-center rounded-lg bg-accent text-accent-foreground"><CalendarDays size={22} aria-hidden /></div>
        <h1 className="desk-heading">Calendar</h1>
      </header>
      <MonthCalendar today={today} monthKey={month} selectedDate={selected} events={events}
        canAdd={hasPermission(session, "calendar.write")} />
    </div>
  );
}
