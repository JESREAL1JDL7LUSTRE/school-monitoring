import type { Json, Table } from "@/types/database";
import type { PersonnelContext, PersonnelFilter } from "./rules";

export const employmentStatuses = ["Permanent", "Substitute", "Job Order", "COS"] as const;
export const classifications = ["Teaching", "Teaching Related", "NTP"] as const;
export const checklistStatuses = ["Pending", "Complete", "N/A"] as const;
export const nosiStatuses = ["Not filed", "On-process", "Submitted to D.O.", "Adjusted in payslip"] as const;
export const concernStatuses = ["Open", "In Progress", "Resolved", "Closed"] as const;
export const concernCategories = ["201 Documents", "PRC License", "NOSI", "Loyalty", "Retirement", "Salary", "Other"] as const;
export const concernPriorities = ["Low", "Medium", "High", "Urgent"] as const;

export type Employee = {
  entered_by_email?: string | null;
  id: string;
  slug?: string;
  photo_id?: string | null;
  employee_no: string;
  full_name: string;
  position: string;
  employment_status: typeof employmentStatuses[number];
  classification: typeof classifications[number];
  date_of_birth: string | null;
  date_hired: string | null;
  initial_step_date: string | null;
  checklist_review_date: string | null;
  checklist_remarks: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type DocumentType = { id: number; name: string; sort_order: number; active: boolean };
export type EmployeeDocument = {
  id: string;
  employee_id: string;
  document_type_id: number;
  status: typeof checklistStatuses[number];
  updated_at: string;
};
export type EmployeeAttachment = {
  id: string;
  employee_id: string;
  document_type_id: number;
  storage_path: string;
  file_name: string;
  content_type: string;
  uploaded_at: string;
  uploaded_by: string | null;
};
export type EmployeeLicense = {
  id: string;
  employee_id: string;
  license_type: string;
  license_number: string;
  expiry_date: string;
  updated_at: string;
  is_active: boolean;
};
export type SalaryRecord = {
  id: string;
  employee_id: string;
  grade: number;
  step: number;
  monthly_salary: number;
  effective_from: string;
  reason: string;
  reference_no: string;
  resets_step_date: boolean;
  created_at: string;
  recorded_by: string | null;
};
export type NosiRecord = {
  id: string;
  employee_id: string;
  previous_step_date: string;
  eligibility_date: string;
  status: typeof nosiStatuses[number];
  updated_at: string;
};
export type Concern = {
  id: string;
  employee_id: string;
  description: string;
  assigned_to: string;
  category: typeof concernCategories[number];
  priority: typeof concernPriorities[number];
  status: typeof concernStatuses[number];
  resolved_on: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};
export type EmployeeLeave = {
  id: string;
  employee_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  updated_at: string;
};

export type LeaveDetails = Pick<EmployeeLeave, "leave_type" | "start_date" | "end_date">;

export type PersonnelTables = {
  employees: Table<Employee>;
  document_types: Table<DocumentType>;
  employee_documents: Table<EmployeeDocument>;
  employee_attachments: Table<EmployeeAttachment>;
  employee_licenses: Table<EmployeeLicense>;
  employee_salary_history: Table<SalaryRecord>;
  nosi_records: Table<NosiRecord>;
  concern_logs: Table<Concern>;
  employee_leaves: Table<EmployeeLeave, LeaveDetails & Pick<EmployeeLeave, "employee_id">, LeaveDetails, [{
    foreignKeyName: "employee_leaves_employee_id_fkey";
    columns: ["employee_id"];
    isOneToOne: false;
    referencedRelation: "employees";
    referencedColumns: ["id"];
  }]>;
};
export type PersonnelFunctions = {
  personnel_home_counts: { Args: Record<never, never>; Returns: {
    as_of: string; reporting_year: number; facets: Partial<Record<PersonnelFilter, number>>;
  }[] };
  personnel_list_rows: { Args: PersonnelListContext; Returns: PersonnelListRow[] };
  personnel_list_page: { Args: PersonnelListContext & { p_q: string; p_filter: PersonnelFilter; p_offset: number; p_limit: number }; Returns: PersonnelListPage };
  personnel_workspace_page: {
    Args: { p_q: string; p_filter: PersonnelFilter; p_offset: number; p_limit: number };
    Returns: { context: PersonnelContext; result: PersonnelListPage }[];
  };
  inventory_employee_directory: { Args: Record<PropertyKey, never>; Returns: Pick<Employee, "id" | "employee_no" | "full_name">[] };
  import_employees: { Args: { p_rows: Json }; Returns: number };
  create_employee: { Args: { p_profile: Json; p_salary?: Json; p_license_expiry?: string }; Returns: string };
};

type PersonnelListContext = {
  p_as_of: string; p_reporting_year: number; p_step_months: number;
  p_retirement_age: number; p_loyalty_first: number; p_loyalty_interval: number;
};

export type PersonnelListRow = {
  id: string;
  full_name: string;
  employee: Employee;
  checklist_done: number;
  checklist_total: number;
  license_expiry: string | null;
  current_salary: SalaryRecord | null;
  step_date: string | null;
  nosi_status: NosiRecord["status"];
  nosi_updated_at: string | null;
  nosi_id: string | null;
  custody_quantity: number;
  filter_keys: PersonnelFilter[];
};
type PersonnelListPage = { rows: PersonnelListRow[]; total: number; facets: Partial<Record<PersonnelFilter, number>> };
