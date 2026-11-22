"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const PAGE_SIZE = 25
const PaginationTarget = React.createContext<HTMLDivElement | null>(null)

function Table({ className, ...props }: React.ComponentProps<"table">) {
  const [paginationTarget, setPaginationTarget] = React.useState<HTMLDivElement | null>(null)
  return (
    <PaginationTarget.Provider value={paginationTarget}>
      <div data-slot="table-container" className="relative w-full overflow-x-auto print:overflow-visible">
        <table
          data-slot="table"
          className={cn("w-full caption-bottom text-sm", className)}
          {...props}
        />
      </div>
      <div ref={setPaginationTarget} className="empty:hidden print:hidden" />
    </PaginationTarget.Provider>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b", className)}
      {...props}
    />
  )
}

function TableBody({ className, children, printAll = false, ...props }: React.ComponentProps<"tbody"> & { printAll?: boolean }) {
  const paginationTarget = React.useContext(PaginationTarget)
  const rows = React.useMemo(() => React.Children.toArray(children), [children])
  const rowKeys = React.useMemo(
    () => JSON.stringify(rows.map((row) => React.isValidElement(row) ? row.key : row)),
    [rows],
  )
  const [selection, setSelection] = React.useState({ rowKeys, page: 0 })
  if (selection.rowKeys !== rowKeys) {
    setSelection({ rowKeys, page: 0 })
  }
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const page = selection.rowKeys === rowKeys ? Math.min(selection.page, pageCount - 1) : 0
  const first = page * PAGE_SIZE
  const last = Math.min(first + PAGE_SIZE, rows.length)
  const bodyId = React.useId()
  const id = props.id ?? bodyId
  const bodyClass = cn("[&_tr:last-child]:border-0", className)
  const printClass = cn(className, "hidden print:table-row-group")

  return (
    <>
      {printAll && first > 0 && <tbody className={printClass}>{rows.slice(0, first)}</tbody>}
      <tbody data-slot="table-body" {...props} id={id} className={bodyClass}>
        {rows.slice(first, last)}
      </tbody>
      {printAll && last < rows.length && <tbody className={printClass}>{rows.slice(last)}</tbody>}
      {paginationTarget && pageCount > 1 && createPortal(
        <nav aria-label="Table pagination" className="flex flex-wrap items-center justify-between gap-2 border-t pt-2 text-sm text-muted-foreground">
          <p aria-live="polite" className="tabular-nums">Rows {first + 1}–{last} of {rows.length}</p>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="icon" aria-label="Previous page" aria-controls={id}
              disabled={page === 0} onClick={() => setSelection({ rowKeys, page: page - 1 })}>
              <ChevronLeft aria-hidden="true" />
            </Button>
            <p className="tabular-nums">Page {page + 1} of {pageCount}</p>
            <Button type="button" variant="outline" size="icon" aria-label="Next page" aria-controls={id}
              disabled={page + 1 >= pageCount} onClick={() => setSelection({ rowKeys, page: page + 1 })}>
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>
        </nav>,
        paginationTarget,
      )}
    </>
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
