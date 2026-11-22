"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintButton({ children = "Print document" }: { children?: string }) {
  return <Button onClick={() => window.print()}><Printer aria-hidden />{children}</Button>;
}
