import type { Json, Table } from "@/types/database";
import type { FormScope } from "./catalog";

export type GeneratedDocument = {
  id: string;
  template_slug: string;
  template_version: number;
  title: string;
  scope: FormScope;
  employee_id: string | null;
  generated_by: string;
  created_at: string;
  snapshot: Json;
};

export type DocumentsTables = { generated_documents: Table<GeneratedDocument, never, never> };
export type DocumentsFunctions = {
  save_generated_document: { Args: { p_slug: string; p_version: number; p_employee_id: string | null; p_snapshot: Json }; Returns: string };
};
