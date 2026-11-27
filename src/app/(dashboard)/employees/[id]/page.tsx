import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { RecordEditDialog } from "@/components/record-editor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { withRouteQuery } from "@/lib/record-slug";
import { hasPermission, requirePermission } from "@/modules/auth/session";
import { changeArchive } from "@/modules/personnel/actions";
import { Checklist } from "@/modules/personnel/checklist";
import { employeeReference } from "@/modules/personnel/employee-route";
import { PersonnelForm } from "@/modules/personnel/form";
import { LicenseHistory, SalaryForm, SalaryTable } from "@/modules/personnel/history";
import { EmployeeForm } from "@/modules/personnel/profile-form";
import { EmployeePhoto } from "@/modules/personnel/employee-photo";
import { getEmployeeByReference, getEmployeeProfile } from "@/modules/personnel/queries";
import { formatPersonnelDate, formatSalary, personnelMetrics } from "@/modules/personnel/rules";
import { PersonnelHeading, Status } from "@/modules/personnel/ui";

export default async function EmployeePage({ params, searchParams }: PageProps<"/employees/[id]">) {
  const session = await requirePermission("personnel.read");
  const { id: reference } = await params;
  const record = await getEmployeeByReference(reference);
  if (!record) notFound();
  const { id } = record;
  const canonical = employeeReference(record);
  if (reference !== canonical) redirect(withRouteQuery(`/employees/${canonical}`, await searchParams));
  const profile = await getEmployeeProfile(record);
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
      <PersonnelHeading title={employee.full_name} avatar={<EmployeePhoto employee={employee} size={80} />}
        actions={<Button asChild variant="outline"><Link href="/employees">Back to employees</Link></Button>}>
        {employee.employee_no} · {employee.position} · {employee.classification} · {employee.employment_status}
      </PersonnelHeading>
      {employee.archived_at && <Status>Archived employee</Status>}
      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>Employee profile</CardTitle>
            <p className="break-all text-sm text-muted-foreground">Entered by {employee.entered_by_email ?? "Unrecorded"}</p>
          </div>
          {canEdit && <RecordEditDialog trigger="Edit profile" description={employee.full_name} wide>
            <EmployeeForm employee={employee} />
          </RecordEditDialog>}
        </CardHeader>
        <CardContent className="space-y-4">
          {!employee.photo_id && (await searchParams).photo === "retry" && <p role="alert">Employee created. Open Edit profile to retry the photo upload.</p>}
          {!canWrite && <p className="text-sm text-muted-foreground print:hidden">Your role has view-only access to employee profiles. An administrator can change your access.</p>}
          {canWrite && employee.archived_at && <p className="text-sm text-muted-foreground print:hidden">Restore this employee to edit the profile and photo.</p>}
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
          {canWrite && <div className="flex flex-wrap items-start gap-3 print:hidden">
            <PersonnelForm action={changeArchive} submitVariant="outline" submit={employee.archived_at ? "Restore employee" : "Archive employee"}
              confirmation={employee.archived_at ? {
                title: "Restore employee?", description: `${employee.full_name} will return to active employee lists.`, label: "Restore employee",
              } : {
                title: "Archive employee?", description: `${employee.full_name} will leave active lists. Personnel and property history will be retained.`,
                label: "Archive employee", destructive: true,
              }}>
              <input type="hidden" name="employee_id" value={id} /><input type="hidden" name="version" value={employee.updated_at} />
              <input type="hidden" name="operation" value={employee.archived_at ? "restore" : "archive"} />
            </PersonnelForm>
          </div>}
        </CardContent>
      </Card>
      <Checklist profile={profile} canEdit={canEdit} canUpload={canUpload} />
      <LicenseHistory employeeId={id} licenses={licenses} canEdit={canEdit} />
      <Card id="salary-history">
        <CardHeader><CardTitle>Salary and step history</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <SalaryTable rows={salaryHistory} asOf={context.asOf} />
          {canEdit && <p className="text-sm text-muted-foreground">To update salary or step, add a change with its effective date. Earlier entries are kept for the record.</p>}
          {canEdit && <RecordEditDialog trigger="Add a salary change" description={employee.full_name} wide>
            <SalaryForm employeeId={id} asOf={context.asOf} />
          </RecordEditDialog>}
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
