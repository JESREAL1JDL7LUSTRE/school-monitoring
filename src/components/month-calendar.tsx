"use client";

import { type ComponentProps, useOptimistic, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CalendarAgenda, dateFromISO, fullDate, type AgendaEntry } from "@/modules/calendar/agenda";
import { firstCalendarYear, lastCalendarYear, monthKey as toMonthKey, resolveCalendarDate } from "@/modules/calendar/dates";
import { CalendarEventForm } from "@/modules/calendar/event-form";
import type { CalendarEntry } from "@/modules/calendar/queries";

const monthFormat = new Intl.DateTimeFormat("en-PH", { month: "long", timeZone: "UTC" });
const periodFormat = new Intl.DateTimeFormat("en-PH", { month: "long", year: "numeric", timeZone: "UTC" });
const months = Array.from({ length: 12 }, (_, i) => monthFormat.format(new Date(Date.UTC(2000, i, 1))));
const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function CalendarDay({ date, day, today, selectedDate, entries, onClick }: {
  date: string;
  day: number;
  today: string;
  selectedDate: string | null;
  entries: CalendarEntry[];
  onClick: ComponentProps<typeof Button>["onClick"];
}) {
  const count = entries.length;
  const selected = selectedDate === date;

  return (
    <Button type="button" variant={selected ? "secondary" : "ghost"} aria-pressed={selected} onClick={onClick}
      aria-label={`${fullDate.format(dateFromISO(date))}${count ? `, ${count} ${count === 1 ? "event" : "events"}` : ""}`}
      className="h-full min-h-11 w-full min-w-0 flex-col justify-start gap-1 px-0 py-0.5 sm:px-1">
      <time dateTime={date} aria-current={date === today ? "date" : undefined}
        className={date === today ? "inline-grid size-7 place-items-center rounded-full bg-primary font-semibold text-primary-foreground" : "inline-grid size-7 place-items-center"}>
        {day}
      </time>
      {!!count && <>
        <span className="rounded-full bg-accent px-1.5 text-xs font-medium text-accent-foreground md:hidden" aria-hidden="true">{count}</span>
        <span className="hidden w-full truncate px-1 text-left text-xs font-medium text-primary md:block" aria-hidden="true">
          {entries[0].title}{count > 1 && ` +${count - 1}`}
        </span>
      </>}
    </Button>
  );
}

export function MonthCalendar({ today, monthKey, events, canAdd }: {
  today: string;
  monthKey: string;
  events: CalendarEntry[];
  canAdd: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedDate = resolveCalendarDate(searchParams.get("day") ?? undefined, monthKey);
  const [visibleEvents, showPendingEvent] = useOptimistic<AgendaEntry[], CalendarEntry>(events, (entries, entry) => [
    ...entries, { ...entry, pending: true },
  ].sort((a, b) => a.event_date.localeCompare(b.event_date) || (a.start_time ?? "").localeCompare(b.start_time ?? "")));
  const [pending, navigate] = useTransition();
  const [formDate, setFormDate] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const addButton = useRef<HTMLButtonElement>(null);
  const period = dateFromISO(`${monthKey}-01`);
  const year = period.getUTCFullYear();
  const month = period.getUTCMonth();
  const offset = period.getUTCDay();
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const weekCount = Math.ceil((offset + days) / 7);
  const monthLabel = periodFormat.format(period);
  const eventsByDate = new Map<string, CalendarEntry[]>();
  for (const entry of visibleEvents) {
    const entries = eventsByDate.get(entry.event_date);
    if (entries) entries.push(entry);
    else eventsByDate.set(entry.event_date, [entry]);
  }

  function showDate(month: string, day?: string | null) {
    const params = new URLSearchParams({ month });
    if (day) params.set("day", day);
    const href = `/calendar?${params}`;
    if (month === monthKey) {
      if (href !== window.location.pathname + window.location.search) window.history.pushState(null, "", href);
      return;
    }
    navigate(() => router.push(href, { scroll: false }));
  }

  function closeForm() {
    setFormDate(null);
    addButton.current?.focus();
  }

  function saveEvent(date: string) {
    closeForm();
    setSaved(true);
    showDate(date.slice(0, 7), date);
  }

  const setMonth = (next: number) => showDate(toMonthKey(year, next));

  return (
    <div className="space-y-5">
      {canAdd && <div className="flex flex-wrap items-center gap-3">
        <Button type="button" ref={addButton} aria-expanded={formDate !== null}
          aria-controls={formDate ? "calendar-event-form" : undefined} onClick={() => {
            if (formDate) return closeForm();
            setSaved(false);
            setFormDate(selectedDate ?? (today.startsWith(`${monthKey}-`) ? today : `${monthKey}-01`));
          }}>
          <Plus aria-hidden="true" /> Add event
        </Button>
        <p role="status" className="text-sm text-muted-foreground">{saved ? "Event saved." : ""}</p>
      </div>}
      {formDate && <CalendarEventForm date={formDate} onCancel={closeForm} onSave={saveEvent} onPending={(entry) => {
        if (entry.event_date.startsWith(`${monthKey}-`)) showPendingEvent(entry);
      }} />}
    {pending && <span role="status" className="sr-only">Loading calendar month…</span>}
    <Card aria-busy={pending}>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="calendar-month" aria-live="polite" className="text-2xl font-semibold tracking-tight">{monthLabel}</h2>
          <div className="flex gap-2" role="group" aria-label="Calendar navigation">
            <Button variant="outline" size="icon" aria-label="Previous month" disabled={year === firstCalendarYear && month === 0}
              onClick={() => setMonth(month - 1)}><ChevronLeft /></Button>
            <Button variant="outline" onClick={() => showDate(today.slice(0, 7))}>Today</Button>
            <Button variant="outline" size="icon" aria-label="Next month" disabled={year === lastCalendarYear && month === 11}
              onClick={() => setMonth(month + 1)}><ChevronRight /></Button>
          </div>
        </div>
        <div className="mt-2 grid grid-cols-4 gap-1 sm:grid-cols-6 xl:grid-cols-12" role="group" aria-label="Jump to month">
          {months.map((label, index) => (
            <Button key={label} variant={index === month ? "secondary" : "ghost"} aria-pressed={index === month} aria-label={label} onClick={() => setMonth(index)} className="px-1">
              <span className="xl:hidden">{label.slice(0, 3)}</span><span className="hidden xl:inline">{label}</span>
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="px-3 sm:px-6">
        <table className="w-full table-fixed border-separate border-spacing-0 overflow-hidden rounded-lg border text-sm" aria-labelledby="calendar-month">
          <thead className="bg-muted text-muted-foreground">
            <tr>{weekdays.map((day) => <th scope="col" key={day} className="py-3 font-semibold"><abbr title={day} className="no-underline">{day.slice(0, 3)}</abbr></th>)}</tr>
          </thead>
          <tbody>
            {Array.from({ length: weekCount }, (_, week) => (
              <tr key={week}>
                {weekdays.map((weekday, index) => {
                  const day = week * 7 + index - offset + 1;
                  const date = day >= 1 && day <= days ? new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10) : null;
                  return (
                    <td key={weekday} className="h-13 border-t border-r p-1 text-center align-top last:border-r-0 sm:h-23 sm:p-2">
                      {date && <CalendarDay date={date} day={day} today={today} selectedDate={selectedDate}
                        entries={eventsByDate.get(date) ?? []} onClick={() => showDate(monthKey, selectedDate === date ? null : date)} />}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
      <CalendarAgenda entries={visibleEvents} selectedDate={selectedDate} monthLabel={monthLabel} showMonth={() => showDate(monthKey)} />
    </div>
  );
}
