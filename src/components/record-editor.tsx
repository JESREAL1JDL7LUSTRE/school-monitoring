"use client";

import { createContext, startTransition, useActionState, useContext, useRef, useState } from "react";
import type { ComponentProps, FormEvent, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

type Editor = { setSaving: (saving: boolean) => void; finish: (message: string) => void; cancel: () => void };
const EditorContext = createContext<Editor | null>(null);

export function RecordEditDialog({ trigger, title = trigger, description, wide = false, children }: {
  trigger: string;
  title?: string;
  description: string;
  wide?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const saving = useRef(false);
  const editor: Editor = {
    setSaving: (value) => { saving.current = value; },
    finish: (value) => { setMessage(value); setOpen(false); },
    cancel: () => { if (!saving.current) setOpen(false); },
  };

  return <div className="print:hidden">
    <Dialog open={open} onOpenChange={(next) => {
      if (!next && saving.current) return;
      if (next) setMessage("");
      setOpen(next);
    }}>
      <DialogTrigger asChild><Button type="button" variant="outline" className="h-auto min-h-11 whitespace-normal text-left">{trigger}</Button></DialogTrigger>
      <DialogContent showCloseButton={false}
        className={cn("max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain", wide && "sm:max-w-2xl")}
        onInteractOutside={(event) => event.preventDefault()}>
        <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
        <EditorContext.Provider value={editor}>{children}</EditorContext.Provider>
      </DialogContent>
    </Dialog>
    <p role="status" className={message ? "mt-2 text-sm text-muted-foreground" : "sr-only"}>{message}</p>
  </div>;
}

export function EditorCancel({ disabled, label = "Cancel" }: { disabled?: boolean; label?: string }) {
  const editor = useContext(EditorContext);
  return editor && <Button type="button" variant="outline" disabled={disabled} onClick={editor.cancel}>{label}</Button>;
}

export function useRecordAction<State>(
  action: (previous: Awaited<State>, form: FormData) => State | Promise<State>,
  initialState: Awaited<State>,
  savedMessage: (state: Awaited<State>) => string | undefined,
) {
  const editor = useContext(EditorContext);
  return useActionState<State, FormData>(editor ? async (previous, form) => {
    editor.setSaving(true);
    try {
      const result = await action(previous, form);
      const message = savedMessage(result);
      if (message) editor.finish(message);
      return result;
    } finally {
      editor.setSaving(false);
    }
  } : action, initialState);
}

export type SaveConfirmation = { title: string; description: string; label: string; destructive?: boolean };
type ReviewableFormProps = Omit<ComponentProps<"form">, "action" | "onSubmit"> & {
  action: (data: FormData) => void;
  confirmation?: SaveConfirmation | ((form: FormData) => SaveConfirmation);
  pending?: boolean;
};

export function ReviewableForm({ action, confirmation, pending, ...props }: ReviewableFormProps) {
  const [review, setReview] = useState<{ fields: FormData; content: SaveConfirmation } | null>(null);
  const submitter = useRef<HTMLElement | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || review) return;
    submitter.current = (event.nativeEvent as SubmitEvent).submitter;
    const fields = new FormData(event.currentTarget, submitter.current);
    if (!confirmation) {
      startTransition(() => action(fields));
      return;
    }
    setReview({ fields, content: typeof confirmation === "function" ? confirmation(fields) : confirmation });
  }

  return <>
    <form action={action} onSubmit={handleSubmit} {...props} />
    {confirmation && <AlertDialog open={review !== null} onOpenChange={(next) => { if (!next) setReview(null); }}>
      <AlertDialogContent onCloseAutoFocus={(event) => {
        event.preventDefault();
        submitter.current?.focus({ preventScroll: true });
      }}>
        <AlertDialogHeader>
          <AlertDialogTitle>{review?.content.title}</AlertDialogTitle>
          <AlertDialogDescription>{review?.content.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel type="button">Go back</AlertDialogCancel>
          <AlertDialogAction type="button" variant={review?.content.destructive ? "destructive" : "default"} onClick={() => {
            if (!review || pending) return;
            setReview(null);
            startTransition(() => action(review.fields));
          }}>{review?.content.label}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>}
  </>;
}
