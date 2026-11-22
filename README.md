# School Admin Desk

School Admin Desk is a single-school workspace for Philippine public-school personnel. It covers employee records, 201 checklists, NOSI, inventory custody, printable drafts, reports, and school settings. The Next.js app uses individual Supabase Auth sessions, PostgreSQL row-level security, and private Storage.

## Local setup on Windows

Install Node.js 20.19 or later and start Docker Desktop. From the repository root, run these PowerShell commands.

    npm.cmd ci
    npx.cmd --yes supabase start
    npx.cmd --yes supabase status -o env
    Copy-Item .env.example .env.local

Set NEXT_PUBLIC_SUPABASE_URL in .env.local to the displayed API_URL, ordinarily http://127.0.0.1:54321. Set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to PUBLISHABLE_KEY or the local ANON_KEY if the CLI displays a legacy key. These are the two application variables. Keep the service-role key, database password, and other administrative credentials out of the app environment.

    npm.cmd run dev

Open http://127.0.0.1:3000. Supabase Studio runs at http://127.0.0.1:54323. Apply pending migrations to an existing local database and preserve its records with this command.

    npx.cmd --yes supabase migration up --local

To reapply migrations and restore synthetic fixtures to a disposable local database, run the next command. It replaces local records.

    npx.cmd --yes supabase db reset

Run migrations and seed files only against their intended environment. The local reset loads the demo school, accounts, and records from supabase/seed.sql and supabase/seeds/. A database for the school should receive migrations without demo fixtures.

The demo includes personnel profiles and histories, calendar events, saved print drafts, and inventory transactions and reports. To add the expanded examples to an existing local demo database or install the private sample PDF, run this command after setting up `.env.local`.

    npm.cmd run seed:demo

The command uses the local Docker database and checks for the demo account and employee fixtures before importing. Running it again preserves existing records and skips examples already installed. The private sample PDF uploads through the local Supabase service using the demo personnel account.

### Demo accounts

All five accounts use the local-only password shown below.

    LocalSchoolDesk!2026

| Account | App access |
| --- | --- |
| admin@school.example | Personnel, attachments, inventory, settings, staff roles, and audit history |
| head@school.example | Read personnel, attachments, inventory, settings, and audit history |
| personnel@school.example | Edit personnel and attachments, generate personnel drafts, and read inventory |
| property@school.example | Edit inventory, use the minimum employee directory for issues, and read settings |
| auditor@school.example | Read personnel, inventory, settings, and audit history. Private 201 attachments require separate access. |

A user may hold multiple roles. All five roles can view the shared calendar. Administrators, school heads, administrative officers, and property custodians can add calendar events. The app resolves access on the server, and PostgreSQL and Storage policies enforce the same boundaries.

### Set up staff accounts for a school

Create or invite each staff member in Supabase Auth with email sign-in enabled and public sign-up disabled. Use the SQL editor under an authorized database account to grant the initial administrator role to an existing, verified school account. Replace the example address.

    insert into public.staff_roles (user_id, role)
    select id, 'admin'::public.staff_role
    from auth.users
    where lower(email) = lower('first-admin@your-school.example')
      and email_confirmed_at is not null
    on conflict do nothing;

The administrator can then assign roles under **School settings → Staff access**. Fill in the school identity, logo, signatories, and rules under **School settings**. The dashboard and reporting rules use the Philippines reference date by default. A fixed date and reporting year can be set for retrospective review or demonstrations.

## Checks

    npm.cmd run lint
    npm.cmd run typecheck
    npm.cmd run build
    npm.cmd run test
    npx.cmd playwright install chromium
    npm.cmd run test:e2e

Run the browser suite against the seeded local stack. Playwright starts the development server when port 3000 is free and uses the running instance otherwise. Configure the app to use the same local Supabase in either case. The suite adds synthetic attachments, draft documents, and ledger entries and checks role permissions, row-level security, stale-write rejection, printable output, inventory quantity and custody, and mobile keyboard navigation. Complete returns restore the stock balance and preserve the issue and return records. To use a supported installed Chrome instead of Playwright Chromium, set the following in PowerShell before running the suite.

    $env:PLAYWRIGHT_CHANNEL = 'chrome'

## Records and printed output

The date of a stock posting must be on or after the latest ledger entry for each item on the document. A return must also be on or after the original issue date. Physical counts record stock as it stood on the selected count date and preserve the observed quantity and variance separately. Archiving an inventory item requires resolving its on-hand balance and outstanding non-consumable custody.

Saved personnel drafts and posted inventory documents retain the template version and snapshot used when prepared. Aggregate inventory, physical-count, and personnel reports are generated from the records and filters in effect when viewed. Save the printed PDF if the school needs to retain a particular report copy.

## School decisions before relying on official output

- Confirm applicable salary schedules, grade and step eligibility, treatment of end-of-month anniversaries, retirement rules, loyalty milestones, and any exceptions that require manual review. Current estimates and example thresholds are draft school settings. Record the actual salary and effective date in history.
- Review the appropriate inventory classifications and thresholds, report formats, signing officials, property receipt forms, and retention periods. A physical count records the observed quantity and variance. A ledger adjustment records an authorized change to the balance.
- Verify each personnel and property template against the school’s current official form and signing requirements. The app labels document and report templates as drafts and records template versions and source data for saved documents.
- Decide which documents, stock transactions, and disposals need review and who approves them. The current workflow allows authorized staff to post inventory entries and save printable drafts. The School Head role has read-only access to personnel and inventory records. Historical ledger changes are recorded through returns or adjustments, and archiving an employee or inventory item preserves its history.
- Confirm archive access, retention, backup scope, restore procedures, and the school’s approval process before using real personnel documents and salaries. Private object backups need to accompany a database backup.

See [Prototype workflow coverage](docs/workflow-coverage.md) for the screen and control inventory.
