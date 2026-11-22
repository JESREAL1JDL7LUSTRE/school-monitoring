import { notFound } from "next/navigation";
import { inventoryListHref, inventoryReturnTo } from "@/modules/inventory/return-navigation";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { requirePermission } from "@/modules/auth/session";
import { getSchoolSettings } from "@/modules/settings/queries";
import { InventoryPrintSheet } from "@/modules/inventory/print-sheet";
import {
  getInventoryReportDocuments, getInventoryIssued, getInventoryMaster, getItemLedger, getLatestInventoryCounts,
} from "@/modules/inventory/queries";
import { buildingTableData, countTableData, documentTableData, issueTableData, reportTitles } from "@/modules/inventory/report-data";
import { classifyItem, dateInManila, inventoryDetail, inventoryDetailFields, money } from "@/modules/inventory/rules";
import { InventoryTable } from "@/modules/inventory/table";

type Filters = { returnTo?: string; item?: string; category?: string; q?: string; from?: string; through?: string; location?: string; accountable?: string; reference?: string };
const dateValue = (value?: string) => z.iso.date().safeParse(value).data;
const textValue = (value?: string) => typeof value === "string" ? value.trim().slice(0, 200) : undefined;

const InventoryReportPage = async ({ params, searchParams }: {
  params: Promise<{ report: string }>;
  searchParams: Promise<Filters>;
}) => {
  await requirePermission("inventory.read");
  const [{ report }, filters, settings, { items, categories }] = await Promise.all([params, searchParams, getSchoolSettings(), getInventoryMaster()]);
  if (!Object.hasOwn(reportTitles, report)) notFound();
  const category = categories.find(({ id }) => id === filters.category);
  const q = textValue(filters.q)?.toLowerCase();
  const from = dateValue(filters.from);
  const through = dateValue(filters.through);
  const location = textValue(filters.location);
  const accountable = textValue(filters.accountable);
  const reference = textValue(filters.reference);
  const reportDate = through ?? settings.reference_date ?? dateInManila();
  const hasDates = ["rsmi", "waste", "annex-1", "issued"].includes(report);
  const isCount = ["rpci", "rpcppe", "annex-a"].includes(report);
  const selected = items.filter((row) => (!category || row.category_id === category.id) && (!filters.item || row.id === filters.item)
    && (!q || `${row.item_code} ${row.name}`.toLowerCase().includes(q)));
  const active = selected.filter((row) => !row.archived_at);
  const property = active.filter((row) => classifyItem(row, row.category.category_type, settings).form === "PAR");
  const buildings = active.filter((row) => row.category.category_type === "building");
  const empty = "No records match this report.";
  const title = reportTitles[report];

  const renderReport = async () => {
    switch (report) {
      case "rpci":
      case "rpcppe":
      case "annex-a": {
        const inventory = report === "rpcppe" ? property : report === "rpci" && !category
          ? active.filter((row) => classifyItem(row, row.category.category_type, settings).form !== "PAR") : active;
        const counts = await getLatestInventoryCounts(reportDate);
        const net = inventory.reduce((sum, row) => {
          const count = counts.get(row.id);
          return sum + (count ? (count.counted_quantity - count.recorded_quantity) * count.unit_cost : 0);
        }, 0);
        return <>
          {report === "annex-a" && <dl className="grid gap-2 text-sm sm:grid-cols-3">
            <div><dt className="font-semibold">Accountable staff</dt><dd>{accountable || "—"}</dd></div>
            <div><dt className="font-semibold">Physical inventory as of</dt><dd>{reportDate}</dd></div>
            <div><dt className="font-semibold">Location or office</dt><dd>{location || "—"}</dd></div>
          </dl>}
          <InventoryTable printAll {...countTableData(inventory, counts, report === "annex-a")} empty={empty} />
          <p className="text-right font-semibold">Net recorded variance {money(net)}</p>
        </>;
      }
      case "rsmi":
      case "waste":
      case "annex-1": {
        const records = await getInventoryReportDocuments({
          kind: report === "rsmi" ? "issue" : report === "waste" ? "disposal" : "receipt",
          from, through: reportDate, reference: report === "annex-1" ? reference : undefined,
        });
        const toReport = report === "annex-1" && !category
          ? selected.filter((row) => row.category.name === "Science and Math") : selected;
        const data = documentTableData(report, records, toReport);
        return <><InventoryTable printAll {...data} empty={empty} />
          <p className="text-right font-semibold">Total stock value {money(data.total)}</p>
          {report === "waste" && <p className="text-right font-semibold">Total document proceeds {money(data.proceeds)}</p>}
        </>;
      }
      case "nsbi":
        return <><InventoryTable printAll {...buildingTableData(buildings)} empty={empty} />
          <p className="text-right font-semibold">Buildings {buildings.length}
            {" · Classrooms "}{buildings.reduce((sum, item) => sum + (Number(inventoryDetail(item, "rooms")) || 0), 0)}
            {" · Floor area "}{buildings.reduce((sum, item) => sum + (Number(inventoryDetail(item, "area")) || 0), 0)} sq m
          </p></>;
      case "building-card": {
        const building = buildings[0];
        if (!building) return <p>{empty}</p>;
        return <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div><dt className="font-semibold">Building number</dt><dd>{building.item_code}</dd></div>
          <div><dt className="font-semibold">Description</dt><dd>{building.name}</dd></div>
          {inventoryDetailFields.map(([key, label]) => {
            const value = inventoryDetail(building, key);
            return value ? <div key={key}><dt className="font-semibold">{label}</dt><dd>{value}</dd></div> : null;
          })}
          <div><dt className="font-semibold">Condition</dt><dd>{building.condition}</dd></div>
          <div><dt className="font-semibold">Unit cost</dt><dd>{money(building.unit_cost)}</dd></div>
        </dl>;
      }
      case "iirup": {
        const unserviceable = active.filter((row) => row.condition === "Unserviceable");
        return <InventoryTable printAll headings={["Code", "Item", "Quantity", "Condition", "Unit cost", "Value"]}
          rows={unserviceable.map((row) => ({
            id: row.id, columns: [row.item_code, row.name, row.balance, row.condition, money(row.unit_cost), money(row.balance * row.unit_cost)],
          }))} empty={empty} />;
      }
      case "issued":
        return <InventoryTable printAll {...issueTableData(selected, await getInventoryIssued(from, through))} empty={empty} />;
      case "stock-card": {
        const stock = selected[0];
        if (!stock) return <p>{empty}</p>;
        const ledger = await getItemLedger(stock.id);
        return <><p className="text-sm">{stock.item_code} · {stock.name} · Reorder point {stock.reorder_point} {stock.unit}</p>
          <InventoryTable printAll headings={["Date", "Reference", "Type", "Change", "Balance"]}
            rows={[...ledger].reverse().map((line) => ({
              id: String(line.id), columns: [line.transaction_date, line.document_no, line.kind, line.quantity_delta, line.running_balance],
            }))} empty={empty} /></>;
      }
      case "tags":
        return active.length ? <ul className="grid gap-3 sm:grid-cols-2 print:grid-cols-2">
          {active.map((row) => <li className="break-inside-avoid rounded-lg border p-4 text-sm" key={row.id}>
            <p className="font-semibold">{settings.school_name}</p>
            <p className="mt-2 text-lg font-semibold">{row.item_code}</p>
            <p>{row.name} · {row.category.name}</p>
            <p>{row.balance} {row.unit} · {money(row.unit_cost)}</p>
            <p>Property custodian {settings.administrative_officer || "—"}</p>
            <p className="mt-2 text-xs">Per card _____ · On hand _____ · Short _____ · Over _____</p>
          </li>)}
        </ul> : <p>{empty}</p>;
    }
  };

  return <InventoryPrintSheet title={title} school={settings} details={[category?.name, `Prepared as of ${reportDate}`].filter(Boolean).join(" · ")}
    signature={report === "tags" ? "none" : "inventory"} inventoryBack={inventoryReturnTo(filters.returnTo) ?? inventoryListHref("reports", category?.id)}
    controls={
      <form className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="returnTo" value={inventoryReturnTo(filters.returnTo) ?? ""} />
        <input type="hidden" name="q" value={textValue(filters.q) ?? ""} />
        <div className="grid w-full gap-2 sm:w-auto">
          <Label htmlFor="category">Category</Label>
          <NativeSelect id="category" name="category" size="touch" className="w-full max-w-full" defaultValue={category?.id ?? ""}>
            <NativeSelectOption value="">All categories</NativeSelectOption>
            {categories.map((row) => <NativeSelectOption key={row.id} value={row.id}>{row.name}</NativeSelectOption>)}
          </NativeSelect>
        </div>
        {["building-card","stock-card","tags"].includes(report) && (
          <div className="grid w-full min-w-0 max-w-full gap-2 sm:max-w-80">
            <Label htmlFor="item">Item</Label>
            <NativeSelect id="item" name="item" size="touch" className="w-full max-w-full" defaultValue={filters.item ?? ""}>
              <NativeSelectOption value="">{report === "tags" ? "All items" : "First matching item"}</NativeSelectOption>
              {(report === "building-card" ? items.filter((row) => row.category.category_type === "building") : items).map((row) => (
                <NativeSelectOption key={row.id} value={row.id}>{row.item_code} · {row.name}</NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        )}
        {hasDates && <>
          <div className="grid gap-2"><Label htmlFor="from">From</Label><Input variant="touch" type="date" id="from" name="from" defaultValue={from} /></div>
          <div className="grid gap-2"><Label htmlFor="through">Through</Label><Input variant="touch" type="date" id="through" name="through" defaultValue={through} /></div>
        </>}
        {isCount && <div className="grid gap-2"><Label htmlFor="through">Count date through</Label><Input variant="touch" type="date" id="through" name="through" defaultValue={through} /></div>}
        {report === "annex-1" && <div className="grid gap-2"><Label htmlFor="reference">Delivery receipt number</Label><Input variant="touch" id="reference" name="reference" maxLength={200} defaultValue={reference} /></div>}
        {report === "annex-a" && <>
          <div className="grid gap-2"><Label htmlFor="accountable">Accountable staff</Label><Input variant="touch" id="accountable" name="accountable" defaultValue={accountable} maxLength={200} /></div>
          <div className="grid gap-2"><Label htmlFor="location">Location or office</Label><Input variant="touch" id="location" name="location" defaultValue={location} maxLength={200} /></div>
        </>}
        <Button type="submit" variant="outline" className="ml-auto">Apply filters</Button>
      </form>
    }>
    {await renderReport()}
  </InventoryPrintSheet>;
};
export default InventoryReportPage;
