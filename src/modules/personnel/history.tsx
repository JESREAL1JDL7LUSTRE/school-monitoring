import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { appendSalary, saveLicense } from "./actions";
import type { Employee, EmployeeLicense, SalaryRecord } from "./database";
import { PersonnelForm } from "./form";
import { Choices, EmployeePicker, Field, Status } from "./ui";
import { formatPersonnelDate, formatSalary } from "./rules";

function LicenseForm({ employeeId, license }: { employeeId: string; license?: EmployeeLicense }) {
  return (
    <PersonnelForm action={saveLicense} submit={license ? "Save license" : "Add license"}>
      <input name="employee_id" type="hidden" value={employeeId} />
      {license && <><input name="license_id" type="hidden" value={license.id} /><input name="version" type="hidden" value={license.updated_at} /></>}
      {!license && <input type="hidden" name="is_active" value="true" />}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="License type"><Input name="license_type" defaultValue={license?.license_type ?? "PRC"} required maxLength={80} /></Field>
        <Field label="License number"><Input name="license_number" defaultValue={license?.license_number} maxLength={100} /></Field>
        <Field label="Expiry date"><Input name="expiry_date" type="date" defaultValue={license?.expiry_date} required /></Field>
        {license && <Field label="Active license"><Choices name="is_active" values={["true", "false"]} value={String(license.is_active)} /></Field>}
      </div>
    </PersonnelForm>
  );
}

export function LicenseHistory({ employeeId, licenses, canEdit }: { employeeId: string; licenses: EmployeeLicense[]; canEdit: boolean }) {
  return (
    <Card id="licenses">
      <CardHeader><CardTitle>Licenses</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {licenses.length === 0 && <p className="text-sm text-muted-foreground">No licenses recorded.</p>}
        <ul className="space-y-3">
          {licenses.map((license) => (
            <li key={license.id} className="rounded-md border p-3">
              <p className="flex flex-wrap items-center gap-2 text-sm"><strong>{license.license_type}</strong> {license.license_number} · Expires {formatPersonnelDate(license.expiry_date)}
                <Status>{license.is_active ? "Active" : "Inactive"}</Status>
              </p>
              {canEdit && <details className="mt-2"><summary className="mb-3 cursor-pointer text-sm">Edit {license.license_type} license</summary><LicenseForm employeeId={employeeId} license={license} /></details>}
            </li>
          ))}
        </ul>
        {canEdit && <details className="rounded-md border p-4"><summary className="mb-3 cursor-pointer text-sm font-medium">Add a license</summary><LicenseForm employeeId={employeeId} /></details>}
      </CardContent>
    </Card>
  );
}

export function SalaryForm({ employeeId, employees, asOf }: { employeeId?: string; employees?: Pick<Employee, "id" | "full_name" | "employee_no">[]; asOf: string }) {
  return (
    <PersonnelForm action={appendSalary} submit="Record salary change">
      {employeeId ? <input name="employee_id" type="hidden" value={employeeId} /> : <EmployeePicker employees={employees ?? []} />}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Salary grade"><Input name="grade" type="number" min={1} max={33} required /></Field>
        <Field label="Step"><Input name="step" type="number" min={1} max={8} required /></Field>
        <Field label="Monthly salary (₱)"><Input name="monthly_salary" type="number" min={0} step="0.01" required /></Field>
        <Field label="Effective date"><Input name="effective_from" type="date" defaultValue={asOf} required /></Field>
        <Field label="Reference or order number"><Input name="reference_no" maxLength={100} /></Field>
        <Field label="Reason"><Input name="reason" placeholder="Step increment, promotion, reclassification" required maxLength={300} /></Field>
      </div>
      <label className="flex items-center gap-2 text-sm"><Input className="size-4" type="checkbox" name="resets_step_date" /> Use this effective date to start a new step cycle</label>
    </PersonnelForm>
  );
}

export function SalaryTable({ rows, staff, asOf }: { rows: SalaryRecord[]; staff?: Pick<Employee, "id" | "full_name">[]; asOf: string }) {
  const names = new Map(staff?.map((employee) => [employee.id, employee.full_name]));
  const recordsByEmployee = new Map<string, SalaryRecord>();
  const previousByRecord = new Map<string, SalaryRecord>();
  for (const entry of [...rows].reverse()) {
    const earlier = recordsByEmployee.get(entry.employee_id);
    if (earlier) previousByRecord.set(entry.id, earlier);
    recordsByEmployee.set(entry.employee_id, entry);
  }
  return (
    <Table>
      <TableHeader><TableRow>
        {staff && <TableHead>Employee</TableHead>}
        {["Effective date", "Salary grade / step", "Monthly salary", "Reason", "Reference", "Recorded by"].map((column) => <TableHead key={column}>{column}</TableHead>)}
      </TableRow></TableHeader>
      <TableBody>
        {rows.map((entry) => {
          const previous = previousByRecord.get(entry.id);
          return (
            <TableRow key={entry.id}>
              {staff && <TableCell>{names.get(entry.employee_id) ?? "—"}</TableCell>}
              <TableCell>{formatPersonnelDate(entry.effective_from)}{entry.effective_from > asOf && <span className="block text-xs text-muted-foreground">Scheduled</span>}</TableCell>
              <TableCell className="tabular-nums">{entry.grade} / {entry.step}{previous && <span className="block text-xs text-muted-foreground">From {previous.grade} / {previous.step}</span>}</TableCell>
              <TableCell className="tabular-nums">{formatSalary(entry.monthly_salary)}</TableCell>
              <TableCell>{entry.reason}{entry.resets_step_date && <span className="block text-xs text-muted-foreground">Starts new step cycle</span>}</TableCell>
              <TableCell>{entry.reference_no || "—"}</TableCell>
              <TableCell className="text-xs">{entry.recorded_by ?? "—"}</TableCell>
            </TableRow>
          );
        })}
        {!rows.length && <TableRow><TableCell colSpan={staff ? 7 : 6} className="py-6 text-center text-muted-foreground">No salary changes recorded.</TableCell></TableRow>}
      </TableBody>
    </Table>
  );
}
