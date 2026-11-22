import type { Json, Table } from "@/types/database";

export const categoryTypes = ["supplies", "books", "equipment", "building"] as const;
export const inventoryConditions = ["Serviceable", "For repair", "Unserviceable"] as const;
export const inventoryKinds = ["receipt", "issue", "return", "adjustment", "disposal"] as const;
export const disposalMethods = ["Sale", "Transfer without cost", "Destroy", "Waste material"] as const;
export type InventoryKind = (typeof inventoryKinds)[number];

export type InventoryCategory = {
  id: string;
  name: string;
  category_type: (typeof categoryTypes)[number];
  updated_at: string;
};

export type InventoryItem = {
  id: string;
  category_id: string;
  item_code: string;
  name: string;
  unit: string;
  unit_cost: number;
  reorder_point: number;
  condition: (typeof inventoryConditions)[number];
  description: string;
  details: Json;
  updated_at: string;
  archived_at: string | null;
};

export type InventoryDocument = {
  id: string;
  document_no: string;
  kind: InventoryKind;
  form_type: string;
  transaction_date: string;
  created_by: string | null;
  employee_id: string | null;
  reference: string;
  request_id: string | null;
  request_payload: Json;
  template_version: number;
  snapshot: Json;
  created_at: string;
};

export type InventoryLedgerLine = {
  id: number;
  document_id: string;
  item_id: string;
  quantity_delta: number;
  unit_cost: number;
  issue_line_id: number | null;
};

export type InventoryBalance = { item_id: string; balance: number; total_received: number };

export type InventoryIssuedLine = {
  issue_line_id: number;
  document_id: string;
  document_no: string;
  form_type: string;
  item_id: string;
  employee_id: string;
  employee_name: string;
  transaction_date: string;
  issued_quantity: number;
  returned_quantity: number;
  outstanding: number;
};

export type PhysicalCount = {
  id: string;
  item_id: string;
  count_date: string;
  counted_quantity: number;
  recorded_quantity: number;
  unit_cost: number;
  location: string;
  remarks: string;
  counted_by: string | null;
  created_at: string;
};

export type InventoryTables = {
  inventory_categories: Table<InventoryCategory, never>;
  inventory_items: Table<InventoryItem, never>;
  inventory_documents: Table<InventoryDocument, never>;
  inventory_transactions: Table<InventoryLedgerLine, never>;
  physical_counts: Table<PhysicalCount, never>;
};

export type InventoryViews = {
  inventory_balances: { Row: InventoryBalance; Relationships: [] };
  inventory_issued_lines: { Row: InventoryIssuedLine; Relationships: [] };
  inventory_latest_counts: { Row: PhysicalCount; Relationships: [] };
  inventory_stock_card: {
    Row: InventoryLedgerLine & { document_no: string; kind: InventoryKind; transaction_date: string; running_balance: number };
    Relationships: [];
  };
};

export type InventoryFunctions = {
  post_inventory_document: {
    Args: {
      p_kind: InventoryKind;
      p_date: string;
      p_lines: Json;
      p_employee_id?: string | null;
      p_reference?: string;
      p_request_id?: string | null;
      p_disposal_details?: Json;
    };
    Returns: string;
  };
  record_inventory_count: {
    Args: { p_item_id: string; p_quantity: number; p_date: string; p_location: string; p_remarks: string };
    Returns: string;
  };
  save_inventory_category: {
    Args: { p_id: string | null; p_expected: string | null; p_name: string; p_type: InventoryCategory["category_type"] };
    Returns: string | null;
  };
  save_inventory_item: {
    Args: { p_id: string | null; p_expected: string | null; p_values: Json };
    Returns: string | null;
  };
  import_inventory_master: { Args: { p_rows: Json }; Returns: number };
  employee_custody_summary: {
    Args: { p_employee_id: string };
    Returns: { item_name: string; item_code: string; document_no: string; outstanding: number }[];
  };
  employee_custody_totals: {
    Args: Record<never, never>;
    Returns: { employee_id: string; outstanding: number }[];
  };
};
