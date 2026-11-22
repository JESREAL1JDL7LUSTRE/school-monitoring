import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ChevronDown } from "lucide-react";
import { WorkspaceNavigation } from "@/components/workspace-navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { hasPermission, requireSession } from "@/modules/auth/session";
import { PrintButton } from "@/modules/documents/print-button";
import { formatPersonnelDate } from "@/modules/personnel/rules";
import { getPersonnelReport, inventoryReports, personnelReports, readReportKey, type PersonnelReportKey } from "@/modules/reports/personnel";
import { PersonnelReportTable } from "@/modules/reports/personnel-table";

function PropertyReports({ open }: { open: boolean }) {
  return (
    <Card className="py-0 print:hidden">
      <details open={open} className="group">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-4 text-sm font-semibold [&::-webkit-details-marker]:hidden">
          Property reports <ChevronDown size={16} aria-hidden className="motion-safe:transition-transform group-open:rotate-180" />
        </summary>
        <ul className="grid gap-x-5 px-2 pb-3 sm:grid-cols-2 sm:px-3">
          {Object.entries(inventoryReports).map(([key, title]) => (
            <li key={key}>
              <Button variant="ghost" asChild className="h-auto min-h-11 w-full justify-between py-2 text-left whitespace-normal">
                <Link href={`/inventory/reports/${key}`}>{title}<ArrowRight size={16} aria-hidden /></Link>
              </Button>
            </li>
          ))}
        </ul>
      </details>
    </Card>
  );
}

async function PersonnelReport({ keyName, showAll }: { keyName: PersonnelReportKey; showAll: boolean }) {
  const { definition, settings, context, header, rows, attentionCount } = await getPersonnelReport(keyName, showAll);
  const exportUrl = `/api/reports/personnel?report=${keyName}&show=${showAll ? "all" : "attention"}`;

  return <Card role="region" className="min-w-0 gap-0 print:rounded-none print:bg-transparent print:py-0 print:ring-0" aria-labelledby="report-title">
    <header className="flex flex-wrap items-end justify-between gap-4 border-b px-4 pb-4 sm:px-5 print:border-0 print:px-0">
      <div className="space-y-1">
        <p className="hidden text-sm print:block">{settings.school_name}{settings.division && ` · ${settings.division}`}</p>
        <h2 id="report-title" className="desk-section-heading">{definition.title} report</h2>
        <p className="text-sm text-muted-foreground print:text-black">As of {formatPersonnelDate(context.asOf)} · Reporting year {context.reportingYear}{settings.prepared_by && ` · Prepared by ${settings.prepared_by}`}</p>
        <p className="text-sm font-medium">Employees requiring attention: {attentionCount}</p>
      </div>
      <div className="flex flex-wrap gap-2 print:hidden">
        <Button variant="outline" asChild><Link href={`/reports?report=${keyName}&show=${showAll ? "attention" : "all"}`}>{showAll ? "Show only YES" : "Show everyone"}</Link></Button>
        <Button variant="outline" asChild><a href={`${exportUrl}&format=csv`}>Export CSV</a></Button>
        <Button variant="outline" asChild><a href={`${exportUrl}&format=xlsx`}>Export Excel</a></Button>
        <PrintButton>Print report</PrintButton>
      </div>
    </header>
    <CardContent className="px-2 pt-2 sm:px-4 print:p-0">
      <PersonnelReportTable headings={header} rows={rows} />
    </CardContent>
  </Card>;
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ report?: string; show?: string }> }) {
  const params = await searchParams;
  const session = await requireSession();
  const personnel = hasPermission(session, "personnel.read");
  const inventory = hasPermission(session, "inventory.read");
  if (!personnel && !inventory) notFound();
  const report = personnel ? readReportKey(params.report) ?? "201-completeness" : null;

  return <div className="space-y-5">
    <h1 className="desk-heading print:hidden">Reports</h1>
    {report && <Card className="gap-0 py-0 print:hidden"><WorkspaceNavigation label="Personnel reports" className="border-0 px-2 sm:px-3"
      items={Object.entries(personnelReports).map(([key, { title }]) => ({
        href: `/reports?report=${key}${params.show === "all" ? "&show=all" : ""}`,
        label: title,
        active: report === key,
      }))} /></Card>}
    {report && <PersonnelReport keyName={report} showAll={params.show === "all"} />}
    {inventory && <PropertyReports open={!report} />}
  </div>;
}
