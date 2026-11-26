import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { roleLabels } from "@/modules/auth/permissions";
import { requirePermission } from "@/modules/auth/session";
import { getStaffRoles } from "@/modules/settings/queries";
import { SettingsNavigation } from "../settings-navigation";
import { StaffAccessForm } from "./staff-access-form";
import { StaffInviteForm } from "./staff-invite-form";

const StaffAccessPage = async () => {
  const [session, accounts] = await Promise.all([requirePermission("settings.write"), getStaffRoles()]);
  const editableEmails = accounts.filter(({ email, roles }) => !roles.includes("admin") || email.toLowerCase() === session.user.email?.toLowerCase()).map(({ email }) => email);
  return (
    <div className="max-w-4xl space-y-6">
      <header className="space-y-2">
        <h1 className="desk-heading">Staff access</h1>
      </header>
      <SettingsNavigation />
      <div className="flex flex-wrap items-start gap-3"><StaffInviteForm /><StaffAccessForm emails={editableEmails} /></div>
      <Card>
        <CardHeader><CardTitle><h2>Staff accounts</h2></CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead scope="col">Email</TableHead><TableHead scope="col">Roles</TableHead></TableRow></TableHeader>
            <TableBody>
              {accounts.map((account) => (
                <TableRow key={account.email}>
                  <TableCell>{account.email}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1.5">
                      {account.roles.length ? account.roles.map((role) => <Badge key={role} variant="secondary">{role === "admin" && account.is_super_admin ? "Super administrator" : roleLabels[role]}</Badge>) : "Pending role"}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default StaffAccessPage;
