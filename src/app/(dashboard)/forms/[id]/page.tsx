import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { recordId, recordSlug, withRouteQuery } from "@/lib/record-slug";
import { DocumentPaper } from "@/modules/documents/paper";
import { PrintButton } from "@/modules/documents/print-button";
import { readGeneratedDocument } from "@/modules/documents/queries";

export default async function SavedDraftPage({ params, searchParams }: PageProps<"/forms/[id]">) {
  const { id: reference } = await params;
  const id = recordId(reference);
  if (!id) notFound();
  const draft = await readGeneratedDocument(id);
  const canonical = recordSlug(draft.template_slug, id);
  if (reference !== canonical) redirect(withRouteQuery(`/forms/${canonical}`, await searchParams));

  return <div className="mx-auto max-w-4xl space-y-4 print:max-w-none">
    <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
      <Button asChild variant="outline"><Link href="/forms">All forms</Link></Button>
      <PrintButton />
    </div>
    <DocumentPaper title={draft.title} version={draft.template_version} snapshot={draft.snapshot} logoUrl={draft.logoUrl} />
  </div>;
}
