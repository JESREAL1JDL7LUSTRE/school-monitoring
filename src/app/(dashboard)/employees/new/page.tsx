import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requirePermission } from "@/modules/auth/session";
import { EmployeeForm } from "@/modules/personnel/profile-form";
import { getPersonnelContext } from "@/modules/personnel/queries";
import { PersonnelHeading } from "@/modules/personnel/ui";

export default async function NewEmployeePage() {
  await requirePermission("personnel.write");
  const context = await getPersonnelContext();
  return (
    <>
      <PersonnelHeading title="Add employee" actions={<Button asChild variant="outline"><Link href="/employees">Back to employees</Link></Button>}>
        Create the employee’s master record. Dates, salary and licenses can also be recorded after the profile is created.
      </PersonnelHeading>
      <Card className="max-w-4xl"><CardContent><EmployeeForm context={context} /></CardContent></Card>
    </>
  );
}
