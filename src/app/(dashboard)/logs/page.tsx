import type { ReactNode } from "react";
import { Plus } from "lucide-react";
import { TablePageLinks } from "@/components/table-page-links";
import { WorkspaceNavigation } from "@/components/workspace-navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { hasPermission, requirePermission } from "@/modules/auth/session";
import { addConcern, updateConcern } from "@/modules/personnel/actions";
import { getAuditPage } from "@/modules/personnel/audit";
import { concernCategories, concernPriorities, concernStatuses } from "@/modules/personnel/database";
import { PersonnelForm } from "@/modules/personnel/form";
import { SalaryForm, SalaryTable } from "@/modules/personnel/history";
import { getConcerns, getPersonnelContext, getPersonnelDirectory, getSalaryHistory } from "@/modules/personnel/queries";
import { formatPersonnelDate } from "@/modules/personnel/rules";
import { Choices, EmployeePicker, Field, PersonnelHeading, Status } from "@/modules/personnel/ui";

function LogEntry({ label, children }: { label: string; children: ReactNode }) {
  return (
    <details className="group">
      <Button asChild variant="outline" className="cursor-pointer [&::-webkit-details-marker]:hidden">
        <summary className="list-none"><Plus aria-hidden />{label}</summary>
      </Button>
      <div className="mt-4 max-w-3xl border-b pb-5">{children}</div>
    </details>
  );
}

export default async function LogsPage({ searchParams }: PageProps<"/logs">) {
  const session = await requirePermission("personnel.read");
  const canEdit = hasPermission(session, "personnel.write");
  const canAudit = hasPermission(session, "audit.read");
  const search = await searchParams;
  const tab = search.view === "salary" ? "salary" : search.view === "audit" && canAudit ? "audit" : "concerns";
  const [staff, context, concerns, salaryHistory, audit] = await Promise.all([
    tab === "audit" ? [] : getPersonnelDirectory(false),
    tab === "salary" ? getPersonnelContext() : null,
    tab === "concerns" ? getConcerns() : [],
    tab === "salary" ? getSalaryHistory() : [],
    tab === "audit" ? getAuditPage(search) : null,
  ]);
  const active = staff.filter((employee) => !employee.archived_at);
  const names = new Map(staff.map((entry) => [entry.id, entry.full_name]));
  const tabs = [["concerns", "Concern logs"], ["salary", "Salary changes"], ...(canAudit ? [["audit", "Audit history"]] : [])];

  return (
    <div className="space-y-5">
      <PersonnelHeading title="Logs" />
      <Card className="gap-0 py-0">
        <WorkspaceNavigation label="Log views" className="px-2 sm:px-3" items={tabs.map(([key, label]) => ({
        href: `/logs?view=${key}`, active: key === tab, label,
        }))} />

        {tab === "concerns" && (
          <CardContent role="region" aria-label="Concern logs" className="space-y-4 px-2 py-4 sm:px-4">
            {canEdit && active.length > 0 && <LogEntry label="Record a concern">
              <PersonnelForm action={addConcern} submit="Save concern">
                <div className="grid gap-4 sm:grid-cols-2">
                  <EmployeePicker employees={active} />
                  <Field label="Category"><Choices name="category" values={concernCategories} /></Field>
                  <Field label="Priority"><Choices name="priority" values={concernPriorities} /></Field>
                  <Field label="Assigned to"><Input variant="touch" name="assigned_to" maxLength={180} /></Field>
                </div>
                <Field label="Details"><Textarea name="description" maxLength={2000} required /></Field>
              </PersonnelForm>
            </LogEntry>}
            <Table>
              <TableHeader><TableRow>{["Date", "Employee", "Concern", "Assigned to", "Priority", "Status", "Resolved on"].map((label) => <TableHead key={label}>{label}</TableHead>)}</TableRow></TableHeader>
              <TableBody>
                {concerns.map((concern) => <TableRow key={concern.id}>
                  <TableCell>{formatPersonnelDate(concern.created_at)}</TableCell>
                  <TableCell>{names.get(concern.employee_id) ?? "—"}</TableCell>
                  <TableCell className="max-w-sm whitespace-normal"><strong>{concern.category}</strong><div>{concern.description}</div></TableCell>
                  <TableCell>{concern.assigned_to || "—"}</TableCell>
                  <TableCell><Status attention={["High", "Urgent"].includes(concern.priority)}>{concern.priority}</Status></TableCell>
                  <TableCell className="min-w-44">{canEdit ? <PersonnelForm action={updateConcern} submit="Save concern status" compact>
                    <input type="hidden" name="id" value={concern.id} /><input type="hidden" name="version" value={concern.updated_at} />
                    <Choices name="status" label={`Status for ${concern.category} concern`} values={concernStatuses} value={concern.status} />
                  </PersonnelForm> : <Status>{concern.status}</Status>}</TableCell>
                  <TableCell>{formatPersonnelDate(concern.resolved_on)}</TableCell>
                </TableRow>)}
                {!concerns.length && <TableRow><TableCell colSpan={7} className="py-6 text-center text-muted-foreground">No concerns logged.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        )}
        {tab === "salary" && context && <CardContent role="region" aria-label="Salary changes" className="space-y-4 px-2 py-4 sm:px-4">
            {canEdit && active.length > 0 && <LogEntry label="Add salary change"><SalaryForm employees={active} asOf={context.asOf} /></LogEntry>}
            <SalaryTable rows={salaryHistory} staff={staff} asOf={context.asOf} />
        </CardContent>}
        {audit && <CardContent role="region" aria-label="Audit history" className="px-2 py-3 sm:px-4"><Table>
          <TableHeader><TableRow>{["Date", "Account", "Action", "Record type", "Record ID"].map((label) => <TableHead key={label}>{label}</TableHead>)}</TableRow></TableHeader>
          <TableBody>
            {audit.rows.map((entry) => <TableRow key={entry.id}><TableCell>{formatPersonnelDate(entry.created_at)}</TableCell>
              <TableCell className="text-xs">{entry.user_id ?? "System"}</TableCell><TableCell>{entry.action}</TableCell><TableCell>{entry.entity_type}</TableCell><TableCell className="text-xs">{entry.entity_id ?? "—"}</TableCell>
            </TableRow>)}
            {!audit.rows.length && <TableRow><TableCell colSpan={5} className="py-6 text-center text-muted-foreground">No audited changes on this page.</TableCell></TableRow>}
          </TableBody>
        </Table>
          <TablePageLinks previous={audit.previous} next={audit.next} label={`${audit.rows.length} audit records`} />
        </CardContent>}
      </Card>
    </div>
  );
}
