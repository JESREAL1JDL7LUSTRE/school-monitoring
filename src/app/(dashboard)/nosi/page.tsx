import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { hasPermission, requirePermission } from "@/modules/auth/session";
import { saveNosi } from "@/modules/personnel/actions";
import { nosiStatuses } from "@/modules/personnel/database";
import { PersonnelForm } from "@/modules/personnel/form";
import { getPersonnelOverview } from "@/modules/personnel/queries";
import { formatPersonnelDate, formatSalary, matchesPersonnelFilter, personnelMetrics } from "@/modules/personnel/rules";
import { Choices, PersonnelHeading, Status } from "@/modules/personnel/ui";

export default async function NosiPage() {
  const session = await requirePermission("personnel.read");
  const { staff, context } = await getPersonnelOverview();
  const canEdit = hasPermission(session, "personnel.write");
  const rows = staff.filter((employee) => (["over", "ny", "upd"] as const).some((filter) =>
    matchesPersonnelFilter(employee, filter, context),
  )).map((employee) => ({ employee, metric: personnelMetrics(employee, context) }))
    .sort((a, b) => (a.metric.eligibleOn ?? "").localeCompare(b.metric.eligibleOn ?? ""));

  return (
    <div className="space-y-5">
      <PersonnelHeading title="Notice of Step Increment (NOSI)" />
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {nosiStatuses.map((status) => <div key={status} className="rounded-md border bg-card p-4">
          <dt className="text-xs text-muted-foreground">{status}</dt><dd className="text-2xl font-semibold tabular-nums">{rows.filter(({ employee }) => employee.nosi_status === status).length}</dd>
        </div>)}
      </dl>
      <Card><CardContent><Table>
        <TableHeader><TableRow>{["Employee", "Current salary", "Last step date", "Eligible on", "Draft estimate", "Progress", "Document"].map((title) => <TableHead key={title}>{title}</TableHead>)}</TableRow></TableHeader>
        <TableBody>
          {rows.map(({ employee, metric }) => (
            <TableRow key={employee.id}>
              <TableCell><Link className="font-medium underline-offset-4 hover:underline" href={`/employees/${employee.id}`}>{employee.full_name}</Link><span className="block text-xs text-muted-foreground">{employee.position}</span></TableCell>
              <TableCell>{formatSalary(employee.current_salary?.monthly_salary ?? null)}{employee.current_salary && <span className="block text-xs">SG {employee.current_salary.grade} · Step {employee.current_salary.step}</span>}</TableCell>
              <TableCell>{formatPersonnelDate(employee.step_date)}</TableCell>
              <TableCell>{formatPersonnelDate(metric.eligibleOn)}<span className="block text-xs">{metric.stepStatus}</span></TableCell>
              <TableCell>{formatSalary(metric.estimatedSalary)}</TableCell>
              <TableCell className="min-w-52">
                {canEdit && employee.step_date ? <PersonnelForm action={saveNosi} submit="Save NOSI status" compact>
                  <input type="hidden" name="employee_id" value={employee.id} />
                  <input type="hidden" name="previous_step_date" value={employee.step_date} />
                  <input type="hidden" name="version" value={employee.nosi_updated_at ?? ""} />
                  <Choices label={`NOSI status for ${employee.full_name}`} name="status" values={nosiStatuses} value={employee.nosi_status} />
                </PersonnelForm> : <Status>{employee.nosi_status}</Status>}
              </TableCell>
              <TableCell><Button variant="outline" asChild><Link href={`/forms?template=nosi&employee=${employee.id}`}>Print NOSI</Link></Button></TableCell>
            </TableRow>
          ))}
          {!rows.length && <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">No step increments are due or in progress.</TableCell></TableRow>}
        </TableBody>
      </Table></CardContent></Card>
    </div>
  );
}
