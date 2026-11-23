import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requirePermission } from "@/modules/auth/session";
import { LeaveForm } from "@/modules/personnel/leave-form";
import { leaveRecordId } from "@/modules/personnel/leave-input";
import { getLeaveRecord } from "@/modules/personnel/leave-queries";
import { getPersonnelDirectory } from "@/modules/personnel/queries";
import { PersonnelHeading } from "@/modules/personnel/ui";

export default async function LeaveEditorPage({ params }: PageProps<"/leaves/[id]">) {
  const [{ id }] = await Promise.all([params, requirePermission("personnel.write")]);
  const editing = id !== "new";
  if (editing && !leaveRecordId.safeParse(id).success) notFound();
  const record = editing ? await getLeaveRecord(id) : null;
  if (editing && !record) notFound();
  const employees = record ? [] : (await getPersonnelDirectory()).map((employee) => ({
    id: employee.id,
    label: `${employee.full_name} · ${employee.employee_no}`,
  }));

  return (
    <>
      <PersonnelHeading title={record ? "Edit leave record" : "Add leave record"}
        actions={<Button asChild variant="outline" className="min-h-11"><Link href="/leaves">Back to leave records</Link></Button>}>
        {record?.employees && `${record.employees.full_name} · ${record.employees.employee_no}`}
      </PersonnelHeading>
      <Card className="max-w-2xl">
        <CardContent>
          {record || employees.length ? <LeaveForm record={record ?? undefined} employees={employees} /> : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Add an active employee before recording leave.</p>
              <Button asChild className="min-h-11"><Link href="/employees/new">Add employee</Link></Button>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
