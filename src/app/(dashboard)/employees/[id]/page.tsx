import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { hasPermission, requirePermission } from "@/modules/auth/session";
import { changeArchive } from "@/modules/personnel/actions";
import { Checklist } from "@/modules/personnel/checklist";
import { PersonnelForm } from "@/modules/personnel/form";
import { LicenseHistory, SalaryForm, SalaryTable } from "@/modules/personnel/history";
import { EmployeeForm } from "@/modules/personnel/profile-form";
import { getEmployeeProfile } from "@/modules/personnel/queries";
import { formatPersonnelDate, formatSalary, personnelMetrics } from "@/modules/personnel/rules";
import { PersonnelHeading, Status } from "@/modules/personnel/ui";

export default async function EmployeePage({ params }: PageProps<"/employees/[id]">) {
  const session = await requirePermission("personnel.read");
  const { id } = await params;
  const profile = await getEmployeeProfile(id);
  const { employee, context, licenses, salaryHistory, nosiHistory, custody } = profile;
  const canWrite = hasPermission(session, "personnel.write");
  const canEdit = canWrite && !employee.archived_at;
  const canUpload = hasPermission(session, "files.write") && !employee.archived_at;
  const metric = personnelMetrics(employee, context);
  const stats = [
    ["Age", metric.age ?? "—"],
    ["Years in service", metric.yearsOfService ?? "—"],
    ["Next step date", formatPersonnelDate(metric.eligibleOn), metric.stepStatus],
    ["Retirement date", formatPersonnelDate(metric.retirementDate), metric.retirementStatus],
    ["Loyalty milestone", formatPersonnelDate(metric.loyaltyDate)],
    ["Monthly salary", formatSalary(employee.current_salary?.monthly_salary ?? null)],
  ];
  return (
    <div className="space-y-5">
      <PersonnelHeading title={employee.full_name} actions={<Button asChild variant="outline"><Link href="/employees">Back to employees</Link></Button>}>
        {employee.employee_no} · {employee.position} · {employee.classification} · {employee.employment_status}
      </PersonnelHeading>
      {employee.archived_at && <Status>Archived employee</Status>}
      <Card>
        <CardHeader><CardTitle>Employee profile</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <nav aria-label="Profile sections" className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <a className="py-2 underline underline-offset-4" href="#checklist">201 checklist</a>
            <a className="py-2 underline underline-offset-4" href="#licenses">Licenses</a>
            <a className="py-2 underline underline-offset-4" href="#salary-history">Salary and step history</a>
            <a className="py-2 underline underline-offset-4" href="#custody">Property custody</a>
          </nav>
          <dl className="grid gap-4 rounded-md border p-4 sm:grid-cols-2 lg:grid-cols-3">
            {stats.map(([term, value, description]) => <div key={term}><dt className="text-xs text-muted-foreground">{term}</dt>
              <dd className="text-lg font-semibold tabular-nums">{value}</dd>{description && <dd className="text-sm">{description}</dd>}
            </div>)}
          </dl>
          <p className="text-sm text-muted-foreground">Step, retirement, and loyalty dates use the school’s draft rules.</p>
          {canEdit && <details className="rounded-md border p-4"><summary className="mb-3 cursor-pointer font-medium">Edit profile</summary><EmployeeForm employee={employee} /></details>}
          {canWrite && (
            <details className="rounded-md border p-4">
              <summary className="mb-3 cursor-pointer text-sm font-medium">{employee.archived_at ? "Restore archived record" : "Archive employee record"}</summary>
              <PersonnelForm action={changeArchive} submit={employee.archived_at ? "Restore employee" : "Archive employee"}>
                <input type="hidden" name="employee_id" value={id} /><input type="hidden" name="version" value={employee.updated_at} />
                <input type="hidden" name="operation" value={employee.archived_at ? "restore" : "archive"} />
                <p className="text-sm text-muted-foreground">{employee.archived_at ? "Restoring returns this record to active lists." : "Archiving removes the employee from active lists and preserves personnel and property records."}</p>
              </PersonnelForm>
            </details>
          )}
        </CardContent>
      </Card>
      <Checklist profile={profile} canEdit={canEdit} canUpload={canUpload} />
      <LicenseHistory employeeId={id} licenses={licenses} canEdit={canEdit} />
      <Card id="salary-history">
        <CardHeader><CardTitle>Salary and step history</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <SalaryTable rows={salaryHistory} asOf={context.asOf} />
          {canEdit && <details className="rounded-md border p-4"><summary className="mb-3 cursor-pointer font-medium">Add a salary change</summary><SalaryForm employeeId={id} asOf={context.asOf} /></details>}
          {nosiHistory.length > 0 && <ul className="space-y-1 text-sm">{nosiHistory.map((entry) => <li key={entry.id}>NOSI due {formatPersonnelDate(entry.eligibility_date)} · {entry.status}</li>)}</ul>}
        </CardContent>
      </Card>
      <Card id="custody">
        <CardHeader><CardTitle>Property custody</CardTitle></CardHeader>
        <CardContent>
          {custody.length ? <ul className="space-y-2 text-sm">{custody.map((item) => <li key={`${item.document_no}/${item.item_code}`}>
            <strong>{item.item_name}</strong> · {item.item_code} · {item.document_no} · {item.outstanding} outstanding
          </li>)}</ul> : <p className="text-sm text-muted-foreground">No outstanding property custody.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
