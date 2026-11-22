import "server-only";

import { cache } from "react";
import { notFound } from "next/navigation";
import { requirePermission } from "@/modules/auth/session";
import type { InventoryBalance, InventoryCategory, InventoryItem, InventoryKind, PhysicalCount } from "./database";

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

export const getInventoryMaster = cache(async () => {
  const { supabase } = await requirePermission("inventory.read");
  const [categories, items, balances] = await Promise.all([
    readPages((first, last) => supabase.from("inventory_categories").select("*").order("name").range(first, last), "Could not load inventory categories."),
    readPages((first, last) => supabase.from("inventory_items").select("*").order("name").order("id").range(first, last), "Could not load inventory items."),
    readPages((first, last) => supabase.from("inventory_balances").select("*").order("item_id").range(first, last), "Could not load stock balances."),
  ]);
  const categoryMap = new Map(categories.map((category) => [category.id, category]));
  const balanceMap = new Map<string, InventoryBalance>(balances.map((balance) => [balance.item_id, balance]));
  const stockItems: StockItem[] = items.flatMap((item) => {
    const category = categoryMap.get(item.category_id);
    if (!category) return [];
    const balance = balanceMap.get(item.id);
    return [{ ...item, category, balance: balance?.balance ?? 0, totalReceived: balance?.total_received ?? 0 }];
  });
  return { categories, items: stockItems };
});

export const getInventoryDirectory = cache(async () => {
  const { supabase } = await requirePermission("inventory.read");
  const { data, error } = await supabase.rpc("inventory_employee_directory");
  if (error) throw new Error("Could not load employees for inventory issues.");
  return data;
});

export const getInventoryDocuments = cache(async (limit = 25) => {
  const { supabase } = await requirePermission("inventory.read");
  const { data, error } = await supabase.from("inventory_documents").select("*").order("created_at", { ascending: false }).limit(limit);
  if (error) throw new Error("Could not load inventory transactions.");
  return data;
});

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

export const getInventoryIssued = cache(async () => {
  const { supabase } = await requirePermission("inventory.read");
  return readPages((first, last) => supabase.from("inventory_issued_lines").select("*").order("issue_line_id", { ascending: false }).range(first, last),
    "Could not load issued items.");
});

export const getLatestInventoryCounts = cache(async (through?: string) => {
  const { supabase } = await requirePermission("inventory.read");
  const data = await readPages((first, last) => through
    ? supabase.from("physical_counts").select("*").lte("count_date", through).order("count_date").order("created_at").order("id").range(first, last)
    : supabase.from("inventory_latest_counts").select("*").order("item_id").range(first, last), "Could not load physical counts.");
  return new Map<string, PhysicalCount>(data.map((row) => [row.item_id, row]));
});

export const getItemHistory = async (id: string) => {
  const { supabase } = await requirePermission("inventory.read");
  const [{ items }, lines, counts] = await Promise.all([
    getInventoryMaster(),
    readPages((first, last) => supabase.from("inventory_stock_card").select("*").eq("item_id", id)
      .order("transaction_date", { ascending: false }).order("id", { ascending: false }).range(first, last), "Could not load the stock card."),
    readPages((first, last) => supabase.from("physical_counts").select("*").eq("item_id", id)
      .order("count_date", { ascending: false }).order("created_at", { ascending: false }).order("id").range(first, last),
      "Could not load the count history."),
  ]);
  const item = items.find((row) => row.id === id);
  if (!item) notFound();
  return { item, ledger: lines, counts };
};
