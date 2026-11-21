# School Admin Desk

School Admin Desk is a single-school administration app for Philippine public-school personnel. Keep the Next.js project in this repository root. The current implementation is a starter page under `src/app` using the Next.js App Router, TypeScript, Tailwind CSS, and ESLint. Use npm and keep `package-lock.json` in sync with dependency changes.

## Project references

- [School Admin Desk HTML prototype](School_Admin_Desk_Prototype%20%281%29.html) shows navigation, terminology, screen interactions, and print layouts. Its records are sample data, and some actions are demonstrations. Use it as a workflow reference when implementing features.
- [Architecture and technology stack](techstack-and-stuff.md) describes the planned application, data model, security, and implementation sequence.

## Application structure

- Build a single-school modular monolith. Use the App Router under `src/app`, with route groups for authentication and dashboard screens as they are introduced. Prefer Server Components for data-heavy screens, Client Components for interactive controls, and Server Actions or Route Handlers for server entry points.
- Place queries, validation, and business rules in the owning domain under `src/modules` as modules are added. Keep reusable UI under `src/components`. Use the existing `@/*` alias for imports from `src`.
- The planned stack includes Supabase PostgreSQL, Auth, and Storage, with database migrations under `supabase/migrations`. The UI stack uses shadcn/ui, Zod, React Hook Form, and TanStack Table. The test plan uses Vitest and Playwright, and the hosting target is Vercel.
- Establish migrations, authentication, roles, school settings, row-level security, and audit logging before building workflows that handle real school records.

## shadcn/ui and reusable variants

- Always use shadcn/ui as the foundation for app UI. For every UI task, use the shadcn MCP to check the project registries, find relevant primitives and examples, and retrieve the add command when a component is missing. Initialize shadcn/ui when the first UI implementation needs it.
- Check `src/components/ui` for an existing primitive or variant before adding one. For a visual or size change, extend the shared shadcn component's variants in its existing file. Use the existing variant mechanism, such as CVA, when available.
- If a customization needs different markup or behavior, compose the primitive in one reusable component file under `src/components`. Keep its supported versions together and expose a typed prop that callers can choose, such as `variant="compact"` or `variant="print"`. Use an explicit version prop such as `version="v2"` when old and new behavior need to coexist. Preserve the existing default for callers and keep shared logic in the same component. Avoid per-screen copies and separate files for each version.
- Preserve keyboard interaction, focus management, accessible labels, and state behavior when extending shadcn primitives. Reuse theme tokens for spacing, type, color, and radius.

## Visual design and typography

- Put the actual feature or workflow in the foreground. Show the real interface when presenting the product, give the main feature room, write specific headings, and make the primary action easy to find. Remove filler badges, redundant labels, arbitrary italics, and decorative embellishments.
- Group related controls with spacing and use consistent icons and semantic theme tokens. Define a purposeful accent color, keep text contrast readable, and use the shared OKLCH palette when choosing colors. For nested corners, use the outer radius minus the inset padding as a starting point. Check alignment by eye and adjust icons or shapes around their optical center when needed.
- Check kerning between letter pairs, tracking across text, leading between lines, and x-height at small sizes. Keep prose line lengths readable and wrap headlines deliberately to avoid single-word widows. Use monospace for content that benefits from fixed widths and tabular numbers for comparable values such as counts, salaries, and inventory totals.

## Interaction and feedback

- Apply Fitts's law by putting frequent actions close to the work and giving controls generous hit areas, including touch targets around 44 × 44 CSS pixels where practical. Respect device safe areas and make interactive affordances clear through familiar controls, labels, and states.
- Apply Hick's law and Miller's law by keeping common choices easy to scan, grouping related options, and progressively disclosing advanced controls. Use a shadcn combobox for searchable lists when a plain select becomes hard to scan. Follow Jakob's law by keeping common interactions familiar and prioritize actions based on how often staff use them.
- Follow Postel's law for input handling by tolerating harmless formatting differences, normalizing them consistently, and enforcing domain validation. Follow the Doherty threshold by acknowledging input promptly and showing loading feedback for longer work. Reserve space for loading and dynamic content to prevent layout shift. Use optimistic updates where changes are reversible and failures can restore the previous state.

## Motion

- Animate feedback that helps users understand an action, a state change, or where content moved. Stage the focus on the main change, define clear start and end poses, and use snappy timing. Match easing to the motion, including a gentle start or end where appropriate, and allow animations to be interrupted or reversed without blocking input.
- Use origin-aware animation for menus and popovers, shared-element transitions to preserve identity across views, and subtle stagger when the order matters. For spatial motion, natural arcs and consistent volume and perspective help objects read as solid. Use anticipation, follow-through, secondary action, squash and stretch, or exaggerated feedback selectively when they improve clarity or overall appeal.
- Respect `prefers-reduced-motion` and keep the same information available without animation.

## Workflows and data rules

- Home links staff to records needing attention. Personnel includes the employee masterlist, 201 file checklists, a month calendar, Notice of Step Increment (NOSI), printable forms and reports, and logs. Keep reports, dashboard counts, and employee filters consistent by sharing the domain rules.
- Derive the 201 checklist from document types and employee document records. Represent checklist status explicitly, including items marked not applicable. Store files in private storage and keep their metadata in PostgreSQL.
- Retain effective-dated salary grade and step history. Treat the prototype's three-year NOSI interval, estimated salary adjustment, retirement and loyalty rules, and property thresholds as examples. Confirm applicable school rules, official forms, and signatories before relying on them for official decisions.
- Use a common inventory model across supplies, books, equipment, and buildings. Derive balances from receipts, issues, returns, and adjustments recorded in the ledger. Keep physical counts distinct from recorded balances. Link custody to employee IDs.
- Keep school identity and signatories in singleton school settings. Save the data snapshot and template version used to generate official documents so that later record updates preserve the issued version.
- Give staff individual accounts. Check role permissions on the server and enforce row-level security in PostgreSQL. Authorize private file access before issuing short-lived signed URLs. Keep service-role credentials server-side and use authenticated user identity for ordinary operations.
- Audit significant changes, detect stale writes, and preserve history when correcting finalized transactions. The school still needs to settle which workflows require approval and how historical records should be archived or deleted.

## Local commands

Requires Node.js 20.9 or later. From this directory on Windows, use:

```powershell
npm.cmd ci
npm.cmd run dev
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
```

The development server defaults to `http://localhost:3000`. For application changes, run the checks relevant to the change before handing it off.
