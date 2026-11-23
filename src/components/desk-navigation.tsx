"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { useRef } from "react";
import type { ReactNode } from "react";
import { NavigationPending } from "@/components/navigation-pending";

export type DeskNavGroup = { label?: string; links: { label: string; href: string; icon: ReactNode }[] };

function Navigation({ groups, onNavigate }: { groups: DeskNavGroup[]; onNavigate?: () => void }) {
  const path = usePathname();
  return (
    <nav aria-label="Main navigation" className="space-y-5">
      {groups.map(({ label, links }) => (
        <div key={label ?? "main"}>
          {label && <div className="desk-nav-label mb-1 px-3 text-xs font-semibold">{label}</div>}
          <ul className="space-y-0.5">
            {links.map(({ label, href, icon }) => {
              const active = path === href || (href !== "/" && path.startsWith(`${href}/`));
              return (
                <li key={href}>
                  <Link href={href} aria-current={active ? "page" : undefined} onClick={onNavigate} className="desk-nav-link flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium">
                    {icon}<span>{label}</span><NavigationPending className="ml-auto" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function DeskNavigation({ groups, mobile = false }: { groups: DeskNavGroup[]; mobile?: boolean }) {
  const disclosure = useRef<HTMLDetailsElement>(null);
  if (!mobile) return <Navigation groups={groups} />;

  return (
    <details ref={disclosure} className="group rounded-md bg-sidebar" onKeyDown={(event) => {
      if (event.key === "Escape" && disclosure.current?.open) {
        disclosure.current.open = false;
        disclosure.current.querySelector("summary")?.focus();
      }
    }}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-md px-3 font-medium [&::-webkit-details-marker]:hidden">
        Menu <ChevronDown size={16} aria-hidden className="motion-safe:transition-transform group-open:rotate-180" />
      </summary>
      <div className="p-3 pt-1">
        <Navigation groups={groups} onNavigate={() => { if (disclosure.current) disclosure.current.open = false; }} />
      </div>
    </details>
  );
}
