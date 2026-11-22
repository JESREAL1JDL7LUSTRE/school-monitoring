"use client";

import type { ComponentProps, ReactNode } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import type { InventoryActionState } from "./actions";

export const InventoryFeedback = ({ state }: { state: InventoryActionState }) => (
  <>
    {state.error && <Alert variant="destructive"><AlertDescription>{state.error}</AlertDescription></Alert>}
    {state.message && <Alert role="status"><AlertDescription>{state.message}</AlertDescription></Alert>}
  </>
);

export const InventoryInput = ({ label, id, name, ...props }: ComponentProps<typeof Input> & { label: string; name: string }) => (
  <div className="grid gap-2">
    <Label htmlFor={id ?? name}>{label}</Label>
    <Input id={id ?? name} name={name} {...props} />
  </div>
);

export const InventorySelect = ({ label, id, name, children, ...props }: ComponentProps<typeof NativeSelect> & {
  label: string;
  name: string;
  children: ReactNode;
}) => (
  <div className="grid gap-2">
    <Label htmlFor={id ?? name}>{label}</Label>
    <NativeSelect id={id ?? name} name={name} className="w-full" size="touch" {...props}>{children}</NativeSelect>
  </div>
);
