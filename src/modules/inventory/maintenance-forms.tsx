"use client";

import { useId } from "react";
import { EditorCancel, ReviewableForm, useRecordAction } from "@/components/record-editor";
import { Button } from "@/components/ui/button";
import { NativeSelectOption } from "@/components/ui/native-select";
import { importInventoryWorkbook, saveInventoryCategory, savePhysicalCount } from "./actions";
import { categoryTypes, type InventoryCategory } from "./database";
import { InventoryFeedback, InventoryInput, InventorySelect } from "./ui";
import type { StockItem } from "./queries";

export const InventoryCategoryForm = ({ category }: { category?: InventoryCategory }) => {
  const id = useId();
  const [state, action, pending] = useRecordAction(saveInventoryCategory, {}, (result) => result.message);
  return (
    <ReviewableForm action={action} pending={pending} className="space-y-4" confirmation={{
      title: category ? "Save category changes?" : "Add this category?",
      description: "Apply the category name and type to the inventory workspace.",
      label: category ? "Confirm save" : "Confirm addition",
    }}>
      <InventoryFeedback state={state} />
      {category && <><input type="hidden" name="category_id" value={category.id} /><input type="hidden" name="updated_at" value={category.updated_at} /></>}
      <fieldset disabled={pending} className="grid gap-4 sm:grid-cols-2">
        <InventoryInput label="Category name" name="name" id={id + "-name"} defaultValue={category?.name} required maxLength={120} />
        <InventorySelect label="Category type" name="category_type" id={id + "-type"} defaultValue={category?.category_type ?? "supplies"}>
          {categoryTypes.map((type) => <NativeSelectOption key={type} value={type}>{type}</NativeSelectOption>)}
        </InventorySelect>
      </fieldset>
      <div className="flex flex-wrap justify-end gap-2">
        <EditorCancel disabled={pending} />
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : category ? "Save category" : "Save new category"}</Button>
      </div>
    </ReviewableForm>
  );
};

export const InventoryCountForm = ({ items, date }: { items: StockItem[]; date: string }) => {
  const [state, action, pending] = useRecordAction(savePhysicalCount, {}, (result) => result.message);
  return (
    <ReviewableForm action={action} pending={pending} className="space-y-4" confirmation={{
      title: "Record this physical count?",
      description: "Add this observation to the item’s physical count history.",
      label: "Confirm count",
    }}>
      <InventoryFeedback state={state} />
      <fieldset disabled={pending} className="grid gap-4 sm:grid-cols-2">
        <InventorySelect label="Item" name="item" defaultValue={items.length === 1 ? items[0].id : ""} required>
          <NativeSelectOption value="" disabled>Choose an item</NativeSelectOption>
          {items.map((item) => <NativeSelectOption key={item.id} value={item.id}>{item.item_code} · {item.name}</NativeSelectOption>)}
        </InventorySelect>
        <InventoryInput label="Count date" name="date" type="date" max={date} defaultValue={date} required />
        <InventoryInput label="Quantity on hand" name="quantity" type="number" min="0" step="0.001" required />
        <InventoryInput label="Location or office" name="location" maxLength={200} />
        <InventoryInput label="Remarks" name="remarks" maxLength={1000} />
      </fieldset>
      <div className="flex flex-wrap justify-end gap-2">
        <EditorCancel disabled={pending} />
        <Button type="submit" disabled={pending}>{pending ? "Recording…" : "Record physical count"}</Button>
      </div>
    </ReviewableForm>
  );
};

export const InventoryImportForm = () => {
  const [state, action, pending] = useRecordAction(importInventoryWorkbook, {}, (result) => result.message);
  return (
    <ReviewableForm action={action} pending={pending} className="space-y-4" confirmation={{
      title: "Import this Excel workbook?",
      description: "The import creates inventory items and posts opening stock as receipts.",
      label: "Confirm import",
    }}>
      <InventoryFeedback state={state} />
      <fieldset disabled={pending}><InventoryInput label="Excel workbook" name="file" type="file" accept=".xlsx" required /></fieldset>
      <div className="flex flex-wrap justify-end gap-2">
        <EditorCancel disabled={pending} />
        <Button type="submit" disabled={pending}>{pending ? "Importing…" : "Import Excel"}</Button>
      </div>
    </ReviewableForm>
  );
};
