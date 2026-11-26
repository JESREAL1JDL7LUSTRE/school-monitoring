import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requirePermission } from "@/modules/auth/session";
import type { Json } from "@/types/database";
import { ActivityRefresh } from "./activity-refresh";

const name = (key: string) => key.replaceAll("_", " ");
const text = (value: string | string[] | undefined) => typeof value === "string" ? value.trim().slice(0, 254) : "";
const formatTime = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" });
const columns = (titles: string[]) => <TableHeader><TableRow>{titles.map((title) =>
  <TableHead key={title}>{title}</TableHead>)}</TableRow></TableHeader>;

function Values({ value }: { value: Json }) {
  if (value === null || value === "") return <span>—</span>;
  if (typeof value !== "object") return <>{String(value)}</>;
  if (Array.isArray(value)) return <ul className="list-disc space-y-2 pl-4">{value.map((item, i) =>
    <li key={i}><Values value={item} /></li>)}</ul>;
  return <dl className="grid gap-2">{Object.entries(value).filter(([, v]) => v !== undefined).map(([key, v]) =>
    <div key={key}><dt className="capitalize text-muted-foreground">{name(key)}</dt>
      <dd className="whitespace-normal break-words"><Values value={v ?? null} /></dd></div>)}</dl>;
}

export default async function SuperAdminPage({ searchParams }: PageProps<"/super-admin">) {
  const { supabase } = await requirePermission("super_admin.read");
  const search = await searchParams;
  const activity = search.view === "activity";
  const q = text(search.q);
  const email = text(search.email);
  const page = Math.min(100000, Math.max(1, Number.parseInt(text(search.page)) || 1));
  const offset = (page - 1) * 25;
  const before = text(search.before);
  const params = new URLSearchParams({ view: activity ? "activity" : "records" });
  if (q) params.set("q", q);
  if (email) params.set("email", email);
  const href = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    next.set(key, value);
    return "/super-admin?" + next;
  };
  let records = supabase.from("super_admin_records").select("*").order("kind").order("record_id");
  if (q) records = records.ilike("label", "%" + q + "%");
  if (email) records = records.eq("entered_by_email", email);
  const [summary, entries, events] = await Promise.all([
    supabase.rpc("super_admin_overview"),
    activity ? null : records.range(offset, offset + 25),
    activity ? supabase.rpc("super_admin_activity", { p_query: q, p_email: email,
      ...(/^\d{1,18}$/.test(before) ? { p_before: before } : {}) }) : null,
  ]);
  if (!summary.data || entries?.error || events?.error) throw new Error("Could not load the Super Admin console.");
  const { accounts, employees, inventory, week } = summary.data;
  const ceiling = Math.max(1, ...week.map((day) => day.changes));
  const rows = entries?.data ?? [];
  const log = events?.data ?? [];
  return <div className="space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="desk-heading">Super Admin</h1>
      <Button variant="outline" asChild><Link href="/settings/access">Manage staff accounts</Link></Button>
    </header>
    <Card><CardHeader><CardTitle>School operations</CardTitle></CardHeader><CardContent className="grid gap-6 md:grid-cols-2">
      <dl className="grid grid-cols-3 gap-3">{[["Staff accounts",accounts],["Active employees",employees],["Active inventory items",inventory]].map(([label,n]) =>
        <div key={label}><dt className="text-sm text-muted-foreground">{label}</dt><dd className="text-2xl font-semibold tabular-nums">{n}</dd></div>)}</dl>
      <figure><figcaption className="mb-2 text-sm font-medium">Recorded changes in the past 7 days</figcaption>
        <div className="flex items-end gap-2">{week.map(({ day, changes }) => <div key={day} className="min-w-0 flex-1 text-center text-xs tabular-nums">
          <span>{changes}</span><div className="mx-auto my-1 w-full max-w-10 rounded-sm bg-primary" style={{ height: 1 + 42 * changes / ceiling }} />
          <time dateTime={day}>{day.slice(5)}</time></div>)}</div></figure>
    </CardContent></Card>
    <nav aria-label="Super Admin sections" className="flex gap-2">
      <Button asChild variant={activity ? "outline" : "default"}><Link href="/super-admin">All records</Link></Button>
      <Button asChild variant={activity ? "default" : "outline"}><Link href="/super-admin?view=activity">Activity log</Link></Button>
    </nav>
    <Card><CardHeader><CardTitle>{activity ? "Staff activity" : "School records"}</CardTitle>{activity && <ActivityRefresh />}</CardHeader>
      <CardContent className="space-y-4">
        <form className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="view" value={activity ? "activity" : "records"} />
          <div className="grid gap-1"><Label htmlFor="query">{activity ? "Action, record type or ID" : "Record name"}</Label><Input id="query" name="q" defaultValue={q} /></div>
          <div className="grid gap-1"><Label htmlFor="email">{activity ? "Changed by" : "Entered by"}</Label><Input id="email" type="email" name="email" placeholder="Staff email" defaultValue={email} /></div>
          <Button type="submit">Filter</Button>
          {(q || email) && <Button variant="link" asChild><Link href={activity ? "/super-admin?view=activity" : "/super-admin"}>Clear filters</Link></Button>}
        </form>
        <Table>{activity ? columns(["Time (Manila)", "Action", "Record", "Changed by", "Entered by"]) : columns(["Record", "Type", "Entered by"])}
          <TableBody>{activity ? log.slice(0,25).map((row) => <TableRow key={row.event_id}>
            <TableCell>{formatTime.format(new Date(row.changed_at))}</TableCell><TableCell>{row.operation}</TableCell>
            <TableCell><details><summary className="cursor-pointer">{name(row.kind)}</summary><div className="min-w-56 space-y-3 py-2">
              <p>Record ID {row.record_id}</p>{row.before_values && <div><strong>Before</strong><Values value={row.before_values} /></div>}
              {row.after_values && <div><strong>After</strong><Values value={row.after_values} /></div>}</div></details></TableCell>
            <TableCell>{row.actor ?? "System or unrecorded"}</TableCell><TableCell>{row.entered_by ?? "Unrecorded"}</TableCell>
          </TableRow>) : rows.slice(0,25).map((row) => <TableRow key={row.kind+row.record_id}>
            <TableCell><details><summary className="cursor-pointer whitespace-normal font-medium">{row.label}</summary><div className="max-w-xl py-3"><Values value={row.details} /></div></details></TableCell>
            <TableCell>{name(row.kind)}</TableCell><TableCell>{row.entered_by_email ?? (row.kind === "inventory_categories" && /^22000000-0000-4000-8000-0000000000(0[1-9]|1[0-5])$/.test(row.record_id) ? "School default" : "Unrecorded")}</TableCell></TableRow>)}</TableBody>
        </Table>
        {!rows.length && !log.length && <p className="text-sm text-muted-foreground">No matching {activity ? "activity" : "records"}.</p>}
        <div className="flex gap-2">{!activity && page > 1 && <Button asChild variant="outline"><Link href={href("page",String(page-1))}>Previous</Link></Button>}
          {activity && before && <Button asChild variant="outline"><Link href={"/super-admin?"+params}>Latest activity</Link></Button>}
          {(rows.length > 25 || log.length > 25) && <Button asChild variant="outline"><Link href={activity ? href("before",log[24].event_id) : href("page",String(page+1))}>Next</Link></Button>}</div>
      </CardContent></Card>
  </div>;
}
