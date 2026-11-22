import "server-only";

import { z } from "zod";
import { readRecordCursor, recordCursorPage } from "@/lib/record-cursor";
import { requirePermission } from "@/modules/auth/session";

const firstPage = "/logs?view=audit";

function cursorHref(direction: "older" | "newer", row: { created_at: string; id: string }) {
  return `${firstPage}&${new URLSearchParams({ [direction]: `${row.created_at},${row.id}` })}`;
}

export async function getAuditPage(search: { older?: unknown; newer?: unknown }) {
  const { supabase } = await requirePermission("audit.read");
  const cursor = readRecordCursor(search.newer ?? search.older, z.iso.datetime({ offset: true }));
  const direction = cursor ? (search.newer ? "newer" : "older") : undefined;
  const { data, error } = await supabase.rpc("audit_log_page", cursor
    ? { p_at: cursor[0], p_id: cursor[1], p_newer: direction === "newer" } : {});
  if (error) throw new Error("Could not load audit history.");

  const { rows, previous, next } = recordCursorPage(data, direction);
  return {
    rows,
    previous: previous ? cursorHref("newer", previous) : cursor && !rows.length ? firstPage : undefined,
    next: next ? cursorHref("older", next) : undefined,
  };
}
