import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { getSession } from "@/modules/auth/session";
import { signOut } from "@/modules/auth/actions";
import { LoginForm } from "./login-form";

const LoginPage = async ({ searchParams }: PageProps<"/login">) => {
  const session = await getSession();
  if (session?.user.app_metadata.temporary_password === true) redirect("/reset-password");
  if (session?.roles.length) redirect("/");
  const passwordChanged = (await searchParams).password === "updated";

  return (
    <main className="grid min-h-dvh place-items-center bg-muted/40 px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle><h1 className="text-2xl font-semibold tracking-tight">School Admin Desk</h1></CardTitle>
          <CardDescription>Sign in with your individual school staff account.</CardDescription>
        </CardHeader>
        <CardContent>
          {!getSupabaseConfig() ? (
            <Alert><AlertDescription>Set the Supabase URL and publishable key in .env.local, then restart the app.</AlertDescription></Alert>
          ) : session ? (
            <div className="space-y-5">
              <Alert><AlertDescription>Your account is signed in. Ask your administrator to assign a school role.</AlertDescription></Alert>
              <form action={signOut}><Button type="submit" variant="outline">Sign out</Button></form>
            </div>
          ) : (
            <div className="space-y-3">
              {passwordChanged && <Alert role="status"><AlertDescription>Password updated. Sign in with your new password.</AlertDescription></Alert>}
              <LoginForm />
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
};

export default LoginPage;
