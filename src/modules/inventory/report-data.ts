import type { InventoryDocument, InventoryIssuedLine, PhysicalCount } from "./database";
import type { StockItem } from "./queries";
import { inventorySnapshot } from "./snapshot";
import { inventoryDetail, money } from "./rules";

export const reportTitles: Record<string, string> = {
  rsmi: "Report of Supplies and Materials Issued (RSMI)",
  rpci: "Report on the Physical Count of Inventories (RPCI)",
  rpcppe: "Report on the Physical Count of Property, Plant and Equipment (RPCPPE)",
  iirup: "Inventory and Inspection Report of Unserviceable Property (IIRUP)",
  waste: "Waste Materials Report",
  "annex-a": "Inventory Count Form (Annex A)",
  "annex-1": "Science and Mathematics Equipment Certification (Annex 1 and Property Form No. 1)",
  nsbi: "School Building Inventory Report (NSBI)",
  issued: "Issued Summary",
  tags: "Property Tags",
  "stock-card": "Stock Card",
  "building-card": "School Building Card",
};

export const countTableData = (items: StockItem[], counts: Map<string, PhysicalCount>, annex: boolean) => {
  const headings = annex ? [
    "Article", "Description", "New property no.", "Old property no.", "Unit", "Unit value",
    "Per property card", "Physical count", "Location", "Condition", "Remarks",
  ] : ["Code", "Item", "Count date", "Unit", "Unit value", "Per card", "On hand", "Variance", "Variance value", "Remarks"];
  const rows = items.map((item) => {
    const count = counts.get(item.id);
    const variance = count ? count.counted_quantity - count.recorded_quantity : null;
    return {
      id: item.id,
      columns: annex ? [
        item.name, item.description, item.item_code, inventoryDetail(item, "old"), item.unit, money(count?.unit_cost ?? item.unit_cost),
        count?.recorded_quantity ?? item.balance, count?.counted_quantity ?? "—", count?.location || inventoryDetail(item, "location"),
        item.condition, count?.remarks || inventoryDetail(item, "remarks"),
      ] : [
        item.item_code, item.name, count?.count_date ?? "—", item.unit, money(count?.unit_cost ?? item.unit_cost),
        count?.recorded_quantity ?? "—", count?.counted_quantity ?? "—", variance ?? "—",
        count && variance !== null ? money(variance * count.unit_cost) : "—",
        count ? [variance === 0 ? "Matched" : variance !== null && variance < 0 ? "Shortage" : "Overage", count.remarks].filter(Boolean).join(" · ") : "Awaiting count",
      ],
    };
  });
  return { headings, rows };
};

export const buildingTableData = (items: StockItem[]) => ({
  headings: ["Number", "Description", "Type or design", "Storeys", "Classrooms", "Floor area (sq m)", "Year", "Funding", "Condition", "Cost"],
  rows: items.map((item) => ({
    id: item.id,
    columns: [
      item.item_code, item.name, ...["design","storeys","rooms","area","year","fund"].map((key) => inventoryDetail(item, key) || "—"),
      item.condition, money(item.balance * item.unit_cost),
    ],
  })),
});

export const issueTableData = (items: StockItem[], issued: InventoryIssuedLine[]) => {
  const codes = new Map(items.map((item) => [item.id, item.item_code]));
  return {
    headings: ["Document", "Item code", "Employee", "Date", "Issued", "Returned", "Outstanding"],
    rows: issued.filter((line) => codes.has(line.item_id)).map((line) => ({
      id: String(line.issue_line_id),
      columns: [line.document_no, codes.get(line.item_id) ?? "—", line.employee_name, line.transaction_date,
        line.issued_quantity, line.returned_quantity, line.outstanding],
    })),
  };
};

export const documentTableData = (report: string, documents: InventoryDocument[], items: StockItem[]) => {
  const acceptedItems = new Set(items.map((item) => item.id));
  const waste = report === "waste";
  const rows = documents.flatMap((document) => {
    if ((report === "rsmi" && document.form_type !== "RIS")
      || (report === "waste" && document.kind !== "disposal") || (report === "annex-1" && document.kind !== "receipt")) return [];
    const parsed = inventorySnapshot.safeParse(document.snapshot);
    if (!parsed.success) return [];
    return parsed.data.lines.filter((line) => acceptedItems.has(line.item_id)).map((line, index) => ({
      id: document.id + "-" + index,
      columns: [
        document.transaction_date, document.document_no, line.item_code, line.name, line.unit,
        line.quantity, money(line.unit_cost), money(line.quantity * line.unit_cost), document.reference,
        ...(waste ? [
          parsed.data.disposal?.method ?? "—", parsed.data.disposal?.receipt_number ?? "—",
          index === 0 && parsed.data.disposal?.proceeds !== undefined ? money(parsed.data.disposal.proceeds) : "—",
        ] : []),
      ],
      amount: line.quantity * line.unit_cost,
      proceeds: index === 0 ? parsed.data.disposal?.proceeds ?? 0 : 0,
    }));
  });
  return {
    headings: ["Date", "Document", "Code", "Item", "Unit", "Quantity", "Unit cost", "Stock value", "Reference",
      ...(waste ? ["Disposal method", "O.R. no.", "Proceeds per document"] : [])],
    rows,
    total: rows.reduce((sum, row) => sum + row.amount, 0),
    proceeds: rows.reduce((sum, row) => sum + row.proceeds, 0),
  };
};
