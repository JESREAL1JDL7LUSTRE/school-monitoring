import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const tablePageSize = 25;
export const tablePage = (value: unknown) =>
  typeof value === "string" && /^\d{1,7}$/.test(value) ? Math.max(1, Number(value)) : 1;

export function TablePageLinks({ previous, next, label }: {
  previous?: string;
  next?: string;
  label: string;
}) {
  if (!previous && !next) return null;
  return (
    <nav aria-label="Table pagination" className="flex flex-wrap items-center justify-between gap-2 border-t pt-2 text-sm text-muted-foreground print:hidden">
      <p className="tabular-nums">{label}</p>
      <div className="flex items-center gap-2">
        {previous ? <Button asChild variant="outline" size="icon" aria-label="Previous page">
          <Link href={previous} prefetch={false}><ChevronLeft aria-hidden="true" /></Link>
        </Button> : <Button variant="outline" size="icon" aria-label="Previous page" disabled><ChevronLeft aria-hidden="true" /></Button>}
        {next ? <Button asChild variant="outline" size="icon" aria-label="Next page">
          <Link href={next} prefetch={false}><ChevronRight aria-hidden="true" /></Link>
        </Button> : <Button variant="outline" size="icon" aria-label="Next page" disabled><ChevronRight aria-hidden="true" /></Button>}
      </div>
    </nav>
  );
}
