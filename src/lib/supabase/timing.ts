const authOperations = new Set(["user", "token", "logout", ".well-known"]);
const databaseOperations = new Set([
  "audit_logs", "calendar_events", "concern_logs", "document_types", "employee_attachments",
  "employee_documents", "employee_licenses", "employee_salary_history", "employees",
  "generated_documents", "document_templates", "inventory_balances", "inventory_categories",
  "inventory_documents", "inventory_issued_lines", "inventory_items", "inventory_item_stock", "inventory_latest_counts",
  "inventory_stock_card", "nosi_records", "physical_counts", "school_settings", "school_identity",
  "get_staff_access", "audit_log_page", "inventory_employee_directory", "recent_inventory_activity",
  "inventory_item_list", "inventory_counts_as_of", "inventory_stock_card_page", "personnel_list_rows", "personnel_list_page",
  "personnel_home_counts", "personnel_workspace_page", "employee_custody_summary",
]);

const operation = (url: URL) => {
  const [, service, , resource, fn] = url.pathname.split("/");
  if (service === "auth") return authOperations.has(resource) ? `auth.${resource}` : "auth";
  if (service === "rest") {
    const name = resource === "rpc" ? fn : resource;
    return databaseOperations.has(name) ? `db.${name}` : "db";
  }
  return service === "storage" ? "storage" : "supabase";
};

export const supabaseTiming = (source: "proxy" | "server"): typeof fetch => {
  if (process.env.SCHOOL_DESK_TRACE !== "1") return fetch;
  return async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input);
    const start = performance.now();
    let status = 0;
    let rows: number | undefined;
    try {
      const response = await fetch(input, init);
      status = response.status;
      const range = /^(\d+)-(\d+)\//.exec(response.headers.get("content-range") ?? "");
      if (range) rows = Number(range[2]) - Number(range[1]) + 1;
      return response;
    } finally {
      console.info(JSON.stringify({ event: "supabase_request", source, operation: operation(url),
        ms: Math.round(performance.now() - start), status, rows }));
    }
  };
};
