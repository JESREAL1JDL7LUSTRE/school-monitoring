"use client";

import { useActionState, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { roleLabels } from "@/modules/auth/permissions";
import { saveStaffRole, type SettingsActionState } from "@/modules/settings/actions";

export const StaffAccessForm = () => {
  const [operation, setOperation] = useState<"grant" | "revoke">("grant");
  const [state, action, pending] = useActionState<SettingsActionState, FormData>(async (previous, form) => {
    const result = await saveStaffRole(previous, form);
    if (!result.error) setOperation("grant");
    return result;
  }, {});
  return (
    <Card>
      <CardHeader><CardTitle><h2>Change a role</h2></CardTitle></CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          {state.error && <Alert variant="destructive"><AlertDescription>{state.error}</AlertDescription></Alert>}
          {state.message && <Alert role="status"><AlertDescription>{state.message}</AlertDescription></Alert>}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="target_email">Staff email</Label>
              <Input variant="touch" id="target_email" name="target_email" type="email" autoComplete="off" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="target_role">Role</Label>
              <NativeSelect id="target_role" name="target_role" size="touch" className="w-full" defaultValue="" required>
                <NativeSelectOption value="" disabled>Choose a role</NativeSelectOption>
                {Object.entries(roleLabels).map(([role, label]) => <NativeSelectOption key={role} value={role}>{label}</NativeSelectOption>)}
              </NativeSelect>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="operation">Access change</Label>
              <NativeSelect id="operation" name="operation" size="touch" className="w-full" value={operation}
                onChange={(event) => setOperation(event.target.value === "revoke" ? "revoke" : "grant")}>
                <NativeSelectOption value="grant">Assign role</NativeSelectOption>
                <NativeSelectOption value="revoke">Remove role</NativeSelectOption>
              </NativeSelect>
            </div>
          </div>
          <Button type="submit" variant={operation === "revoke" ? "destructive" : "default"} disabled={pending} className="min-h-11">{pending ? "Saving…" : "Save staff access"}</Button>
        </form>
      </CardContent>
    </Card>
  );
};
