import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CalendarEntry } from "./queries";

export const fullDate = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "long", timeZone: "UTC",
});

const eventTime = new Intl.DateTimeFormat("en-PH", {
  timeStyle: "short", timeZone: "UTC",
});

export const dateFromISO = (date: string) => new Date(`${date}T00:00:00Z`);

export function CalendarAgenda({ entries, selectedDate, monthLabel, showMonth }: {
  entries: CalendarEntry[];
  selectedDate: string | null;
  monthLabel: string;
  showMonth: () => void;
}) {
  const agenda = selectedDate ? entries.filter((entry) => entry.event_date === selectedDate) : entries;
  const label = selectedDate ? fullDate.format(dateFromISO(selectedDate)) : monthLabel;

  return (
    <Card id="calendar-events" className="scroll-mt-4">
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle><h2>Events for {label}</h2></CardTitle>
        {selectedDate && <Button type="button" variant="outline" onClick={showMonth}>Show all month events</Button>}
      </CardHeader>
      <CardContent>
        {agenda.length ? (
          <ul className="divide-y">
            {agenda.map((entry) => (
              <li key={entry.id} className="space-y-1 py-3 first:pt-0 last:pb-0">
                <p className="font-medium wrap-anywhere">{entry.title}</p>
                <p className="text-sm text-muted-foreground">
                  <time dateTime={entry.event_date}>{fullDate.format(dateFromISO(entry.event_date))}</time>
                  {" · "}
                  {entry.start_time ? (
                    <time dateTime={`${entry.event_date}T${entry.start_time}+08:00`}>
                      {eventTime.format(new Date(`${entry.event_date}T${entry.start_time}Z`))}
                    </time>
                  ) : "All day"}
                </p>
                {entry.notes && <p className="whitespace-pre-wrap text-sm wrap-anywhere">{entry.notes}</p>}
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted-foreground">No events scheduled.</p>}
      </CardContent>
    </Card>
  );
}
