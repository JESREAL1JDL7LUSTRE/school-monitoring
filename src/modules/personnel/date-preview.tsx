"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { employmentStatuses, type Employee } from "./database";
import { employeeDateMetrics, formatPersonnelDate, type PersonnelContext } from "./rules";
import { Field } from "./ui";

const calendarFields = [
  ["date_of_birth", "Birth date"],
  ["date_hired", "Hire date"],
  ["step_date", "Last step date"],
] as const;

export function OpeningEmployeeDates({ context }: { context: PersonnelContext }) {
  const [employmentStatus, setEmploymentStatus] = useState<Employee["employment_status"]>("Permanent");
  const [dates, setDates] = useState({ date_of_birth: "", date_hired: "", step_date: "" });
  const metrics = employeeDateMetrics({
    employment_status: employmentStatus,
    date_of_birth: dates.date_of_birth || null,
    date_hired: dates.date_hired || null,
    step_date: dates.step_date || null,
  }, context);

  return (
    <>
      <Field label="Employment status">
        <NativeSelect name="employment_status" value={employmentStatus} className="w-full"
          onChange={(event) => setEmploymentStatus(event.target.value as Employee["employment_status"])}>
          {employmentStatuses.map((status) => <NativeSelectOption key={status} value={status}>{status}</NativeSelectOption>)}
        </NativeSelect>
      </Field>
      {calendarFields.map(([field, label]) => (
        <Field key={field} label={label}>
          <Input name={field === "step_date" ? "initial_step_date" : field} type="date" value={dates[field]}
            onChange={(event) => setDates((previous) => ({ ...previous, [field]: event.target.value }))} />
        </Field>
      ))}
      <div className="rounded-md border bg-muted/30 p-3 text-sm sm:col-span-2" role="status">
        <p className="mb-2 text-xs font-medium text-muted-foreground">Draft estimates as of {formatPersonnelDate(context.asOf)}</p>
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div><dt>Age</dt><dd className="font-semibold">{metrics.age ?? "—"}</dd></div>
          <div><dt>Years in service</dt><dd className="font-semibold">{metrics.yearsOfService ?? "—"}</dd></div>
          <div><dt>Next step</dt><dd className="font-semibold">{formatPersonnelDate(metrics.eligibleOn)}</dd></div>
          <div><dt>Retirement date</dt><dd className="font-semibold">{formatPersonnelDate(metrics.retirementDate)}</dd></div>
        </dl>
      </div>
    </>
  );
}
