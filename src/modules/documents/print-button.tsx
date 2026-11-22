"use client";

import { Printer } from "lucide-react";
import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";

export function PrintButton({ children = "Print document", variant }: { children?: string; variant?: ComponentProps<typeof Button>["variant"] }) {
  return <Button variant={variant} onClick={() => window.print()}><Printer aria-hidden />{children}</Button>;
}
