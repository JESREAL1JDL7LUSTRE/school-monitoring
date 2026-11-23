"use client";

import { useLinkStatus } from "next/link";
import { cn } from "@/lib/utils";

export function NavigationPending({ className }: { className?: string }) {
  const { pending } = useLinkStatus();
  return <span className={cn("inline-grid size-3 shrink-0 place-items-center", className)}>
    {pending && <>
      <span aria-hidden="true" className="size-2.5 rounded-full border border-current border-r-transparent motion-safe:animate-spin" />
      <span role="status" className="sr-only">Opening page…</span>
    </>}
  </span>;
}
