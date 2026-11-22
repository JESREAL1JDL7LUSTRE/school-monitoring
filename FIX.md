# School Admin Desk: Best-Practice Fixes Playbook

Companion to `docs/data-fetching-and-crud-report.md` (reviewed at commit `9d2bef9`).
This file turns the report's priorities 0–5 into concrete fixes, code sketches, tests and rollback notes.

> **Read this first**
> - Table, column and function names in the SQL and TypeScript below are **illustrative**. Adapt them to your real schema and helpers.
> - The report confirms a region mismatch (ingress `sin1`, function `iad1`, database Seoul `ap-northeast-2`), but the **savings from fixing it are unmeasured**. Never promise a number before the preview canary is compared.
> - Local data is tiny (41 employees, 63 inventory rows, executor times of 3–7 ms). Hosted pages take 2–3.5 s. At today's volume the cost is **round trips and distance**, not row volume. Pagination protects you from future growth; it will not fix today's seconds.

---

## 0. Order of work

| Step | Fix | Why this position | Risk |
| --- | --- | --- | --- |
| 0 | Trace hosted latency (spans + repeatable benchmark) | You cannot compare fixes without a baseline | None |
| 1 | Region co-location canary, then `getClaims()` in the proxy, parallel reads, streamed shell | Biggest likely win, small code change | Low–medium (auth) |
| 2 | Inventory correctness bugs | Wrong or truncated data is worse than slow data | Low |
| 3 | Database filtering and pagination for lists and reports | Scaling insurance, bigger refactor | Medium |
| 4 | Narrow writes and revalidation | Faster post-save feedback | Medium |
| 5 | Calendar local day selection | Small polish | Low |

Ship each step behind its own PR, measure after each one, and keep the previous behavior one revert away.

---

## 1. Step 0: Trace hosted latency

### 1.1 Goal
Know which hop costs what: proxy Auth, render Auth, role RPC, settings read, each route query group, assembly, streaming, browser work.

### 1.2 Lightweight span helper

```ts
// src/lib/timing.ts
export async function span<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const t0 = performance.now();
  try {
    return await fn();
  } finally {
    // Log label and duration ONLY. Never log cookies, tokens, signed URLs,
    // employee fields or any record values.
    console.log(JSON.stringify({ evt: "span", label, ms: Math.round(performance.now() - t0) }));
  }
}
```

Wrap the hops you care about:

```ts
const user    = await span("render.auth.getUser", () => supabase.auth.getUser());
const access  = await span("rpc.get_staff_access", () => supabase.rpc("get_staff_access"));
const school  = await span("db.school_settings", () => getSchoolSettings());
```

For query hops also record **page count and row count** (numbers only).

### 1.3 Better option: OpenTelemetry
Next.js supports `instrumentation.ts`. On Vercel, `@vercel/otel` gives per-request traces including fetches to Supabase. Use this if you want waterfalls instead of log lines.

### 1.4 Benchmark protocol (matches report priority 0)
- At least **10 passes** per route, condition and environment; report **median and p95**. Treat p95 from 10 samples as descriptive.
- Separate **cold direct loads**, **warm in-app links** and **filter navigations**.
- Same role, same build, same synthetic data on local and preview. Use two seeds: small, and a large fixture (for example 2,000 employees, 20,000 inventory ledger lines).
- Capture: Navigation Timing (`responseStart`, `firstInterimResponseStart`, `finalResponseHeadersStart`), response/RSC bytes, server spans, query row counts.
- Use **final response headers** and a **usable-content marker** (for example first employee link visible), not first response start. Early Hints (103) make `responseStart` misleading, as the report found.
- Read-only navigation on production. Writes on local or preview only.

### 1.5 Done when
A table of median/p95 per route per condition exists and every hosted route has a per-hop breakdown.

---

## 2. Step 1: Latency fixes (test each in a preview first)

### 2.1 Co-locate compute with the database

**Problem:** browser → Singapore edge → function in Washington, D.C. → database in Seoul. Every sequential query pays the long hop, and the layout runs several in series.

**Fix options (pick one after the canary):**
1. Move the function region to Seoul (`icn1`).
2. Or move the Supabase project to a region near the function (heavier, data migration; only if Seoul compute is unavailable on your plan).

```jsonc
// vercel.json
{
  "regions": ["icn1"]
}
```

Check your Vercel plan's region limits and verify after deploy that the `x-vercel-id` header shows `...::icn1::...`.

