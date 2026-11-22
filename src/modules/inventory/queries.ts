import "server-only";

import { cache } from "react";
import { notFound } from "next/navigation";
import { z } from "zod";
import { readRecordCursor, recordCursorPage } from "@/lib/record-cursor";
import { requirePermission } from "@/modules/auth/session";
import type { InventoryCategory, InventoryFunctions, InventoryItem, InventoryItemStock, InventoryKind, PhysicalCount } from "./database";

export type StockItem = InventoryItem & {
  category: InventoryCategory;
  balance: number;
  totalReceived: number;
};

const readPages = async <T>(
  load: (first: number, last: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  errorMessage: string,
): Promise<T[]> => {
  const pageSize = 500;
  const result: T[] = [];
  for (let first = 0; ; first += pageSize) {
    const { data, error } = await load(first, first + pageSize - 1);
    if (error || !data) throw new Error(errorMessage);
    result.push(...data);
    if (data.length < pageSize) return result;
  }
};

export const getInventoryCategories = cache(async () => {
  const { supabase } = await requirePermission("inventory.read");
  return readPages((first, last) => supabase.from("inventory_categories").select("*").order("name").order("id")
    .range(first, last), "Could not load inventory categories.");
});

const withCategories = (rows: InventoryItemStock[], categories: InventoryCategory[]): StockItem[] => {
  const categoryMap = new Map(categories.map((category) => [category.id, category]));
  return rows.flatMap(({ total_received, ...item }) => {
    const category = categoryMap.get(item.category_id);
    return category ? [{ ...item, category, totalReceived: total_received }] : [];
  });
};

export const getInventoryMaster = cache(async () => {
  const { supabase } = await requirePermission("inventory.read");
  const [categories, rows] = await Promise.all([
    getInventoryCategories(), readPages((first, last) => supabase.from("inventory_item_stock").select("*")
      .order("name").order("id").range(first, last), "Could not load inventory items."),
  ]);
  return { categories, items: withCategories(rows, categories) };
});

type ItemFilters = InventoryFunctions["inventory_item_list"]["Args"];

export async function getInventoryItemsPage(filters: ItemFilters, page: number, pageSize: number) {
  const { supabase } = await requirePermission("inventory.read");
  const first = (page - 1) * pageSize;
  const [{ data, count, error }, categories] = await Promise.all([
    supabase.rpc("inventory_item_list", filters, { count: "exact" }).order("name").order("id")
      .range(first, first + pageSize - 1), getInventoryCategories(),
  ]);
  if (error?.code === "PGRST103") {
    // An empty, out-of-range page has no count on some PostgREST versions.
    const head = await supabase.rpc("inventory_item_list", filters, { count: "exact", head: true });
    if (head.error) throw new Error("Could not load inventory items.");
    return { items: [], categories, total: head.count ?? 0 };
  }
  if (error) throw new Error("Could not load inventory items.");
  return { items: withCategories(data, categories), categories, total: count ?? 0 };
}

export const getInventoryItem = cache(async (id: string) => {
  const { supabase } = await requirePermission("inventory.read");
  const { data, error } = await supabase.from("inventory_item_stock").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error("Could not load this inventory item.");
  if (!data) notFound();
  const { data: category, error: categoryError } = await supabase.from("inventory_categories")
    .select("*").eq("id", data.category_id).single();
  if (categoryError) throw new Error("Could not load this inventory category.");
  return { ...data, category, totalReceived: data.total_received };
});

export const getInventoryDirectory = cache(async () => {
  const { supabase } = await requirePermission("inventory.read");
  return readPages((first, last) => supabase.rpc("inventory_employee_directory").order("full_name").order("id").range(first, last),
    "Could not load employees for inventory issues.");
});

export const getInventoryDocuments = async (filters: ItemFilters & { p_item?: string } = {}) => {
  const { supabase } = await requirePermission("inventory.read");
  const { data, error } = await supabase.rpc("recent_inventory_activity", filters);
  if (error) throw new Error("Could not load inventory transactions.");
  return data;
};

export const getInventoryReportDocuments = async ({ kind, from, through, reference }: {
  kind: InventoryKind;
  from?: string;
  through?: string;
  reference?: string;
}) => {
  const { supabase } = await requirePermission("inventory.read");
  return readPages((first, last) => {
    let query = supabase.from("inventory_documents").select("*").eq("kind", kind);
    if (from) query = query.gte("transaction_date", from);
    if (through) query = query.lte("transaction_date", through);
    if (reference) query = query.eq("reference", reference);
    return query.order("transaction_date").order("id").range(first, last);
  }, "Could not load the report transactions.");
};

export const getInventoryDocument = async (id: string) => {
  if (!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(id)) notFound();
  const { supabase } = await requirePermission("inventory.read");
  const { data, error } = await supabase.from("inventory_documents").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error("Could not load this inventory document.");
  if (!data) notFound();
  return data;
};

export const getInventoryIssued = cache(async (from?: string, through?: string) => {
  const { supabase } = await requirePermission("inventory.read");
  return readPages((first, last) => {
    let query = supabase.from("inventory_issued_lines").select("*");
    if (from) query = query.gte("transaction_date", from);
    if (through) query = query.lte("transaction_date", through);
    return query.order("issue_line_id", { ascending: false }).range(first, last);
  }, "Could not load issued items.");
});

export const getLatestInventoryCounts = cache(async (through?: string) => {
  const { supabase } = await requirePermission("inventory.read");
  const data = await readPages((first, last) => through
    ? supabase.rpc("inventory_counts_as_of", { p_through: through }).order("item_id").range(first, last)
    : supabase.from("inventory_latest_counts").select("*").order("item_id").range(first, last), "Could not load physical counts.");
  return new Map<string, PhysicalCount>(data.map((row) => [row.item_id, row]));
});

export const getItemLedger = async (id: string) => {
  const { supabase } = await requirePermission("inventory.read");
  return readPages((first, last) => supabase.from("inventory_stock_card").select("*").eq("item_id", id)
    .order("transaction_date", { ascending: false }).order("id", { ascending: false }).range(first, last), "Could not load the stock card.");
};

export async function getItemLedgerPage(id: string, search: { older?: unknown; newer?: unknown }) {
  const { supabase } = await requirePermission("inventory.read");
  const cursor = readRecordCursor(search.newer ?? search.older, z.iso.date());
  const direction = cursor ? (search.newer ? "newer" : "older") : undefined;
  const { data, error } = await supabase.rpc("inventory_stock_card_page", cursor
    ? { p_item: id, p_date: cursor[0], p_id: cursor[1], p_newer: direction === "newer" } : { p_item: id });
  if (error) throw new Error("Could not load the stock card.");
  return { ...recordCursorPage(data, direction), emptyCursor: Boolean(cursor && !data.length) };
}

export async function getItemCounts(id: string) {
  const { supabase } = await requirePermission("inventory.read");
  return readPages((first, last) => supabase.from("physical_counts").select("*").eq("item_id", id)
    .order("count_date", { ascending: false }).order("created_at", { ascending: false }).order("id").range(first, last),
  "Could not load the count history.");
}
