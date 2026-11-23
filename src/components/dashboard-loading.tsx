import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const tableWidths = ["w-full", "w-4/5", "w-2/3", "w-5/6", "w-3/4", "w-2/3"];

function TablePlaceholder() {
  return <Card className="gap-0 py-3">
    <CardContent className="px-3 sm:px-4">
      <div className="flex items-center border-b pb-3"><Skeleton className="h-4 w-36" /></div>
      {Array.from({ length: 5 }, (_, row) => (
        <div key={row} className="grid h-11 grid-cols-3 items-center gap-5 border-b last:border-0 sm:grid-cols-6">
          {tableWidths.map((width, column) => (
            <Skeleton key={column} className={`h-3 max-w-40 ${width} ${column > 2 ? "hidden sm:block" : ""}`} />
          ))}
        </div>
      ))}
    </CardContent>
  </Card>;
}

function GridPlaceholder() {
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
    {Array.from({ length: 3 }, (_, index) => <Card key={index} size="sm">
      <CardContent className="space-y-3">
        <Skeleton className="h-4 w-2/5" />
        <Skeleton className="h-5 w-3/4" />
      </CardContent>
    </Card>)}
  </div>;
}

function CalendarPlaceholder() {
  return <Card className="py-5">
    <CardContent className="space-y-4 px-3 sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-7 w-32 sm:w-44" />
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border bg-border">
        {Array.from({ length: 42 }, (_, day) => (
          <div key={day} className="h-13 bg-card p-2 sm:h-23">
            <Skeleton className="size-4 rounded-full sm:size-6" />
          </div>
        ))}
      </div>
    </CardContent>
  </Card>;
}

export function DashboardLoading({ kind = "table", title, filters = false }: {
  kind?: "table" | "home" | "calendar" | "settings" | "cards" | "inventory" | "nosi";
  title?: string;
  filters?: boolean;
}) {
  let content: ReactNode;
  switch (kind) {
    case "home":
      content = <div className="grid items-start gap-6 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <TablePlaceholder />
        <div className="space-y-3"><Skeleton className="h-5 w-44" /><TablePlaceholder /></div>
      </div>;
      break;
    case "calendar":
      content = <CalendarPlaceholder />;
      break;
    case "settings":
      content = <Card><CardContent className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 6 }, (_, index) => <div key={index} className="space-y-2">
          <Skeleton className="h-3 w-28" /><Skeleton className="h-11 w-full" />
        </div>)}
      </CardContent></Card>;
      break;
    case "cards":
      content = <GridPlaceholder />;
      break;
    case "inventory":
    case "nosi":
      content = <div className="space-y-5"><GridPlaceholder /><TablePlaceholder /></div>;
      break;
    default:
      content = <TablePlaceholder />;
  }

  return <div className="space-y-5 print:hidden" data-dashboard-loading={kind}>
    {title && <h1 className="desk-heading">{title}</h1>}
    <span role="status" className="sr-only">Loading {title ? title.toLowerCase() : "school records"}…</span>
    <div aria-hidden="true" className="space-y-5">
      {filters && <Card className="py-4"><CardContent className="flex flex-wrap items-end gap-3">
        <Skeleton className="h-11 w-full sm:max-w-80" />
        <Skeleton className="h-11 w-28" />
      </CardContent></Card>}
      {content}
    </div>
  </div>;
}
