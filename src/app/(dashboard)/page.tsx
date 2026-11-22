import Link from "next/link";
import { ArrowRight, CalendarDays, ClipboardCheck, Clock3, FileWarning, GraduationCap, Hourglass, IdCard, Package, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { hasPermission, requireSession } from "@/modules/auth/session";
import { getPersonnelOverview } from "@/modules/personnel/queries";
import { filterPersonnel, personnelFilterLabel } from "@/modules/personnel/rules";

const queue = [
  { key: "over", title: "Overdue step increments", hint: "Review eligibility and NOSI progress.", icon: Clock3, color: "warning" },
  { key: "n2", title: "Step increments due in two months", hint: "Prepare notices for upcoming increments.", icon: Hourglass, color: "accent" },
  { key: "exp", title: "Expired licenses", hint: "Follow up on PRC license renewals.", icon: IdCard, color: "warning" },
  { key: "c2", title: "Licenses due for renewal", hint: "Check licenses expiring in the next two months.", icon: IdCard, color: "accent" },
  { key: "inc", title: "Incomplete 201 files", hint: "Open a checklist to see which documents are pending.", icon: FileWarning, color: "accent" },
  { key: "l0", title: "Loyalty awards this year", hint: "Review staff reaching a service milestone.", icon: GraduationCap, color: "accent" },
  { key: "r1", title: "Retirement within a year", hint: "Review staff approaching retirement.", icon: CalendarDays, color: "accent" },
] as const;

const groups = [
  { title: "Employment status", filters: ["permanent", "substitute", "job-order", "cos"] },
  { title: "Classification", filters: ["t", "tr", "n"] },
  { title: "201 file status", filters: ["complete", "inc"] },
  { title: "Loyalty awards", filters: ["l0", "l1"] },
  { title: "Step increments", filters: ["over", "n1", "n2", "ny", "upd"] },
  { title: "Retirement", filters: ["pr", "r1", "r2", "r3"] },
  { title: "PRC licenses", filters: ["exp", "c1", "c2"] },
] as const;

type Overview = Awaited<ReturnType<typeof getPersonnelOverview>>;
type Filter = Parameters<typeof filterPersonnel>[1];
const hrefFor = (filter: Filter) => `/employees?filter=${encodeURIComponent(filter)}`;
const overviewDate = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila", weekday: "long", month: "long", day: "numeric", year: "numeric",
});

function AttentionQueue({ staff, context }: Overview) {
  const rows = queue.map((entry) => ({ ...entry, count: filterPersonnel(staff, entry.key, context).length })).filter(({ count }) => count > 0);

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="border-b bg-muted/40 py-5"><h2 className="text-lg font-semibold tracking-tight">What needs your attention</h2></CardHeader>
      <CardContent className="p-0">
        {rows.length ? <ul className="divide-y">
          {rows.map(({ key, title, hint, icon: Icon, color, count }) => (
            <li key={key}>
              <Link href={hrefFor(key)} className="desk-queue-row group grid min-h-18 grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 p-4 sm:px-6">
                <span className={`desk-queue-icon grid size-10 place-items-center rounded-lg ${color === "warning" ? "desk-queue-warning" : "bg-accent text-accent-foreground"}`}><Icon size={19} aria-hidden /></span>
                <span><span className="block font-semibold leading-snug">{title}</span><span className="mt-0.5 block text-sm text-muted-foreground">{hint}</span></span>
                <span className="flex items-center gap-2 font-semibold tabular-nums sm:gap-3">{count}<ArrowRight size={16} aria-hidden className="text-muted-foreground motion-safe:transition-transform group-hover:translate-x-0.5" /></span>
              </Link>
            </li>
          ))}
        </ul> : <div className="flex items-start gap-3 p-6"><ClipboardCheck size={21} aria-hidden /><p className="text-muted-foreground">No personnel records need attention for this date.</p></div>}
      </CardContent>
    </Card>
  );
}

function RecordCounts({ staff, context }: Overview) {
  return (
    <section aria-labelledby="record-counts" className="space-y-3">
      <h2 id="record-counts" className="text-lg font-semibold tracking-tight">Records at a glance</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-1 2xl:grid-cols-2">
        {groups.map(({ title, filters }) => (
          <Card key={title} size="sm" className="gap-2">
            <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
            <CardContent className="divide-y" >
              {filters.map((filter) => (
                <Link key={filter} href={hrefFor(filter)} className="desk-count-row flex min-h-11 items-center justify-between gap-3 text-sm">
                  <span>{personnelFilterLabel(filter, context)}</span><strong className="tabular-nums">{filterPersonnel(staff, filter, context).length}</strong>
                </Link>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

export default async function DashboardPage() {
  const session = await requireSession();
  const overview = hasPermission(session, "personnel.read") ? await getPersonnelOverview() : null;
  const inventory = hasPermission(session, "inventory.read");
  const date = overview ? new Date(`${overview.context.asOf}T12:00:00+08:00`) : new Date();

  return (
    <div className="space-y-6">
      <header className="desk-date-strip flex flex-wrap items-end justify-between gap-4 rounded-xl border p-5 sm:p-6">
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground"><CalendarDays size={16} aria-hidden />{overviewDate.format(date)}</p>
          <h1 className="desk-heading">Home</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {overview && <Button asChild><Link href="/employees"><Users aria-hidden />Employee records</Link></Button>}
          {inventory && <Button variant="outline" asChild><Link href="/inventory"><Package aria-hidden />Inventory</Link></Button>}
        </div>
      </header>
      {overview ? (
        <div className="grid items-start gap-6 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <AttentionQueue {...overview} />
          <RecordCounts {...overview} />
        </div>
      ) : inventory && (
        <Card><CardHeader><CardTitle>Property and inventory</CardTitle></CardHeader><CardContent><Button asChild><Link href="/inventory">Open inventory overview<ArrowRight aria-hidden /></Link></Button></CardContent></Card>
      )}
    </div>
  );
}
