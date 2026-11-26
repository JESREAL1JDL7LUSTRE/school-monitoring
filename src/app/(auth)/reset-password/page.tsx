import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { signOut } from "@/modules/auth/actions";
import { getSession } from "@/modules/auth/session";
import { PasswordCard } from "../password-card";
import { UpdatePasswordForm } from "../password-forms";

export default async function ResetPasswordPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const temporary = session.user.app_metadata.temporary_password === true;
  return (
    <PasswordCard title="Set a new password"
      description={temporary ? "Replace your temporary password to open the school workspace." : "Choose a new password for your staff account."}>
      <UpdatePasswordForm />
      {temporary || !session.roles.length ? (
        <form action={signOut}><Button type="submit" variant="outline" className="min-h-11 w-full">Sign out</Button></form>
      ) : (
        <Button asChild variant="outline" className="min-h-11 w-full"><Link href="/">Back to workspace</Link></Button>
      )}
    </PasswordCard>
  );
}
