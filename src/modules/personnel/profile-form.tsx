import { Input } from "@/components/ui/input";
import { saveEmployee } from "./actions";
import { classifications, employmentStatuses, type Employee } from "./database";
import { OpeningEmployeeDates } from "./date-preview";
import { PersonnelForm } from "./form";
import type { PersonnelContext } from "./rules";
import { Choices, Field } from "./ui";

export function EmployeeForm(props: { employee: Employee; context?: never } | { employee?: never; context: PersonnelContext }) {
  const { employee, context } = props;
  return (
    <PersonnelForm action={saveEmployee} submit={employee ? "Save employee" : "Add employee"} confirmation={employee ? {
      title: "Save employee changes?",
      description: `Update the personnel profile for ${employee.full_name}.`,
      label: "Confirm save",
    } : undefined}>
      {employee && <><input type="hidden" name="id" value={employee.id} /><input type="hidden" name="version" value={employee.updated_at} /></>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Employee ID"><Input name="employee_no" defaultValue={employee?.employee_no} required maxLength={40} /></Field>
        <Field label="Full name"><Input name="full_name" defaultValue={employee?.full_name} required maxLength={180} /></Field>
        <Field label="Position"><Input name="position" defaultValue={employee?.position} required maxLength={150} /></Field>
        <Field label="Classification"><Choices name="classification" value={employee?.classification} values={classifications} /></Field>
        {employee ? <>
          <Field label="Employment status"><Choices name="employment_status" value={employee.employment_status} values={employmentStatuses} /></Field>
          <Field label="Birth date"><Input type="date" name="date_of_birth" defaultValue={employee.date_of_birth ?? ""} /></Field>
          <Field label="Hire date"><Input type="date" name="date_hired" defaultValue={employee.date_hired ?? ""} /></Field>
          <Field label="Last step date"><Input type="date" name="initial_step_date" defaultValue={employee.initial_step_date ?? ""} /></Field>
        </> : <OpeningEmployeeDates context={context} />}
        {!employee && <Field label="PRC license expiry (optional)"><Input type="date" name="license_expiry" /></Field>}
      </div>
      {!employee && (
        <details className="rounded-md border p-4">
          <summary className="cursor-pointer font-medium">Opening salary record (optional)</summary>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Salary grade"><Input type="number" name="grade" min={1} max={33} /></Field>
            <Field label="Step"><Input type="number" name="step" min={1} max={8} /></Field>
            <Field label="Monthly salary (₱)"><Input type="number" name="monthly_salary" step="0.01" min={0} /></Field>
            <Field label="Effective date"><Input type="date" name="effective_from" /></Field>
          </div>
        </details>
      )}
    </PersonnelForm>
  );
}
