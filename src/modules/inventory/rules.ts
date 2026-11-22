import type { InventoryCategory, InventoryItem } from "./database";
import type { SchoolSettings } from "@/types/database";

export const dateInManila = () => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date());

export const money = (amount: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(amount);

export const classifyItem = (
  item: Pick<InventoryItem, "unit_cost">,
  categoryType: InventoryCategory["category_type"],
  rules: Pick<SchoolSettings, "ppe_threshold" | "semi_expendable_threshold">,
) => {
  if (categoryType === "supplies") return { form: "RIS", label: "Consumable" };
  if (categoryType === "building" || item.unit_cost >= rules.ppe_threshold) return { form: "PAR", label: "PPE" };
  return {
    form: "ICS",
    label: item.unit_cost > rules.semi_expendable_threshold ? "High-value semi-expendable" : "Low-value semi-expendable",
  };
};

export const inventoryDetailFields = [
  ["old", "Old property number"], ["location", "Location or whereabouts"], ["remarks", "Remarks"],
  ["design", "Building type or design"], ["year", "Year completed"], ["storeys", "Number of storeys"],
  ["rooms", "Number of classrooms"], ["area", "Floor area (sq m)"], ["fund", "Funding source"],
  ["title", "Lot or title number"], ["serial", "Serial or model number"],
  ["acquired_on", "Acquisition date"], ["useful_life", "Useful life"],
  ["grade_level", "Grade level"], ["author_subject", "Author or subject"],
  ["supplier", "Supplier"], ["received_on", "Received date"], ["delivery_receipt", "Delivery receipt number"],
  ["donor", "Donor"], ["donation_certificate", "Certificate of donation number"],
] as const;

export const inventoryDetail = (item: Pick<InventoryItem, "details">, key: string) => {
  const details = item.details;
  if (!(details && typeof details === "object" && !Array.isArray(details))) return "";
  const value = details[key];
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
};

export const inventoryKindLabels = {
  receipt: "Receipt",
  issue: "Issue stock",
  return: "Return stock",
  adjustment: "Adjustment",
  disposal: "Disposal",
} as const;
