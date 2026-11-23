import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { hasPermission, requirePermission } from "@/modules/auth/session";
import { getLeavePage } from "@/modules/personnel/leave-queries";
import { formatPersonnelDate } from "@/modules/personnel/rules";
import { PersonnelHeading } from "@/modules/personnel/ui";

export default async function LeaveRecordsPage({ searchParams }: PageProps<"/leaves">) {
  const [session, { page, saved }] = await Promise.all([requirePermission("personnel.read"), searchParams]);
  const canWrite = hasPermission(session, "personnel.write");
  const requestedPage = typeof page === "string" && /^\d{1,6}$/.test(page) ? Math.max(1, Number(page)) : 1;
  const { records, totalPages } = await getLeavePage(requestedPage);
  if (requestedPage > totalPages) redirect("/leaves");

  return (
    <>
      <PersonnelHeading title="Leave records" actions={canWrite && (
        <Button asChild className="min-h-11"><Link href="/leaves/new"><Plus aria-hidden /> Add leave record</Link></Button>
      )} />
      <div className="space-y-4">
        {saved === "1" && <Alert role="status"><AlertDescription>Leave record saved.</AlertDescription></Alert>}
        <Card>
          <CardContent>
            {records.length ? (
              <Table aria-label="Employee leave records">
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">Employee</TableHead>
                    <TableHead scope="col">Leave type</TableHead>
                    <TableHead scope="col">Start date</TableHead>
                    <TableHead scope="col">End date</TableHead>
                    {canWrite && <TableHead scope="col"><span className="sr-only">Actions</span></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>
                        <p className="font-medium">{record.employees?.full_name ?? "Employee unavailable"}</p>
                        <p className="text-xs text-muted-foreground">{record.employees?.employee_no}</p>
                      </TableCell>
                      <TableCell className="min-w-28 whitespace-normal">{record.leave_type}</TableCell>
                      <TableCell className="tabular-nums">{formatPersonnelDate(record.start_date)}</TableCell>
                      <TableCell className="tabular-nums">{formatPersonnelDate(record.end_date)}</TableCell>
                      {canWrite && <TableCell className="text-right">
                        <Button asChild variant="ghost" className="min-h-11">
                          <Link href={`/leaves/${record.id}`} aria-label={`Edit leave for ${record.employees?.full_name ?? "employee"} starting ${formatPersonnelDate(record.start_date)}`}>Edit</Link>
                        </Button>
                      </TableCell>}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : <p className="text-sm text-muted-foreground">No leave records yet.</p>}
          </CardContent>
        </Card>
        {totalPages > 1 && <nav aria-label="Leave records pagination" className="flex flex-wrap items-center gap-3">
          {requestedPage > 1 && <Button asChild variant="outline" className="min-h-11">
            <Link href={`/leaves?page=${requestedPage - 1}`}>Previous</Link>
          </Button>}
          <p className="text-sm text-muted-foreground tabular-nums">Page {requestedPage} of {totalPages}</p>
          {requestedPage < totalPages && <Button asChild variant="outline" className="min-h-11">
            <Link href={`/leaves?page=${requestedPage + 1}`}>Next</Link>
          </Button>}
        </nav>}
      </div>
    </>
  );
}
