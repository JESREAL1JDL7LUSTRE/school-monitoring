import Link from "next/link";
import { notFound } from "next/navigation";
import { SpreadsheetImportForm } from "@/components/spreadsheet-import-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requirePermission } from "@/modules/auth/session";

export default async function ImportPage({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (kind !== "employees" && kind !== "inventory") notFound();
  const employees = kind === "employees";
  await requirePermission(employees ? "personnel.write" : "inventory.write");

  return <div className="max-w-5xl space-y-5">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-2">
        <h1 className="desk-heading">{employees ? "Import employees" : "Import inventory"}</h1>
        <p className="text-sm text-muted-foreground">
          {employees
            ? "Dates use YYYY-MM-DD or Excel date cells. Blank classification and employment status use Teaching and Permanent."
            : "Use existing category names. Opening quantities are recorded as stock receipts."}
        </p>
      </div>
      <Button asChild variant="outline"><Link href={`/${kind}`}>Back to {kind}</Link></Button>
    </header>
    <Card><CardContent className="space-y-4">
      {!employees && <Button asChild variant="link" className="h-auto p-0">
        <a href="/api/inventory/export?format=template">Download blank Excel template</a>
      </Button>}
      <SpreadsheetImportForm kind={kind} />
    </CardContent></Card>
  </div>;
}
