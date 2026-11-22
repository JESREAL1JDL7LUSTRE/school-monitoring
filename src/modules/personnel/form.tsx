"use client";

import { startTransition, useActionState, type ComponentProps, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { personnelFormInitial, type PersonnelAction } from "./validation";

export function PersonnelForm({ action, children, submit, className, compact = false, submitVariant }: {
  action: PersonnelAction;
  children: ReactNode;
  submit: string;
  className?: string;
  compact?: boolean;
  submitVariant?: ComponentProps<typeof Button>["variant"];
}) {
  const [state, dispatch, pending] = useActionState(action, personnelFormInitial);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    startTransition(() => dispatch(values));
  }

  return (
    <form action={dispatch} onSubmit={handleSubmit} className={className}>
      <fieldset disabled={pending} className={compact ? "space-y-2" : "space-y-4"}>
        {children}
        <Button size={compact ? "sm" : "default"} variant={submitVariant ?? (compact ? "outline" : "default")} type="submit">
          {pending ? "Saving…" : submit}
        </Button>
      </fieldset>
      <p className={`mt-1 min-h-5 text-xs ${state.ok ? "text-muted-foreground" : "text-destructive"}`} role={state.message && !state.ok ? "alert" : "status"}>
        {state.message}
      </p>
    </form>
  );
}
