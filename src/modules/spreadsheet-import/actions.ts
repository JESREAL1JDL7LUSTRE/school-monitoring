"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/modules/auth/session";
import { inventoryConditions } from "@/modules/inventory/database";
import { getInventoryCategories } from "@/modules/inventory/queries";
import { inventoryDetailFields } from "@/modules/inventory/rules";
import { inventoryItemInput } from "@/modules/inventory/validation";
import { classifications, employmentStatuses } from "@/modules/personnel/database";
import { manilaDate } from "@/modules/personnel/rules";
import { optionalDate, profileSchema } from "@/modules/personnel/validation";
import { importFields, type ImportKind } from "./fields";
import { readSpreadsheet } from "./read";

const permission = (kind: ImportKind) => kind === "employees" ? "personnel.write" : "inventory.write";
const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
const canonical = (value: string, choices: readonly string[]) =>
  choices.find((choice) => normalize(choice) === normalize(value)) ?? value;

export async function inspectSpreadsheet(kind: ImportKind, form: FormData) {
  if (kind !== "employees" && kind !== "inventory") return { error: "Choose an import destination." };
  await requirePermission(permission(kind));
  try {
    const { headers, rows } = await readSpreadsheet(form.get("file"));
    const mapping = Object.fromEntries(importFields[kind].map(({ key, label, aliases = [] }) => {
      const names = [key, label, ...aliases].map(normalize);
      const matches = headers.map((header, index) => names.includes(normalize(header)) ? index : -1).filter((index) => index >= 0);
      return [key, matches.length === 1 ? String(matches[0]) : ""];
    }));
    return { headers: headers.map((header) => header.slice(0, 150)), rows: rows.slice(0, 3).map(({ number, values }) =>
      ({ number, values: values.map((value) => value.slice(0, 100)) })), count: rows.length, mapping };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not read the file." };
  }
}

export async function importSpreadsheet(kind: ImportKind, form: FormData) {
  if (kind !== "employees" && kind !== "inventory") return { error: "Choose an import destination." };
  const { supabase } = await requirePermission(permission(kind));
  let sheet;
  try {
    sheet = await readSpreadsheet(form.get("file"));
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not read the file." };
  }
  const columns = importFields[kind].map((field) => {
    const value = form.get(field.key);
    const index = typeof value === "string" && /^\d{1,2}$/.test(value) ? Number(value) : -1;
    return { ...field, index: index < sheet.headers.length ? index : -1 };
  });
  const missing = columns.filter(({ required, index }) => required && index === -1);
  if (missing.length) return { error: "Match a column for " + missing.map(({ label }) => label).join(", ") + "." };

  const input = sheet.rows.map(({ number, values }) => ({
    number, fields: Object.fromEntries(columns.map(({ key, index }) => [key, values[index]?.trim() ?? ""])),
  }));
  const categories = kind === "inventory" ? await getInventoryCategories() : [];
  const categoryIds = new Map(categories.map(({ id, name }) => [name.trim().toLowerCase(), id]));
  const today = manilaDate();
  const errors: string[] = [];
  const ids = new Map<string, number>();
  const employees = [];
  const items = [];
  for (const { number, fields } of input) {
    if (kind === "employees") {
      const profile = profileSchema.safeParse({
        ...fields,
        classification: /^(non.?teaching|non.?teaching personnel)$/i.test(fields.classification)
          ? "NTP" : canonical(fields.classification || "Teaching", classifications),
        employment_status: canonical(fields.employment_status || "Permanent", employmentStatuses),
      });
      const expiry = optionalDate.safeParse(fields.license_expiry);
      if (!profile.success) {
        const issue = profile.error.issues[0];
        errors.push(`Row ${number} · ${columns.find(({ key }) => key === issue.path[0])?.label ?? "Employee"} — ${issue.message}`);
        continue;
      }
      if (!expiry.success || (profile.data.date_of_birth && profile.data.date_of_birth > today)) {
        errors.push(`Row ${number} · ${!expiry.success ? "Use YYYY-MM-DD for PRC license expiry." : "Birth date cannot be in the future."}`);
        continue;
      }
      checkDuplicate(profile.data.employee_no, number);
      employees.push({ profile: profile.data, license_expiry: expiry.data });
    } else {
      const category_id = categoryIds.get(fields.category.toLowerCase());
      if (!category_id) {
        errors.push(`Row ${number} · Use the name of an existing inventory category.`);
        continue;
      }
      const item = inventoryItemInput.safeParse({
        ...fields, category_id,
        condition: canonical(fields.condition || "Serviceable", inventoryConditions),
        reorder_point: fields.reorder_point || 5,
        opening_quantity: fields.opening_quantity || 0,
        details: Object.fromEntries(inventoryDetailFields.map(([key]) => [key, fields[key]])),
      });
      if (!item.success) {
        const issue = item.error.issues[0];
        const label = columns.find(({ key }) => key === issue.path.at(-1))?.label ?? "Inventory item";
        errors.push(`Row ${number} · ${label} — ${issue.message}`);
        continue;
      }
      checkDuplicate(item.data.item_code, number);
      items.push(item.data);
    }
  }
  function checkDuplicate(id: string, row: number) {
    const first = ids.get(id);
    if (first !== undefined) errors.push(`Row ${row} · ${id} also appears on row ${first}.`);
    else ids.set(id, row);
  }

  if (errors.length) return { error: "Fix the spreadsheet and upload it again.", issues: errors };
  const result = kind === "employees"
    ? await supabase.rpc("import_employees", { p_rows: employees })
    : await supabase.rpc("import_inventory_master", { p_rows: items });
  if (result.error) return { error: result.error.code === "23505"
    ? "An employee ID or item code is already in use. The import was rolled back."
    : "The database could not complete the import. The import was rolled back." };
  for (const path of ["/", "/employees", "/inventory", "/nosi", "/reports", "/forms", "/logs", "/super-admin"]) revalidatePath(path);
  revalidatePath("/inventory/reports/[report]", "page");
  revalidatePath("/inventory/transactions/[kind]", "page");
  return { saved: result.data };
}
