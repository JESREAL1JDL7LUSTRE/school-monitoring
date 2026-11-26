"use client";

import { useState } from "react";
import { EditorCancel, RecordEditDialog, ReviewableForm, useRecordAction } from "@/components/record-editor";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { roleLabels, type Role } from "@/modules/auth/permissions";
import { saveStaffRole, type SettingsActionState } from "@/modules/settings/actions";

export function StaffAccessForm({ emails }: { emails: string[] }) {
  return <RecordEditDialog trigger="Change a role" description="Choose a staff account and the role to assign or remove. Other administrators manage their own roles." wide>
    <StaffRoleEditor emails={emails} />
  </RecordEditDialog>;
}

function StaffRoleEditor({ emails }: { emails: string[] }) {
  const [operation, setOperation] = useState<"grant" | "revoke">("grant");
  const [state, action, pending] = useRecordAction(saveStaffRole, {} as SettingsActionState, (result) => result.message);
  return (
    <ReviewableForm action={action} pending={pending} className="space-y-4" confirmation={(form) => {
      const remove = form.get("operation") === "revoke";
      const role = roleLabels[String(form.get("target_role")) as Role];
      const email = String(form.get("target_email")).trim();
      return {
        title: remove ? "Remove this staff role?" : "Assign this staff role?",
        description: remove ? `Remove the ${role} role from ${email}.` : `Assign the ${role} role to ${email}.`,
        label: remove ? "Remove role" : "Assign role",
        destructive: remove,
      };
    }}>
      {state.error && <Alert variant="destructive"><AlertDescription>{state.error}</AlertDescription></Alert>}
      {state.message && <Alert role="status"><AlertDescription>{state.message}</AlertDescription></Alert>}
      <fieldset disabled={pending} className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="target_email">Staff email</Label>
          <NativeSelect id="target_email" name="target_email" size="touch" className="w-full" defaultValue="" required>
            <NativeSelectOption value="" disabled>Choose a staff account</NativeSelectOption>
            {emails.map((email) => <NativeSelectOption key={email} value={email}>{email}</NativeSelectOption>)}
          </NativeSelect>
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
      </fieldset>
      <div className="flex flex-wrap justify-end gap-2">
        <EditorCancel disabled={pending} />
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Review change"}</Button>
      </div>
    </ReviewableForm>
  );
}
