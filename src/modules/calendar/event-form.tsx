"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { addCalendarEvent } from "./actions";

export function CalendarEventForm({ date, onCancel, onSave }: {
  date: string;
  onCancel: () => void;
  onSave: (date: string) => void;
}) {
  const [state, submit, pending] = useActionState(async (_previous: Awaited<ReturnType<typeof addCalendarEvent>>, form: FormData) => {
    const result = await addCalendarEvent({}, form);
    if (result.savedDate) onSave(result.savedDate);
    return result;
  }, {});
  const [values, setValues] = useState({ title: "", date, time: "", notes: "" });

  return (
    <Card id="calendar-event-form">
      <CardHeader><CardTitle><h2>New calendar event</h2></CardTitle></CardHeader>
      <CardContent>
        <form action={submit} className="space-y-4">
          <fieldset disabled={pending} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="calendar-title">Event title</Label>
              <Input id="calendar-title" name="title" required maxLength={120} value={values.title}
                onChange={(event) => setValues({ ...values, title: event.target.value })} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="calendar-date">Date</Label>
                <Input id="calendar-date" name="event_date" type="date" min="1900-01-01" max="9999-12-31" required
                  value={values.date} onChange={(event) => setValues({ ...values, date: event.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="calendar-time">Start time (optional)</Label>
                <Input id="calendar-time" name="start_time" type="time" value={values.time}
                  onChange={(event) => setValues({ ...values, time: event.target.value })} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="calendar-notes">Notes (optional)</Label>
              <Textarea id="calendar-notes" name="notes" maxLength={2000} value={values.notes}
                onChange={(event) => setValues({ ...values, notes: event.target.value })} />
            </div>
            {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
            <div className="flex flex-wrap gap-2">
              <Button type="submit">{pending ? "Saving…" : "Save event"}</Button>
              <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
            </div>
          </fieldset>
        </form>
      </CardContent>
    </Card>
  );
}
