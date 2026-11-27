import { Suspense } from "react";
import { DashboardLoading } from "@/components/dashboard-loading";
import { CalendarHeading, MonthCalendar } from "@/components/month-calendar";
import { hasPermission, requirePermission } from "@/modules/auth/session";
import { resolveCalendarMonth, todayInManila } from "@/modules/calendar/dates";
import { getCalendarEntries } from "@/modules/calendar/queries";

export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const [session, params] = await Promise.all([requirePermission("calendar.read"), searchParams]);
  const today = todayInManila();
  const month = resolveCalendarMonth(params.month, today);

  return (
    <Suspense fallback={<div className="space-y-5"><CalendarHeading /><DashboardLoading kind="calendar" /></div>}>
      <CalendarContent today={today} month={month} canAdd={hasPermission(session, "calendar.write")} />
    </Suspense>
  );
}

async function CalendarContent({ today, month, canAdd }: { today: string; month: string; canAdd: boolean }) {
  const events = await getCalendarEntries(month);
  return <MonthCalendar today={today} monthKey={month} events={events} canAdd={canAdd} />;
}
