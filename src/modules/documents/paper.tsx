import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatPersonnelDate } from "@/modules/personnel/rules";
import type { DocumentSnapshot } from "./snapshot";

export function DocumentPaper({ title, version, snapshot, logoUrl, preview = false }: { title: string; version: number; snapshot: DocumentSnapshot; logoUrl?: string | null; preview?: boolean }) {
  const Heading = preview ? "h2" : "h1";
  return (
    <Card className="overflow-visible print:rounded-none print:bg-white print:py-0 print:ring-0">
      <CardContent className="mx-auto w-full max-w-3xl space-y-6 px-5 py-6 sm:px-10 print:max-w-none print:p-0 print:text-black">
        <header className="space-y-1 text-center">
          {logoUrl && <Image unoptimized src={logoUrl} alt="School logo" width={64} height={64} className="mx-auto mb-2 size-16 object-contain" />}
          <p>Republic of the Philippines</p><p className="font-semibold">Department of Education</p>
          <p>{[snapshot.school.region, snapshot.school.division].filter(Boolean).join(" · ")}</p>
          <p className="font-semibold">{snapshot.school.name}</p>
          {snapshot.school.code && <p>School ID {snapshot.school.code}</p>}
        </header>
        <div className="space-y-2 text-center">
          <p className="font-semibold text-amber-900">Draft · School verification required</p>
          <Heading className="text-2xl font-semibold">{title}</Heading>
          <p className="text-sm">{formatPersonnelDate(snapshot.issuedOn)}</p>
        </div>
        {snapshot.sections.map((section, index) => (
          <section className="space-y-3" key={index}>
            {section.heading && <h2 className="font-semibold">{section.heading}</h2>}
            {section.paragraphs?.map((paragraph, row) => <p key={row} className="leading-relaxed">{paragraph}</p>)}
            {section.fields && <dl className="space-y-1">
              {section.fields.map(([label, value], row) => <div key={row} className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-3"><dt className="font-medium">{label}</dt><dd className="whitespace-pre-wrap wrap-anywhere">{value || "—"}</dd></div>)}
            </dl>}
            {section.table && <Table className="border-collapse border text-left" aria-label={section.heading}>
              <TableHeader><TableRow>{section.table.headers.map((heading) => <TableHead key={heading} scope="col" className="h-auto whitespace-normal border p-2 font-semibold">{heading}</TableHead>)}</TableRow></TableHeader>
              <TableBody printAll>{section.table.rows.map((row, index) => <TableRow key={index} className="break-inside-avoid">{row.map((cell, index) => <TableCell key={index} className="whitespace-normal border p-2 wrap-anywhere">{cell}</TableCell>)}</TableRow>)}</TableBody>
            </Table>}
          </section>
        ))}
        {snapshot.signatories.length > 0 && <div className="grid break-inside-avoid gap-5 pt-8 sm:grid-cols-2 print:grid-cols-2">
          {snapshot.signatories.map(([role, name]) => <div key={role}><p className="border-t pt-2 font-semibold">{name}</p><p>{role}</p></div>)}
        </div>}
        <footer className="border-t pt-3 text-xs text-muted-foreground print:text-black">Template version {version}</footer>
      </CardContent>
    </Card>
  );
}
