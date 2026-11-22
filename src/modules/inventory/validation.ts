import { z } from "zod";
import { categoryTypes, disposalMethods, inventoryConditions, inventoryKinds } from "./database";
import { inventoryDetailFields } from "./rules";

const optionalText = (max: number) => z.string().trim().max(max).default("");
const requiredText = (max: number) => z.string().trim().min(1).max(max);
const decimal = (min: number, max: number, places: number) => z.preprocess(
  (value) => typeof value === "string" && value.trim() ? Number(value) : value,
  z.number().min(min).max(max).refine((value) => Number(value.toFixed(places)) === value),
);

export const quantity = decimal(0, 99999999999.999, 3);
const delta = decimal(-99999999999.999, 99999999999.999, 3);
const cost = decimal(0, 999999999999.99, 2);

export const inventoryItemInput = z.object({
  category_id: z.uuid(),
  item_code: requiredText(80).transform((value) => value.toUpperCase()),
  name: requiredText(200),
  unit: requiredText(40),
  unit_cost: cost,
  reorder_point: quantity,
  condition: z.enum(inventoryConditions),
  description: optionalText(1500),
  details: z.object(Object.fromEntries(inventoryDetailFields.map(([key]) => [key, optionalText(500)]))),
  opening_quantity: quantity,
});

export const inventoryCategoryInput = z.object({
  name: requiredText(120),
  category_type: z.enum(categoryTypes),
});

export const inventoryDocumentInput = z.object({
  kind: z.enum(inventoryKinds),
  date: z.iso.date(),
  employee: z.uuid().optional(),
  reference: z.string().trim().max(500),
  requestId: z.uuid(),
  disposal: z.object({
    method: z.enum(disposalMethods),
    receipt_number: z.string().trim().max(120).optional(),
    proceeds: cost.optional(),
  }).refine((details) => details.proceeds === undefined || Boolean(details.receipt_number)).optional(),
  lines: z.array(z.object({
    item_id: z.uuid(),
    quantity: delta,
    issue_line_id: z.number().int().positive().optional(),
    unit_cost: cost.optional(),
  })).min(1).max(100),
});

export const inventoryCountInput = z.object({
  item: z.uuid(),
  date: z.iso.date(),
  quantity,
  location: z.string().trim().max(200),
  remarks: z.string().trim().max(1000),
});