**Canary procedure**
1. Deploy a preview with `regions: ["icn1"]`.
2. Point it at a Supabase project in Seoul with the **same synthetic data and roles** as the baseline.
3. Run the Step 0 benchmark on both.
4. Compare per-hop spans and usable-content times. Only then decide on production.

**Rollback:** revert `vercel.json`.

### 2.2 Use `getClaims()` in the proxy (test separately from the region change)

**Problem:** the proxy calls `getUser()` (a network call to Auth), then the render calls `getUser()` again, then `get_staff_access`.

**Fix:** let the proxy verify the JWT locally, and keep the authoritative check where data is touched.

```ts
// src/proxy.ts (sketch, adapt to your existing cookie handling)
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Verifies the signature locally when the project uses asymmetric keys
  // (your JWKS lists ES256). Refreshes the session if the token is expired.
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims && !request.nextUrl.pathname.startsWith("/login")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return response;
}
```

**Rules that keep this safe**
- Signed claims prove the token is valid, **not** that the account is still enabled or that roles are current. Keep the server session helper's `getUser()` and the live `get_staff_access` role lookup until regression tests pass.
- A cold JWKS fetch, key rotation or symmetric signing falls back to a network call. Measure on the preview.
- Do **not** embed roles in the access token unless you have a proven revocation design (a revoked user must lose private records, file downloads and writes within your required window).

**Regression tests:** expired token + refresh, sign-out, disabled user, revoked role (read, file download, write), tampered cookie.

**Rollback:** switch the proxy back to `getUser()`.

### 2.3 Remove the second round trip inside the render (optional, measure first)
If traces show `getUser()` + `get_staff_access` + settings as three serial hops, test a single RPC that returns the minimum shell context (role names, permission flags, school name) in one call. Keep authorization inside the function (`security invoker`, explicit checks) and keep it request-scoped (`React.cache`).

### 2.4 Start independent reads together

```ts
// BAD: second block waits for the first
const master = await getInventoryMaster();
const recent = view === "recent" ? await getRecentActivity(filters) : null;

// GOOD: decide from the URL param, start everything at once
const masterP = getInventoryMaster();
const recentP = view === "recent" ? getRecentActivity(filters) : Promise.resolve(null);
const issuedP = view === "issued" ? getIssuedLines(filters) : Promise.resolve(null);
const countsP = view === "counts" ? getCounts(filters) : Promise.resolve(null);

const [master, recent, issued, counts] = await Promise.all([masterP, recentP, issuedP, countsP]);
```

Only the master's own consumers should depend on it. Reads that depend only on `view` and `searchParams` should never wait for it.

### 2.5 Stream the shell, do not block it on settings

```tsx
// (dashboard)/layout.tsx
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession(); // required: gates everything below

  return (
    <div className="shell">
      <Suspense fallback={<SchoolIdentitySkeleton />}>
        <SchoolIdentity /> {/* awaits settings internally */}
      </Suspense>
      <Nav permissions={session.permissions} />
      <main id="main-content">{children}</main>
    </div>
  );
}
```

- Give the fallback a fixed size so the layout does not shift.
- Permission checks still run **before** protected content renders.
- Add `loading.tsx` per heavy route so the heading and skeleton appear while data loads.

### 2.6 Cache the school identity only if it is provably safe
Candidate: a **minimal singleton projection** (school name, region, division) visible identically to every authorized role.

- Keep authorization **outside** the shared cache.
- Never cache private logos or signed URLs in a shared cache.
- Invalidate on committed edits with `updateTag("school-identity")` inside the settings Server Action (read-your-own-writes). `revalidateTag(..., "max")` serves stale data during background refresh, which is fine for rarely-viewed data but not for "I just saved this".
- Note: cached functions cannot read request cookies, so the cached read needs a client that does not depend on the user's session. Only do this if the data is genuinely readable by all staff roles, and re-verify after role revocation.

If streaming (2.5) already hides the cost, **skip caching**.

---

## 3. Step 2: Inventory correctness fixes

These are bugs, not just speed issues. Fix them even if latency work is still in progress.

### 3.1 Recent activity must filter before `LIMIT 25`

**Bug:** newest 25 documents globally → then filter by category/item → older matches vanish.

**Fix:** filter in SQL first, avoid duplicate documents when several lines match, order stably.

