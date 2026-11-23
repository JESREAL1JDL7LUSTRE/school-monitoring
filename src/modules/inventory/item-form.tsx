"use client";

import { EditorCancel, ReviewableForm, useRecordAction, type SaveConfirmation } from "@/components/record-editor";
import { Button } from "@/components/ui/button";
import { NativeSelectOption } from "@/components/ui/native-select";
import { saveInventoryItem } from "./actions";
import { inventoryConditions, type InventoryCategory, type InventoryItem } from "./database";
import { inventoryDetail, inventoryDetailFields } from "./rules";
import { InventoryFeedback, InventoryInput, InventorySelect } from "./ui";

function confirmItemChanges(item: InventoryItem, form: FormData): SaveConfirmation {
  const archived = form.get("archived") === "on";
  if (archived && !item.archived_at) return {
    title: "Archive this item?", description: `Apply the edits and archive ${item.name} if stock and custody are clear.`,
    label: "Confirm archive", destructive: true,
  };
  if (!archived && item.archived_at) return {
    title: "Restore this item?", description: `Apply the edits and return ${item.name} to active inventory.`, label: "Confirm restore",
  };
  return { title: "Save item changes?", description: `Update ${item.name} in the inventory masterlist.`, label: "Confirm save" };
}

export const InventoryItemForm = ({ item, categories, categoryId }: {
  item?: InventoryItem;
  categories: InventoryCategory[];
  categoryId?: string;
}) => {
  const [state, action, pending] = useRecordAction(saveInventoryItem, {}, (result) => result.message);
  return (
    <ReviewableForm action={action} pending={pending} className="space-y-5"
      confirmation={item ? (fields) => confirmItemChanges(item, fields) : undefined}>
      <InventoryFeedback state={state} />
      {item && <><input type="hidden" name="item_id" value={item.id} /><input type="hidden" name="updated_at" value={item.updated_at} /></>}
      <fieldset disabled={pending} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <InventoryInput label="Item code" name="item_code" required maxLength={80} defaultValue={item?.item_code} />
          <InventoryInput label="Item name" name="name" required maxLength={200} defaultValue={item?.name} />
          <InventorySelect label="Category" name="category_id" defaultValue={item?.category_id ?? categoryId ?? ""} required>
            <NativeSelectOption value="" disabled>Choose a category</NativeSelectOption>
            {categories.map((category) => <NativeSelectOption key={category.id} value={category.id}>{category.name}</NativeSelectOption>)}
          </InventorySelect>
          <InventoryInput label="Unit of measure" name="unit" required maxLength={40} defaultValue={item?.unit ?? "unit"} />
          <InventoryInput label="Unit cost (₱)" name="unit_cost" required type="number" step="0.01" min="0" defaultValue={item?.unit_cost ?? 0} />
          <InventoryInput label="Reorder point" name="reorder_point" required type="number" step="0.001" min="0" defaultValue={item?.reorder_point ?? 5} />
          <InventorySelect label="Condition" name="condition" defaultValue={item?.condition ?? "Serviceable"}>
            {inventoryConditions.map((condition) => <NativeSelectOption key={condition} value={condition}>{condition}</NativeSelectOption>)}
          </InventorySelect>
          {!item && <InventoryInput label="Opening quantity" name="opening_quantity" type="number" step="0.001" min="0" defaultValue={0} />}
          <InventoryInput label="Description" name="description" maxLength={1500} defaultValue={item?.description} />
        </div>
        <details className="rounded-lg border p-4">
          <summary className="cursor-pointer font-medium">Property and building details</summary>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {inventoryDetailFields.map(([key, label]) => (
              <InventoryInput key={key} name={key} label={label} maxLength={500} defaultValue={item && inventoryDetail(item, key)} />
            ))}
          </div>
        </details>
        {item && (
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input name="archived" type="checkbox" defaultChecked={Boolean(item.archived_at)} />
            Archive this item when stock and custody are clear
          </label>
        )}
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending} className="min-h-11">
          {pending ? "Saving…" : item ? "Save item details" : "Add item"}
        </Button>
        <EditorCancel disabled={pending} />
      </div>
    </ReviewableForm>
  );
};
