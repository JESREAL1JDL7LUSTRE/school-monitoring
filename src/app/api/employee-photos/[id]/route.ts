import { recordId } from "@/lib/record-slug";
import { getSession, hasPermission } from "@/modules/auth/session";
import { employeePhotoBucket, employeePhotoPath } from "@/modules/personnel/photo-storage";

const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };

export async function GET(request: Request, context: RouteContext<"/api/employee-photos/[id]">) {
  const session = await getSession();
  if (!session) return new Response(null, { status: 401, headers });
  if (!hasPermission(session, "personnel.read")) return new Response(null, { status: 403, headers });
  const id = recordId((await context.params).id);
  if (!id) return new Response(null, { status: 404, headers });

  const { data, error } = await session.supabase.from("employees").select("photo_id").eq("id", id).maybeSingle();
  if (error) return new Response(null, { status: 503, headers });
  if (!data?.photo_id || data.photo_id !== new URL(request.url).searchParams.get("v")) {
    return new Response(null, { status: 404, headers });
  }
  const { data: signed } = await session.supabase.storage.from(employeePhotoBucket)
    .createSignedUrl(employeePhotoPath(id, data.photo_id), 60);
  if (!signed) return new Response(null, { status: 503, headers });
  return new Response(null, { status: 303, headers: { ...headers, Location: signed.signedUrl } });
}
