"use client";

import type { ComponentProps, ReactNode } from "react";
import { EditorCancel, ReviewableForm, useRecordAction, type SaveConfirmation } from "@/components/record-editor";
import { Button } from "@/components/ui/button";
import { personnelFormInitial, type PersonnelAction } from "./validation";

export function PersonnelForm({ action, children, submit, className, compact = false, submitVariant, confirmation }: {
  action: PersonnelAction;
  children: ReactNode;
  submit: string;
  className?: string;
  compact?: boolean;
  submitVariant?: ComponentProps<typeof Button>["variant"];
  confirmation?: SaveConfirmation;
}) {
  const [state, dispatch, pending] = useRecordAction(action, personnelFormInitial, (result) => result.ok ? result.message : undefined);

  return (
    <ReviewableForm action={dispatch} confirmation={confirmation} pending={pending} className={className}>
      <fieldset disabled={pending} className={compact ? "space-y-2" : "space-y-4"}>
        {children}
        <div className="flex flex-wrap gap-2">
          <Button size={compact ? "sm" : "default"} variant={submitVariant ?? (compact ? "outline" : "default")} type="submit">
            {pending ? "Saving…" : submit}
          </Button>
          <EditorCancel disabled={pending} />
        </div>
      </fieldset>
      <p className={`mt-1 min-h-5 text-xs ${state.ok ? "text-muted-foreground" : "text-destructive"}`} role={state.message && !state.ok ? "alert" : "status"}>
        {state.message}
      </p>
    </ReviewableForm>
  );
}
