"use client";

import Link from "next/link";
import { useMemo } from "react";
import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type ReportRow = { id: string; values: string[] };
const features = tableFeatures({});
const column = createColumnHelper<typeof features, ReportRow>();

export function PersonnelReportTable({ headings, rows }: { headings: string[]; rows: ReportRow[] }) {
  const columns = useMemo(() => column.columns(headings.map((heading, index) => column.accessor((row) => row.values[index], {
    id: String(index),
    header: heading,
    cell: ({ getValue, row }) => index === 2
      ? <Link href={`/employees/${row.original.id}`} className="font-semibold underline underline-offset-2 print:no-underline">{getValue()}</Link>
      : getValue(),
  }))), [headings]);
  const table = useTable({ features, columns, data: rows, getRowId: (row) => row.id });

  return (
    <div className="[&_[data-slot=table-container]]:print:overflow-visible [&_td]:print:p-1 [&_td]:print:whitespace-normal [&_td]:print:wrap-anywhere [&_th]:print:p-1 [&_th]:print:whitespace-normal [&_th]:print:wrap-anywhere">
      <Table className="print:table-fixed print:text-[9pt]" aria-labelledby="report-title">
        <TableHeader>
          {table.getHeaderGroups().map((group) => <TableRow key={group.id}>
            {group.headers.map((header) => <TableHead key={header.id} scope="col"><table.FlexRender header={header} /></TableHead>)}
          </TableRow>)}
        </TableHeader>
        <TableBody printAll>
          {table.getRowModel().rows.map((row) => <TableRow key={row.id} className="break-inside-avoid">
            {row.getAllCells().map((cell) => <TableCell key={cell.id} className={cell.column.id === "9" ? "min-w-36 whitespace-normal print:min-w-0" : undefined}><table.FlexRender cell={cell} /></TableCell>)}
          </TableRow>)}
          {!rows.length && <TableRow><TableCell colSpan={headings.length}>No employees match this report.</TableCell></TableRow>}
        </TableBody>
      </Table>
    </div>
  );
}
