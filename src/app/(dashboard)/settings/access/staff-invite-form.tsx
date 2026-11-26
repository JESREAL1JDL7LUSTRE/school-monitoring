"use client";

import { useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { EditorCancel, RecordEditDialog, ReviewableForm, useRecordAction } from "@/components/record-editor";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { inviteStaff } from "@/modules/auth/invite-actions";
import { roleLabels, type Role } from "@/modules/auth/permissions";

export function StaffInviteForm() {
  return <RecordEditDialog trigger="Invite staff" description="Create a staff account and copy its sign-in details to share privately.">
    <InvitationEditor />
  </RecordEditDialog>;
}

function InvitationEditor() {
  const [state, action, pending] = useRecordAction(inviteStaff, {}, () => undefined);
  const [feedback, setFeedback] = useState("");
  const text = useRef<HTMLTextAreaElement>(null);
  if (state.credentials) {
    const { email, password } = state.credentials;
    const message = `Welcome to School Admin Desk! Sign in at ${window.location.origin}/login
Email: ${email}
Temporary password: ${password}`;
    async function copy() {
      try {
        await navigator.clipboard.writeText(message);
        setFeedback("Invitation copied.");
      } catch {
        text.current?.focus();
        text.current?.select();
        setFeedback("The message is selected. Use your device?s Copy command.");
      }
    }
    return <div className="grid gap-3">
      <Label htmlFor="manual-invite">Invitation message</Label>
      <Textarea id="manual-invite" ref={text} value={message} readOnly rows={5} />
      <p className="text-sm text-muted-foreground">Copy before closing. This password is shown once.</p>
      <div className="flex gap-2"><Button onClick={copy}>Copy invitation</Button><EditorCancel label="Done" /></div>
      <p role="status">{feedback}</p>
    </div>;
  }
  return (
    <ReviewableForm action={action} pending={pending} className="space-y-4" confirmation={(form) => ({
      title: "Create this account?",
      description: `Assign the ${roleLabels[String(form.get("role")) as Role]} role to ${String(form.get("email")).trim()} and generate a temporary password.`,
      label: "Create account",
    })}>
      {state.error && <Alert variant="destructive"><AlertDescription>{state.error}</AlertDescription></Alert>}
      <fieldset disabled={pending} className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="invite-email">Staff email</Label>
          <Input variant="touch" id="invite-email" name="email" type="email" maxLength={254} required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="invite-role">Role</Label>
          <NativeSelect id="invite-role" name="role" size="touch" className="w-full" defaultValue="" required>
            <NativeSelectOption value="" disabled>Choose a role</NativeSelectOption>
            {Object.entries(roleLabels).map(([role, label]) => <NativeSelectOption key={role} value={role}>{label}</NativeSelectOption>)}
          </NativeSelect>
        </div>
      </fieldset>
      <div className="flex flex-wrap justify-end gap-2">
        <EditorCancel disabled={pending} />
        <Button type="submit" disabled={pending}>{pending ? "Sending…" : "Review invitation"}</Button>
      </div>
    </ReviewableForm>
  );
}
