import { inventoryDetailFields } from "@/modules/inventory/rules";

export type ImportKind = "employees" | "inventory";
export type ImportField = { key: string; label: string; required?: boolean; aliases?: string[] };

export const importFields: Record<ImportKind, ImportField[]> = {
  employees: [
    { key: "employee_no", label: "Employee ID", required: true, aliases: ["Employee No", "Employee Number"] },
    { key: "full_name", label: "Full name", required: true, aliases: ["Name", "Employee name"] },
    { key: "position", label: "Position", required: true },
    { key: "classification", label: "Classification" },
    { key: "employment_status", label: "Employment status" },
    { key: "date_of_birth", label: "Birth date", aliases: ["Date of birth", "Birthday"] },
    { key: "date_hired", label: "Hire date", aliases: ["Date hired"] },
    { key: "initial_step_date", label: "Last step date" },
    { key: "license_expiry", label: "PRC license expiry" },
  ],
  inventory: [
    { key: "item_code", label: "Item code", required: true },
    { key: "name", label: "Name", required: true, aliases: ["Item name"] },
    { key: "category", label: "Category", required: true },
    { key: "unit", label: "Unit", required: true },
    { key: "unit_cost", label: "Unit cost", required: true },
    { key: "reorder_point", label: "Reorder point" },
    { key: "condition", label: "Condition" },
    { key: "description", label: "Description" },
    { key: "opening_quantity", label: "Opening quantity" },
    ...inventoryDetailFields.map(([key, label]) => ({ key, label })),
  ],
};
