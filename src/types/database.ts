import type { Role, Permission } from "@/modules/auth/permissions";
import type { PersonnelFunctions, PersonnelTables } from "@/modules/personnel/database";
import type { InventoryFunctions, InventoryTables, InventoryViews } from "@/modules/inventory/database";
import type { DocumentsFunctions, DocumentsTables } from "@/modules/documents/database";
import type { CalendarTables } from "@/modules/calendar/database";

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Table<Row, Insert = Partial<Row>, Update = Partial<Insert>, Relationships = []> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: Relationships;
};

export type SchoolSettings = {
  id: number;
  school_name: string;
  division: string;
  region: string;
  school_code: string;
  school_head: string;
  administrative_officer: string;
  disbursing_officer: string;
  inventory_chair: string;
  superintendent: string;
  coa_auditor: string;
  prepared_by: string;
  reference_date: string | null;
  reporting_year: number | null;
  step_interval_months: number;
  retirement_age: number;
  loyalty_first_years: number;
  loyalty_interval_years: number;
  ppe_threshold: number;
  semi_expendable_threshold: number;
  salary_estimate_percent: number;
  logo_path: string | null;
  updated_at: string;
};

export type AuditLog = {
  id: number;
  user_id: string | null;
  action: "INSERT" | "UPDATE" | "DELETE";
  entity_type: string;
  entity_id: string | null;
  old_values: Json | null;
  new_values: Json | null;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      audit_logs: Table<AuditLog, never, never>;
      school_settings: Table<SchoolSettings, never, never>;
      staff_roles: Table<{ user_id: string; role: Role; created_at: string }, never, never>;
    } & PersonnelTables & InventoryTables & DocumentsTables & CalendarTables;
    Views: InventoryViews & {
      school_identity: { Row: Pick<SchoolSettings, "school_name" | "region" | "division">; Relationships: [] };
    };
    Functions: {
      get_staff_access: { Args: Record<never, never>; Returns: { roles: Role[]; permissions: Permission[] } };
      audit_log_page: {
        Args: { p_at?: string; p_id?: string; p_newer?: boolean };
        Returns: (Omit<AuditLog, "id" | "old_values" | "new_values"> & { id: string })[];
      };
      has_permission: { Args: { permission: Permission }; Returns: boolean };
      list_staff_roles: { Args: Record<never, never>; Returns: { email: string; roles: Role[] }[] };
      update_staff_role: {
        Args: { target_email: string; target_role: Role; enabled: boolean };
        Returns: "account_missing" | "last_administrator" | "protected_administrator" | "saved";
      };
      update_school_settings: { Args: { expected_updated_at: string; changes: Json }; Returns: boolean };
    } & PersonnelFunctions & InventoryFunctions & DocumentsFunctions;
    Enums: { staff_role: Role };
    CompositeTypes: Record<never, never>;
  };
};
