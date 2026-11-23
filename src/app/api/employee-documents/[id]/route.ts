import { recordId } from "@/lib/record-slug";
import { getSession, hasPermission } from "@/modules/auth/session";

const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };

export async function GET(_: Request, context: RouteContext<"/api/employee-documents/[id]">) {
  const session = await getSession();
  if (!session) return new Response("Sign in to access employee documents.", { status: 401, headers });
  if (!hasPermission(session, "files.read")) return new Response("Document access is restricted.", { status: 403, headers });
  const id = recordId((await context.params).id);
  if (!id) return new Response("Document not found.", { status: 404, headers });

  const { data, error } = await session.supabase.from("employee_attachments").select("storage_path,file_name").eq("id", id).maybeSingle();
  if (error) return new Response("Document access is temporarily unavailable.", { status: 503, headers });
  if (!data) return new Response("Document not found.", { status: 404, headers });

  const { data: signed } = await session.supabase.storage.from("employee-documents")
    .createSignedUrl(data.storage_path, 60, { download: data.file_name });
  if (!signed) return new Response("Document access is temporarily unavailable.", { status: 503, headers });
  return new Response(null, { status: 303, headers: { ...headers, Location: signed.signedUrl } });
}
