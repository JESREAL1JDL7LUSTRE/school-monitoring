"use client";

import { useActionState, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { NativeSelectOption } from "@/components/ui/native-select";
import { postInventoryDocument } from "./actions";
import { disposalMethods, type InventoryIssuedLine, type InventoryKind } from "./database";
import type { StockItem } from "./queries";
import { InventoryFeedback, InventoryInput, InventorySelect } from "./ui";
import { classifyItem, money } from "./rules";

type TransactionLine = { id: number; item: string; quantity: string; unitCost: string };
const blankLine = (id: number): TransactionLine => ({ id, item: "", quantity: "1", unitCost: "" });

export const InventoryTransactionForm = ({ kind, employees, items, returns, date, requestId, preferredItem, thresholds, returnTo }: {
  kind: InventoryKind;
  employees: { id: string; full_name: string; employee_no: string }[];
  items: StockItem[];
  returns: InventoryIssuedLine[];
  date: string;
  requestId: string;
  preferredItem?: string;
  returnTo: string;
  thresholds: { ppe_threshold: number; semi_expendable_threshold: number };
}) => {
  const [state, action, pending] = useActionState(postInventoryDocument, {});
  const [dateValue, setDate] = useState(date);
  const [employee, setEmployee] = useState("");
  const [reference, setReference] = useState("");
  const [disposal, setDisposal] = useState({ method: "", receipt: "", proceeds: "" });
  const [rows, setRows] = useState([{ ...blankLine(1), item: kind === "return" ? "" : preferredItem ?? "" }]);
  const nextRow = useRef(2);
  const itemsById = new Map(items.map((item) => [item.id, item]));
  const grandTotal = kind === "issue" ? rows.reduce((sum, row) =>
    sum + (itemsById.get(row.item)?.unit_cost ?? 0) * (Number(row.quantity) || 0), 0) : null;
  const updateRow = (id: number, key: "item" | "quantity" | "unitCost", value: string) =>
    setRows((previous) => previous.map((row) => row.id === id ? { ...row, [key]: value } : row));

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="returnTo" value={returnTo} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="request_id" value={requestId} />
      <InventoryFeedback state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <InventoryInput label="Transaction date" name="date" type="date" value={dateValue} onChange={(event) => setDate(event.target.value)} max={date} required />
        {kind === "issue" && (
          <InventorySelect label="Employee" name="employee" value={employee} onChange={(event) => setEmployee(event.target.value)} required>
            <NativeSelectOption value="" disabled>Choose an employee</NativeSelectOption>
            {employees.map((person) => <NativeSelectOption key={person.id} value={person.id}>{person.employee_no} · {person.full_name}</NativeSelectOption>)}
          </InventorySelect>
        )}
        <InventoryInput
          label="Reference or notes"
          name="reference" maxLength={500} value={reference}
          onChange={(event) => setReference(event.target.value)}
        />
      </div>
      {kind === "disposal" && (
        <div className="grid gap-4 sm:grid-cols-3">
          <InventorySelect label="Disposal method" name="disposal_method" required value={disposal.method}
            onChange={(event) => setDisposal({ ...disposal, method: event.target.value })}>
            <NativeSelectOption value="" disabled>Choose a method</NativeSelectOption>
            {disposalMethods.map((method) => <NativeSelectOption value={method} key={method}>{method}</NativeSelectOption>)}
          </InventorySelect>
          <InventoryInput label="Official receipt number" name="receipt_number" maxLength={120} value={disposal.receipt}
            required={Boolean(disposal.proceeds)} onChange={(event) => setDisposal({ ...disposal, receipt: event.target.value })} />
          <InventoryInput label="Actual proceeds (₱)" name="proceeds" type="number" min="0" step="0.01" value={disposal.proceeds}
            onChange={(event) => setDisposal({ ...disposal, proceeds: event.target.value })} />
        </div>
      )}
      {rows.map((row, index) => {
        const number = index + 1;
        const item = itemsById.get(row.item);
        const issued = returns.find((option) => String(option.issue_line_id) === row.item.split(":")[0]);
        return (
          <fieldset key={row.id} className="space-y-3 rounded-lg border p-3">
            <legend className="px-1 text-sm font-medium">Line {number}</legend>
            <div className="grid items-start gap-3 sm:grid-cols-2">
              {kind === "return" ? (
                <>
                  <input type="hidden" name="item_id" value="" />
                  <InventorySelect label={`Issued line ${number}`} id={`issue-line-${row.id}`} name="issue_line" value={row.item} required onChange={(event) => updateRow(row.id, "item", event.target.value)}>
                    <NativeSelectOption value="" disabled>Choose an issue</NativeSelectOption>
                    {returns.map((line) => (
                      <NativeSelectOption key={line.issue_line_id} value={`${line.issue_line_id}:${line.item_id}`}>
                        {line.document_no} · {itemsById.get(line.item_id)?.item_code} · {line.employee_name} ({line.outstanding} out)
                      </NativeSelectOption>
                    ))}
                  </InventorySelect>
                </>
              ) : (
                <InventorySelect label={`Item ${number}`} id={`item-${row.id}`} name="item_id" value={row.item} required onChange={(event) => updateRow(row.id, "item", event.target.value)}>
                  <NativeSelectOption value="" disabled>Choose an item</NativeSelectOption>
                  {items.map((option) => (
                    <NativeSelectOption key={option.id} value={option.id}>{option.item_code} · {option.name} ({option.balance} {option.unit})</NativeSelectOption>
                  ))}
                </InventorySelect>
              )}
              <InventoryInput label={`Quantity ${number}`} name="quantity" id={`quantity-${row.id}`} type="number" required
                min={kind === "adjustment" ? undefined : "0.001"}
                max={issued?.outstanding ?? (kind === "issue" || kind === "disposal" ? item?.balance : undefined)}
                step="0.001" value={row.quantity} onChange={(event) => updateRow(row.id, "quantity", event.target.value)} />
              {kind === "receipt" && (
                <InventoryInput label={`Unit cost ${number} (₱)`} name="unit_cost" id={`cost-${row.id}`} type="number" min="0" step="0.01"
                  placeholder={item ? String(item.unit_cost) : undefined} value={row.unitCost} onChange={(event) => updateRow(row.id, "unitCost", event.target.value)} />
              )}
            </div>
            {item && kind === "issue" && (
              <p className="text-sm text-muted-foreground">
                {classifyItem(item, item.category.category_type, thresholds).form}
                {" · "}{money(item.unit_cost)} per {item.unit}
                {" · Line total "}{money(item.unit_cost * (Number(row.quantity) || 0))}
              </p>
            )}
            {rows.length > 1 && (
              <Button type="button" size="sm" variant="ghost" onClick={() => setRows((previous) => previous.filter((line) => line.id !== row.id))}>
                Remove line {number}
              </Button>
            )}
          </fieldset>
        );
      })}
      {grandTotal !== null && <p className="text-sm font-semibold tabular-nums">Grand total {money(grandTotal)}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={rows.length >= 100} onClick={() => setRows([...rows, blankLine(nextRow.current++)])}>Add line</Button>
        <Button type="submit" variant={kind === "disposal" ? "destructive" : "default"} disabled={pending}>{pending ? "Posting…" : `Post ${kind}`}</Button>
      </div>
    </form>
  );
};
