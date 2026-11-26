import Link from "next/link";
import { Suspense } from "react";
import { DashboardLoading } from "@/components/dashboard-loading";
import { TablePageLinks, tablePage, tablePageSize } from "@/components/table-page-links";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { employeeReference } from "@/modules/personnel/employee-route";
import { EmployeePhoto } from "@/modules/personnel/employee-photo";
import { hasPermission, requirePermission } from "@/modules/auth/session";
import { getPersonnelPage } from "@/modules/personnel/queries";
import { formatPersonnelDate, personnelFilterLabel, personnelFilters, personnelMetrics, readPersonnelFilter, type PersonnelFilter } from "@/modules/personnel/rules";
import { Field, PersonnelHeading, Status } from "@/modules/personnel/ui";

export default async function EmployeesPage({ searchParams }: PageProps<"/employees">) {
  const [session, search] = await Promise.all([requirePermission("personnel.read"), searchParams]);
  const filter = readPersonnelFilter(typeof search.filter === "string" ? search.filter : undefined);
  const query = typeof search.q === "string" ? search.q.trim().slice(0, 160) : "";
  const page = tablePage(search.page);
  return <div className="space-y-5">
    <PersonnelHeading title="Employees" actions={hasPermission(session, "personnel.write") &&
      <Button asChild><Link href="/employees/new">Add employee</Link></Button>} />
    <Suspense key={JSON.stringify([filter, query, page])} fallback={<DashboardLoading filters />}>
      <EmployeeResults filter={filter} query={query} page={page} />
    </Suspense>
  </div>;
}

async function EmployeeResults({ filter, query, page }: { filter: PersonnelFilter; query: string; page: number }) {
  const { employees, context, total, facets } = await getPersonnelPage(filter, query, page, tablePageSize);
  const pageHref = (number: number) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (filter !== "all") params.set("filter", filter);
    if (number > 1) params.set("page", String(number));
    return params.size ? `/employees?${params}` : "/employees";
  };
  return (
    <>
      <Card className="py-4 sm:py-5">
        <CardContent className="px-4 sm:px-5">
          <form className="grid items-end gap-x-4 gap-y-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto]">
            <Field label="Search employees"><Input variant="touch" type="search" name="q" defaultValue={query} placeholder="Name, employee ID or position" maxLength={160} /></Field>
            <Field label="Filter by">
              <NativeSelect name="filter" defaultValue={filter} size="touch" className="w-full">
                {(Object.keys(personnelFilters) as PersonnelFilter[]).map((key) => (
                  <NativeSelectOption value={key} key={key}>{personnelFilterLabel(key, context)} ({facets[key] ?? 0})</NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Button type="submit" variant="outline" className="justify-self-end">Apply filters</Button>
          </form>
        </CardContent>
      </Card>
      <Card className="py-3">
        <CardContent className="px-2 sm:px-4">
          <Table className="caption-top">
            <caption className="border-b pb-3 text-left text-sm text-muted-foreground">{total} matching {total === 1 ? "employee" : "employees"}</caption>
            <TableHeader>
              <TableRow>{["Employee", "Status", "Age", "Years in service", "Next step", "201 file", "License"].map((label) => <TableHead key={label}>{label}</TableHead>)}</TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((employee) => {
                const metric = personnelMetrics(employee, context);
                return (
                  <TableRow key={employee.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <EmployeePhoto employee={employee} size={36} />
                        <div>
                          <Link className="font-semibold underline-offset-4 hover:underline" href={`/employees/${employeeReference(employee)}`}>{employee.full_name}</Link>
                          <span className="block text-xs text-muted-foreground">{employee.employee_no} · {employee.position}</span>
                          {employee.custody_quantity > 0 && <span className="block text-xs">{employee.custody_quantity} in property custody</span>}
                        </div>
                      </div>
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
          <TablePageLinks previous={page > 1 ? pageHref(Math.min(page - 1, Math.max(1, Math.ceil(total / tablePageSize)))) : undefined}
            next={page * tablePageSize < total ? pageHref(page + 1) : undefined}
            label={employees.length ? `Rows ${(page - 1) * tablePageSize + 1}–${(page - 1) * tablePageSize + employees.length} of ${total}` : `Page ${page}`} />
        </CardContent>
      </Card>
    </>
  );
}
