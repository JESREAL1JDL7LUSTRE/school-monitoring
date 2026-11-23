"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { EmployeeLeave } from "./database";
import { saveLeave } from "./leave-actions";

type EmployeeOption = { id: string; label: string };

export function LeaveForm({ record, employees }: { record?: EmployeeLeave; employees: EmployeeOption[] }) {
  const version = record ? { id: record.id, updated_at: record.updated_at } : null;
  const [state, submit, pending] = useActionState(saveLeave.bind(null, version), {});
  const [employee, setEmployee] = useState<EmployeeOption | null>(null);
  const [type, setType] = useState(record?.leave_type ?? "");
  const [start, setStart] = useState(record?.start_date ?? "");
  const [end, setEnd] = useState(record?.end_date ?? "");

  return (
    <form action={submit} className="space-y-4">
      <fieldset disabled={pending} className="grid gap-4 sm:grid-cols-2">
        {!record && <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="leave-employee">Employee</Label>
          <Combobox items={employees} value={employee} onValueChange={setEmployee}
            itemToStringLabel={(item) => item.label} itemToStringValue={(item) => item.id}
            name="employee_id" required>
            <ComboboxInput id="leave-employee" className="h-11 w-full" placeholder="Search by name or employee ID" />
            <ComboboxContent>
              <ComboboxEmpty>No employees found.</ComboboxEmpty>
              <ComboboxList>{(item: EmployeeOption) => (
                <ComboboxItem key={item.id} value={item} className="min-h-11">{item.label}</ComboboxItem>
              )}</ComboboxList>
            </ComboboxContent>
          </Combobox>
        </div>}
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="leave-type">Leave type</Label>
          <Input id="leave-type" name="leave_type" className="h-11" value={type}
            onChange={(event) => setType(event.target.value)} maxLength={80} required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="leave-start">Start date</Label>
          <Input id="leave-start" name="start_date" type="date" className="h-11" min="1900-01-01"
            max="9999-12-31" value={start} onChange={(event) => setStart(event.target.value)} required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="leave-end">End date</Label>
          <Input id="leave-end" name="end_date" type="date" className="h-11" min={start || "1900-01-01"}
            max="9999-12-31" value={end} onChange={(event) => setEnd(event.target.value)} required />
        </div>
      </fieldset>
      {state.error && <Alert variant="destructive" role="alert"><AlertDescription>{state.error}</AlertDescription></Alert>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" className="min-h-11" disabled={pending || (!record && !employee)}>
          {pending ? "Saving…" : "Save leave record"}
        </Button>
        <Button asChild variant="outline" className="min-h-11"><Link href="/leaves">Cancel</Link></Button>
      </div>
    </form>
  );
}
