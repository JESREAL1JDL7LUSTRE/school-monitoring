import { z } from "zod";

const documentLine = z.object({
  item_id: z.uuid(),
  item_code: z.string(),
  name: z.string(),
  category: z.string(),
  unit: z.string(),
  quantity: z.number(),
  unit_cost: z.number(),
  classification: z.string().optional(),
  issue_document_no: z.string().nullable().optional(),
});

export const inventorySnapshot = z.object({
  school: z.object({
    school_name: z.string(),
    division: z.string(),
    region: z.string(),
    school_code: z.string(),
    administrative_officer: z.string(),
    school_head: z.string(),
    inventory_chair: z.string(),
    coa_auditor: z.string(),
    disbursing_officer: z.string(),
    logo_path: z.string().nullable(),
  }),
  employee_name: z.string().nullable(),
  lines: z.array(documentLine),
  disposal: z.object({
    method: z.string(),
    receipt_number: z.string().optional(),
    proceeds: z.number().optional(),
  }).nullable().optional(),
});

export type InventorySnapshot = z.infer<typeof inventorySnapshot>;
