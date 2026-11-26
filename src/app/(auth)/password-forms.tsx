"use client";

import { useActionState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updatePassword } from "@/modules/auth/password-actions";

export function UpdatePasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, {});
  return (
    <form action={action} className="space-y-4">
      {state.error && <Alert variant="destructive"><AlertDescription>{state.error}</AlertDescription></Alert>}
      <div className="grid gap-2">
        <Label htmlFor="new-password">New password</Label>
        <Input id="new-password" name="password" variant="touch" type="password" autoComplete="new-password"
          minLength={12} maxLength={72} aria-describedby="password-length" required />
        <p id="password-length" className="text-sm text-muted-foreground">Use at least 12 characters.</p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="confirm-password">Confirm new password</Label>
        <Input id="confirm-password" name="confirm-password" variant="touch" type="password" autoComplete="new-password"
          minLength={12} maxLength={72} required />
      </div>
      <Button type="submit" disabled={pending} className="min-h-11 w-full">{pending ? "Saving…" : "Save new password"}</Button>
    </form>
  );
}
