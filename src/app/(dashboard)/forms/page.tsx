import Link from "next/link";
import { ArrowRight, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSession } from "@/modules/auth/session";
import { getPersonnelDirectory } from "@/modules/personnel/queries";
import { formatPersonnelDate, manilaDate } from "@/modules/personnel/rules";
import { getTemplate, templates, type Template } from "@/modules/documents/catalog";
import { DraftForm } from "@/modules/documents/draft-form";
import { canAccessForm, listGeneratedDocuments } from "@/modules/documents/queries";
import { notFound, redirect } from "next/navigation";
import { recordId, recordSlug, withRouteQuery } from "@/lib/record-slug";

function TemplateCatalog({ entries }: { entries: Template[] }) {
  const groups = new Map<string, Template[]>();
  for (const entry of entries) {
    const group = groups.get(entry.group);
    if (group) group.push(entry);
    else groups.set(entry.group, [entry]);
  }
  return <div className="grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
    {[...groups].map(([group, entries]) => <Card key={group} className="gap-2">
      <CardHeader><CardTitle>{group}</CardTitle></CardHeader>
      <CardContent className="divide-y">
        {entries.map((entry) => <Link className="desk-count-row flex min-h-11 items-center justify-between gap-2 text-sm" key={entry.slug} href={entry.href ?? `/forms?template=${entry.slug}`}>
          {entry.title}<ArrowRight size={16} aria-hidden className="shrink-0" />
        </Link>)}
      </CardContent>
    </Card>)}
  </div>;
}

export default async function FormsPage({ searchParams }: { searchParams: Promise<{ template?: string; employee?: string; page?: string }> }) {
  const params = await searchParams;
  const session = await requireSession();
  const entries = templates.filter((entry) => canAccessForm(session, entry.scope, "read"));
  if (!entries.length) notFound();

  if (params.template) {
    const template = getTemplate(params.template);
    if (!template || !canAccessForm(session, template.scope, "read")) notFound();
    if (template.href) redirect(template.href);
    const directory = template.employee ? await getPersonnelDirectory() : [];
    const employees = directory.map((entry) => ({ id: entry.id, label: `${entry.full_name} · ${entry.employee_no}` }));
    const selectedId = recordId(params.employee);
    const selected = directory.find(({ id }) => id === selectedId);
    if (selected) {
      const reference = recordSlug(selected.employee_no, selected.id);
      if (params.employee !== reference) redirect(withRouteQuery("/forms", { ...params, employee: reference }));
    }

    return <div className="space-y-5">
      <header className="space-y-3 print:hidden">
        <Button asChild variant="outline"><Link href="/forms">All forms</Link></Button>
        <h1 className="desk-heading">{template.title}</h1>
        <p className="text-muted-foreground">Draft template · School verification required</p>
      </header>
      <DraftForm key={template.slug} template={template} employees={employees} selectedEmployee={selected?.id ?? ""} defaultDate={manilaDate()} canSave={canAccessForm(session, template.scope, "write")} />
    </div>;
  }

  const page = params.page && /^\d{1,5}$/.test(params.page) ? Math.max(1, Number(params.page)) : 1;
  const { drafts, hasNext } = await listGeneratedDocuments(page);
  return <div className="space-y-6">
    <header className="space-y-2"><h1 className="desk-heading">Forms and printing</h1><p className="text-muted-foreground">Choose a template to prepare a printable draft for school review.</p></header>
    <TemplateCatalog entries={entries} />
    <Card>
      <CardHeader><CardTitle>Saved drafts</CardTitle></CardHeader>
      <CardContent>
        <div className="divide-y">
          {drafts.length ? drafts.map((draft) => <Link key={draft.id} href={`/forms/${recordSlug(draft.template_slug, draft.id)}`} className="desk-count-row flex min-h-11 flex-wrap items-center justify-between gap-2 py-1">
            <span className="flex items-center gap-2"><FileText size={16} aria-hidden />{draft.title}</span><span className="text-sm text-muted-foreground">{formatPersonnelDate(draft.created_at)}</span>
          </Link>) : <p className="text-sm text-muted-foreground">No saved drafts on this page.</p>}
        </div>
        {(page > 1 || hasNext) && <nav aria-label="Saved drafts pages" className="mt-4 flex flex-wrap items-center gap-2">
          {page > 1 && <Button asChild variant="outline"><Link href={`/forms?page=${page - 1}`}>Previous page</Link></Button>}
          <p className="px-1 text-sm text-muted-foreground">Page {page}</p>
          {hasNext && <Button asChild variant="outline"><Link href={`/forms?page=${page + 1}`}>Next page</Link></Button>}
        </nav>}
      </CardContent>
    </Card>
  </div>;
}