```sql
create or replace function public.recent_inventory_documents(
  p_category uuid default null,
  p_item     uuid default null,
  p_limit    int  default 25
)
returns table (id uuid, kind text, created_at timestamptz)
language sql stable security invoker
as $$
  select d.id, d.kind, d.created_at
  from public.inventory_documents d
  where (p_category is null and p_item is null)
     or exists (
          select 1
          from public.inventory_ledger_lines l
          join public.inventory_items i on i.id = l.item_id
          where l.document_id = d.id
            and (p_item is null or l.item_id = p_item)
            and (p_category is null or i.category_id = p_category)
        )
  order by d.created_at desc, d.id desc   -- id is the tie-breaker
  limit least(p_limit, 100)
$$;
```

`EXISTS` avoids duplicate documents. Add an index that supports the join (for example `inventory_ledger_lines (document_id, item_id)`) after checking the plan.

**Tests:** seed an older document matching a category that has 30 newer documents in other categories; verify it appears. Verify a document with 3 matching lines appears once.

### 3.2 Page the employee directory past the API cap
**Bug:** the directory RPC has no paging loop, so it silently stops at the configured API max rows (`max_rows` in `supabase/config.toml`, default 1000).

**Preferred fix:** do not ship the whole directory to a picker. Use a **search-as-you-type** endpoint returning a small page.

```sql
create or replace function public.employee_picker(p_q text default null, p_limit int default 20)
returns table (id uuid, label text)
language sql stable security invoker
as $$
  select e.id, e.full_name as label
  from public.employees e
  where e.archived_at is null
    and (p_q is null or e.full_name ilike '%' || p_q || '%')
  order by e.full_name, e.id
  limit least(p_limit, 50)
$$;
```

**If you must list everything**, page with keyset on `id`:

```sql
... where (p_after is null or e.id > p_after) order by e.id limit 500
```

and loop until a page returns fewer than 500 rows. **Test:** a fixture crossing the cap boundary shows no missing or duplicated employees.

### 3.3 Export handler order
Required order: **authorize → validate format → return template or read data**.

```ts
export async function GET(req: Request) {
  const session = await requirePermission("inventory.export"); // 1. authorize
  const format = parseFormat(new URL(req.url).searchParams.get("format"));
  if (!format) return Response.json({ error: "Unsupported format" }, { status: 400 }); // 2. validate

  if (isBlankTemplateRequest(req)) return blankImportWorkbook();                      // 3. no master read

  const rows = await getInventoryForExport();                                         // 4. only now read
  return buildExport(rows, format);
}
```

**Tests:** unauthorized → 401/403, bad format → controlled 400, blank template → zero master-table reads (assert in a span or mock).

### 3.4 Narrow reads for light screens
| Screen | Needs | Replace the full master read with |
| --- | --- | --- |
| Category management, new-item form | categories only | `getCategories()` |
| Item detail, stock card | one item + its balance | `getItemById(id)` scoped by `id` |
| Forms employee picker | id + label | `employee_picker` (3.2) |

---

## 4. Step 3: Database filtering and pagination

### 4.1 Principles
1. Filter, sort, project and count **in PostgreSQL**. Return one page.
2. Keep list state in the **URL** (`?q=&status=&page=`), so links, back/forward and refresh work.
3. Pick the paging style per table:
   - **Offset paging** (numbered pages): fine for employees and items (hundreds to low thousands) when drift between pages is acceptable.
   - **Keyset (cursor) paging**: use for audit logs, ledgers and any table that grows without bound or receives concurrent inserts.
4. Always sort with a **unique tie-breaker** (`..., id`).
5. Keep a **separate complete query** for print and export.

### 4.2 Employee list as one SQL function

```sql
create or replace function public.list_employees_page(
  p_q      text default null,
  p_status text default 'active',   -- active | archived | all
  p_limit  int  default 25,
  p_offset int  default 0
)
returns table (
  id uuid, full_name text, position text, checklist_pct numeric,
  nosi_eligible boolean, total_count bigint
)
language sql stable security invoker
as $$
  select v.id, v.full_name, v.position, v.checklist_pct, v.nosi_eligible,
         count(*) over() as total_count
  from public.employee_list_v v          -- security_invoker view with derived fields
  where (p_status = 'all'
         or (p_status = 'active'   and v.archived_at is null)
         or (p_status = 'archived' and v.archived_at is not null))
    and (p_q is null or v.full_name ilike '%' || p_q || '%')
  order by v.full_name, v.id
  limit least(p_limit, 100) offset greatest(p_offset, 0)
$$;
```

