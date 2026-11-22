import type { ReactNode } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const InventoryTable = ({ headings, rows, empty, printAll = false }: {
  headings: readonly string[];
  rows: { id: string; columns: ReactNode[] }[];
  empty: string;
  printAll?: boolean;
}) => (
  <Table className="tabular-nums">
    <TableHeader><TableRow>{headings.map((heading, index) => <TableHead key={index} scope="col">{heading}</TableHead>)}</TableRow></TableHeader>
    <TableBody printAll={printAll}>
      {rows.length ? rows.map((row) => (
        <TableRow key={row.id}>{row.columns.map((value, index) => <TableCell key={index}>{value}</TableCell>)}</TableRow>
      )) : <TableRow><TableCell colSpan={headings.length} className="py-8 text-center text-muted-foreground">{empty}</TableCell></TableRow>}
    </TableBody>
  </Table>
);
