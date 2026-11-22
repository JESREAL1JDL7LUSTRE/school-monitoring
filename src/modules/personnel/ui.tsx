import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { Employee } from "./database";

export function PersonnelHeading({ title, children, actions }: { title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-5 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="desk-heading">{title}</h1>
        {children ? <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{children}</p> : null}
      </div>
      {actions}
    </header>
  );
}

export function Field({ children, label }: { children: ReactNode; label: string }) {
  return <Label className="flex min-w-0 flex-col items-stretch gap-2 text-sm">{label}{children}</Label>;
}

export function Choices({ name, value, values, label }: { name: string; value?: string; values: readonly string[]; label?: string }) {
  return (
    <NativeSelect name={name} defaultValue={value} aria-label={label} className="w-full">
      {values.map((option) => <NativeSelectOption key={option} value={option}>{option}</NativeSelectOption>)}
    </NativeSelect>
  );
}

export function EmployeePicker({ employees }: { employees: Employee[] }) {
  return (
    <Field label="Employee">
      <NativeSelect name="employee_id" className="w-full" required defaultValue="">
        <NativeSelectOption value="" disabled>Select employee</NativeSelectOption>
        {employees.map((employee) => <NativeSelectOption key={employee.id} value={employee.id}>{employee.full_name} ({employee.employee_no})</NativeSelectOption>)}
      </NativeSelect>
    </Field>
  );
}

export function Status({ children, attention = false }: { children: ReactNode; attention?: boolean }) {
  return <Badge variant={attention ? "destructive" : "outline"}>{children}</Badge>;
}