Notes:
- Make the view `security_invoker = true` so RLS applies as the signed-in user:
  `create view public.employee_list_v with (security_invoker = true) as ...`
- Escape `%` and `_` in the search term before passing it in.
- For fast `ilike '%x%'`, consider `pg_trgm` and a GIN index **after** checking the plan.
- `count(*) over()` is fine at this scale. If counts get expensive, show "next/previous" without exact totals or use an estimate.

### 4.3 Page component

```tsx
// employees/page.tsx
type Props = { searchParams: Promise<{ q?: string; status?: string; page?: string }> };

export default async function EmployeesPage({ searchParams }: Props) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const pageSize = 25;

  const { rows, total } = await listEmployeesPage({
    q: sp.q,
    status: sp.status ?? "active",
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  return (
    <>
      <h1>Employees</h1>
      <EmployeeFilters />                       {/* updates URL params */}
      <EmployeeTable rows={rows} />             {/* renders exactly what it receives */}
      <Pagination page={page} pageSize={pageSize} total={total} /> {/* <Link> based */}
    </>
  );
}
```

Change `table.tsx` so pagination is **supplied by the caller** (page, total, links). Keep the old client-slicing mode only for small, static tables.

### 4.4 Keyset paging for audit logs and ledgers

```sql
create index if not exists audit_created_id_idx
  on public.audit_log (created_at desc, id desc);

create or replace function public.list_audit_page(
  p_before_at timestamptz default null,
  p_before_id bigint      default null,
  p_limit     int         default 25
)
returns table (id bigint, created_at timestamptz, actor text, action text, entity text)
language sql stable security invoker
as $$
  select a.id, a.created_at, a.actor, a.action, a.entity   -- projection only
  from public.audit_log a
  where p_before_at is null
     or (a.created_at, a.id) < (p_before_at, p_before_id)
  order by a.created_at desc, a.id desc
  limit least(p_limit, 100) + 1                             -- look-ahead row
$$;
```

Return `limit + 1` rows; if you get the extra row there is a next page, and its predecessor's `(created_at, id)` becomes the next cursor. This mirrors the saved-drafts pattern you already use.

### 4.5 Facets and list membership must agree
Employee counts on Home, the masterlist, NOSI and reports must all come from the **same rules and reference date**. Put eligibility, active status and "as-of" logic in **one SQL view or function** and have every screen use it. Add a parity test that compares filtered employee IDs and totals across Home, list, NOSI and reports.

### 4.6 Reports
- Personnel and inventory reports legitimately need many rows. Keep a complete path for print/export.
- Push narrowing and aggregation toward PostgreSQL **only where traces show material cost** (issued-line date filter, as-of latest count per item, report projections by category/date).
- Latest count as of a date is a good fit for `DISTINCT ON`:

```sql
select distinct on (c.item_id) c.item_id, c.observed_qty, c.counted_on
from public.inventory_counts c
where c.counted_on <= :as_of
order by c.item_id, c.counted_on desc, c.id desc
```

- Compare results against the existing JavaScript output: row counts, fractional quantities, date boundaries, snapshot totals, variances.
- Do **not** add precomputed summaries until execution plans under RLS show a real cost. Preserve the ledger as the source of truth.

### 4.7 RLS and plan hygiene
- Inspect plans under the real role context, not as the table owner:

```sql
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"<test-user-uuid>","role":"authenticated"}';
explain (analyze, buffers) select * from public.list_employees_page(null, 'active', 25, 0);
rollback;
```

- Index columns used in policies, filters and sorts.
- Where a policy calls `auth.uid()`, the `(select auth.uid())` form can let Postgres evaluate it once per statement. Use it **only for statement-invariant identity**, and confirm equal results and plans for each role.
- Security-definer functions need explicit authorization checks inside them.

### 4.8 Done when
- First page query count and rows stay **bounded as the fixture grows** (2,000 → 20,000 employees; 20,000 → 200,000 ledger lines).
- Equal sort keys and concurrent inserts produce no duplicated or missing rows across pages.
- Print and export return the **complete** authorized result.

---

## 5. Step 4: Writes and refresh

### 5.1 Atomic version checks
Keep the stale-write check in the same statement as the update.

