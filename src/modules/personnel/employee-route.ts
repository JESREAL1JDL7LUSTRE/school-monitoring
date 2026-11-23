import { recordSlug } from "@/lib/record-slug";
import type { Employee } from "./database";

export function employeeReference(employee: Pick<Employee, "id" | "employee_no" | "slug">): string {
  return employee.slug ?? recordSlug(employee.employee_no, employee.id);
}
