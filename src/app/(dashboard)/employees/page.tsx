import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { hasPermission, requirePermission } from "@/modules/auth/session";
import { getPersonnelOverview } from "@/modules/personnel/queries";
import { filterPersonnel, formatPersonnelDate, personnelFilterLabel, personnelFilters, personnelMetrics, readPersonnelFilter, type PersonnelFilter } from "@/modules/personnel/rules";
import { Field, PersonnelHeading, Status } from "@/modules/personnel/ui";

export default async function EmployeesPage({ searchParams }: PageProps<"/employees">) {
  const session = await requirePermission("personnel.read");
  const [{ staff, context }, search] = await Promise.all([getPersonnelOverview(), searchParams]);
  const filter = readPersonnelFilter(typeof search.filter === "string" ? search.filter : undefined);
  const query = typeof search.q === "string" ? search.q.trim().slice(0, 160) : "";
  const normalized = query.toLocaleLowerCase("en-PH");
  const employees = filterPersonnel(staff, filter, context).filter((entry) =>
    [entry.full_name, entry.employee_no, entry.position].some((value) => value.toLocaleLowerCase("en-PH").includes(normalized)),
  );
  return (
    <div className="space-y-5">
      <PersonnelHeading title="Employees" actions={hasPermission(session, "personnel.write") &&
        <Button asChild><Link href="/employees/new">Add employee</Link></Button>} />
      <form className="grid items-end gap-3 sm:grid-cols-[minmax(0,24rem)_minmax(0,16rem)_1fr]">
        <Field label="Search employees"><Input variant="touch" type="search" name="q" defaultValue={query} placeholder="Name, employee ID or position" maxLength={160} /></Field>
        <Field label="Filter by">
          <NativeSelect name="filter" defaultValue={filter} size="touch" className="w-full">
            {(Object.keys(personnelFilters) as PersonnelFilter[]).map((key) => (
              <NativeSelectOption value={key} key={key}>{personnelFilterLabel(key, context)} ({filterPersonnel(staff, key, context).length})</NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Button type="submit" variant="outline" className="justify-self-end">Apply filters</Button>
      </form>
      <Card className="py-3">
        <CardContent className="px-2 sm:px-4">
          <Table className="caption-top">
            <caption className="border-b pb-3 text-left text-sm text-muted-foreground">{employees.length} matching {employees.length === 1 ? "employee" : "employees"}</caption>
            <TableHeader>
              <TableRow>{["Employee", "Status", "Age", "Years in service", "Next step", "201 file", "License"].map((label) => <TableHead key={label}>{label}</TableHead>)}</TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((employee) => {
                const metric = personnelMetrics(employee, context);
                return (
                  <TableRow key={employee.id}>
                    <TableCell><Link className="font-semibold underline-offset-4 hover:underline" href={`/employees/${employee.id}`}>{employee.full_name}</Link>
                      <span className="block text-xs text-muted-foreground">{employee.employee_no} · {employee.position}</span>
                      {employee.custody_quantity > 0 && <span className="block text-xs">{employee.custody_quantity} in property custody</span>}
                    </TableCell>
                    <TableCell><Status>{employee.employment_status}</Status></TableCell>
                    <TableCell className="tabular-nums">{metric.age ?? "—"}<span className="block text-xs text-muted-foreground">{formatPersonnelDate(metric.retirementDate)} retirement</span></TableCell>
                    <TableCell className="tabular-nums">{metric.yearsOfService ?? "—"}</TableCell>
                    <TableCell>{formatPersonnelDate(metric.eligibleOn)}<span className="block text-xs text-muted-foreground">{metric.stepStatus}</span></TableCell>
                    <TableCell className="tabular-nums">{employee.checklist_done}/{employee.checklist_total}<span className="block text-xs text-muted-foreground">{metric.checklistStatus}</span></TableCell>
                    <TableCell>{formatPersonnelDate(metric.licenseExpiry)}<span className="block text-xs text-muted-foreground">{metric.licenseStatus}</span></TableCell>
                  </TableRow>
                );
              })}
              {!employees.length && <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">No employees match. Try another search or filter.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
