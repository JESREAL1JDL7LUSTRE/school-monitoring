import { notFound } from "next/navigation";
import { inventoryReturnTo } from "@/modules/inventory/return-navigation";
import { getInventoryDocument } from "@/modules/inventory/queries";
import { inventorySnapshot } from "@/modules/inventory/snapshot";
import { InventoryPrintSheet } from "@/modules/inventory/print-sheet";
import { InventoryTable } from "@/modules/inventory/table";
import { money } from "@/modules/inventory/rules";

const formTitles: Record<string, string> = {
  RIS: "Requisition and Issue Slip", ICS: "Inventory Custodian Slip", PAR: "Property Acknowledgment Receipt",
  RECEIPT: "Stock Receipt", RETURN: "Stock Return", ADJUSTMENT: "Stock Adjustment", DISPOSAL: "Property Disposal",
};

const InventoryDocumentPage = async ({ params, searchParams }: PageProps<"/inventory/documents/[id]">) => {
  const [{ id }, { returnTo }] = await Promise.all([params, searchParams]);
  const document = await getInventoryDocument(id);
  if (document.template_version !== 1) notFound();
  const snapshot = inventorySnapshot.parse(document.snapshot);
  const isReturn = document.kind === "return";
  const total = snapshot.lines.reduce((sum, line) => sum + line.quantity * line.unit_cost, 0);
  return (
    <InventoryPrintSheet title={formTitles[document.form_type] ?? document.form_type} school={snapshot.school}
      details={`${document.document_no} · ${document.transaction_date} · Template version ${document.template_version}`} signature="custody" inventoryBack={inventoryReturnTo(returnTo)}>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        {snapshot.employee_name && <div><dt className="font-semibold">Employee</dt><dd>{snapshot.employee_name}</dd></div>}
        {document.reference && <div><dt className="font-semibold">Reference or notes</dt><dd>{document.reference}</dd></div>}
        {snapshot.disposal && <div><dt className="font-semibold">Disposal method</dt><dd>{snapshot.disposal.method}</dd></div>}
        {snapshot.disposal?.receipt_number && <div><dt className="font-semibold">Official receipt number</dt><dd>{snapshot.disposal.receipt_number}</dd></div>}
        {snapshot.disposal?.proceeds !== undefined && <div><dt className="font-semibold">Actual proceeds</dt><dd>{money(snapshot.disposal.proceeds)}</dd></div>}
      </dl>
      <InventoryTable printAll headings={["Code", "Item", "Unit", "Quantity", "Unit cost", "Amount", isReturn ? "Original issue" : "Classification"]}
        rows={snapshot.lines.map((line, index) => ({
          id: String(index),
          columns: [line.item_code, line.name, line.unit, line.quantity, money(line.unit_cost),
            money(line.quantity * line.unit_cost), isReturn ? line.issue_document_no : line.classification],
        }))} empty="No transaction lines were saved." />
      <p className="text-right font-semibold">Total {money(total)}</p>
    </InventoryPrintSheet>
  );
};

export default InventoryDocumentPage;
