import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { Archive, CalendarDays, CalendarOff, ChartNoAxesCombined, ClipboardList, FileText, History, House, School, Settings2, Users } from "lucide-react";
import { DeskNavigation, type DeskNavGroup } from "@/components/desk-navigation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { signOut } from "@/modules/auth/actions";
import { hasPermission, requireSession } from "@/modules/auth/session";
import { getSchoolSettings } from "@/modules/settings/queries";

const iconProps = { size: 18, "aria-hidden": true } as const;

function Brand() {
  return (
    <Link href="/" className="inline-flex min-h-11 items-center gap-3 rounded-md font-semibold tracking-tight">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-sidebar-accent text-sidebar-accent-foreground"><School size={20} aria-hidden /></span>
      School Admin Desk
    </Link>
  );
}

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await requireSession();
  const personnel = hasPermission(session, "personnel.read");
  const inventory = hasPermission(session, "inventory.read");
  const audit = hasPermission(session, "audit.read");
  const groups: DeskNavGroup[] = [
    { links: [
      { href: "/", label: "Home", icon: <House {...iconProps} /> },
      { href: "/calendar", label: "Calendar", icon: <CalendarDays {...iconProps} /> },
    ] },
    ...(personnel ? [{ label: "Personnel", links: [
      { href: "/employees", label: "Employees", icon: <Users {...iconProps} /> },
      { href: "/leaves", label: "Leave records", icon: <CalendarOff {...iconProps} /> },
      { href: "/nosi", label: "Step increments", icon: <ChartNoAxesCombined {...iconProps} /> },
    ] }] : []),
    { label: "Operations", links: [
      ...(inventory ? [{ href: "/inventory", label: "Property and inventory", icon: <Archive {...iconProps} /> }] : []),
      ...(personnel || inventory ? [
        { href: "/forms", label: "Forms and printing", icon: <FileText {...iconProps} /> },
        { href: "/reports", label: "Reports", icon: <ClipboardList {...iconProps} /> },
      ] : []),
      ...(personnel || audit ? [{ href: "/logs", label: "Logs", icon: <History {...iconProps} /> }] : []),
      { href: "/settings", label: "School settings", icon: <Settings2 {...iconProps} /> },
    ] },
  ];

  return (
    <div className="desk-shell min-h-dvh md:grid md:grid-cols-[14rem_minmax(0,1fr)] lg:grid-cols-[16rem_minmax(0,1fr)]">
      <a href="#main-content" className="desk-chrome sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded-md focus:bg-card focus:p-3 focus:text-card-foreground">Skip to content</a>
      <aside className="desk-chrome sticky top-0 hidden h-dvh flex-col overflow-auto bg-sidebar p-4 text-sidebar-foreground md:flex lg:p-5">
        <Brand />
        <div className="mt-8 flex-1"><DeskNavigation groups={groups} /></div>
        <div className="mt-8 border-t border-sidebar-border pt-4">
          {session.user.email && <p className="desk-nav-label mb-2 overflow-hidden text-ellipsis text-sm" title={session.user.email}>{session.user.email}</p>}
          <form action={signOut}><Button variant="secondary" className="w-full justify-start">Sign out</Button></form>
        </div>
      </aside>
      <div className="min-w-0">
        <div className="desk-chrome bg-sidebar px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-sidebar-foreground md:hidden">
          <div className="mb-3 flex items-center justify-between gap-1"><Brand /><form action={signOut}><Button variant="secondary" size="sm">Sign out</Button></form></div>
          <DeskNavigation groups={groups} mobile />
        </div>
        <header aria-label="School identity" className="desk-chrome sticky top-0 z-20 border-b border-border bg-card">
          <div className="mx-auto flex min-h-14 max-w-[88rem] flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2 text-sm sm:px-6 lg:px-8">
            <Suspense fallback={<Skeleton aria-hidden="true" className="h-4 w-40" />}>
              <SchoolIdentity />
            </Suspense>
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className="desk-content mx-auto max-w-[88rem] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}

async function SchoolIdentity() {
  const settings = await getSchoolSettings();
  return <>
    <p className="font-semibold text-foreground">{settings.school_name}</p>
    <p className="text-muted-foreground">{[settings.region, settings.division].filter(Boolean).join(" · ")}</p>
  </>;
}