```ts
const { data, error } = await supabase
  .from("employees")
  .update(patch)
  .eq("id", id)
  .eq("updated_at", expectedUpdatedAt)   // pass back the exact string you read
  .select("id, updated_at");

if (error) return fail(error);
if (!data || data.length === 0) return { ok: false, code: "STALE_VERSION" };
return { ok: true, version: data[0].updated_at };
```

- JavaScript `Date` truncates microseconds. Round-trip the **string** from Postgres, or use an integer `version` column.
- For multi-table writes (ledger posting, snapshots, counts), keep them inside **one transactional database function** so a failed or retried write cannot leave half a posting.

### 5.2 Fetch only what the decision needs
NOSI save currently loads the full employee profile to validate one cycle. Replace with a dedicated read that returns only:
- the employee id and version,
- the current cycle and its eligibility inputs,
- the exact fields used in the snapshot.

Better: validate inside a database function that checks eligibility and version in one call. Whatever you do, **preserve cycle eligibility, the submitted version and snapshot fields**.

### 5.3 Revalidate narrowly

```ts
// BAD: refreshes everything under the root layout
revalidatePath("/", "layout");

// GOOD: only the views that show this data
revalidatePath("/employees");
revalidatePath(`/employees/${id}`);
// If you introduce tagged cached reads, use updateTag("employees") for read-your-own-writes.
```

Test each affected view (Home, profile, lists, logs, reports) shows the committed change. Measure **submit → visibly updated data**, not just the action's duration.

### 5.4 Done when
- Two simultaneous edits give exactly one success and one conflict.
- A retried or rejected inventory post leaves balances unchanged.
- Audit triggers, append-only salary/ledger histories and last-administrator protection still behave identically.

---

## 6. Step 5: Calendar day selection

Select days locally inside the loaded month and keep the URL in sync without a server render. Only fetch when the month changes.

```tsx
"use client";
function MonthCalendar({ events, initialDate }: Props) {
  const [selected, setSelected] = useState(initialDate);

  const selectDay = (date: string) => {
    setSelected(date);
    // Next.js syncs native history calls with useSearchParams; no server render.
    window.history.replaceState(null, "", `?date=${date}`);
    // Use pushState instead if back/forward should step through days.
  };

  const changeMonth = (month: string) => router.push(`?month=${month}`); // needs new data

  const agenda = events.filter((e) => e.date === selected);
  /* render grid + agenda */
}
```

**Done when:** deep links and back/forward reproduce the right date and selection, adding an event refreshes the relevant agenda, and same-month vs cross-month timings are compared separately.

---

## 7. Cross-cutting safety checklist (run for every change)

- [ ] Tested with **multiple roles**, including one without the permission.
- [ ] PostgreSQL permissions and storage policies verified through the **normal entry points** (not the service role).
- [ ] Attachment authorization still happens **before** signing a URL.
- [ ] Saved drafts still open with the scope they need.
- [ ] Expected-version edits, append-only salary/ledger, last-administrator protection and audit triggers unchanged.
- [ ] Draft and transaction snapshots unchanged.
- [ ] Failed or stale writes leave the intended state.
- [ ] No cookies, tokens, signed URLs or personnel values in logs or benchmark output.

---

## 8. Acceptance matrix

| Step | Metric | Pass condition |
| --- | --- | --- |
| 0 | Baseline table | Median + p95 for heading and usable content, per route and condition |
| 1 | Region canary | Per-hop spans and usable-content time compared; decision recorded |
| 1 | `getClaims()` | Proxy Auth span drops; all auth regression tests pass |
| 1 | Parallel reads, streaming | Heading visible before slow reads finish; no layout shift |
| 2 | Inventory fixes | Tests in 3.1–3.3 pass; unauthorized export fails; blank template reads zero master rows |
| 3 | Pagination | First-page rows bounded as data grows; parity tests pass; print/export complete |
| 4 | Writes | Conflict tests pass; post-submit view correct; narrower revalidation verified |
| 5 | Calendar | Same-month selection has no server round trip; deep links work |

---

## 9. What not to do

- Do not claim latency savings before the preview comparison.
- Do not embed roles in tokens without a revocation design.
- Do not cache anything user-specific, private or signed in a shared cache.
- Do not add indexes or precomputed summaries before reading the plan under RLS.
- Do not remove the full print/export path when adding interactive paging.
- Do not run write benchmarks against production.`