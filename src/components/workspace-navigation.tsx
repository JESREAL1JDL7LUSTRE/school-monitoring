import Link from "next/link";
import { NavigationPending } from "@/components/navigation-pending";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function WorkspaceNavigation({ label, items, className }: {
  label: string;
  items: { href: string; label: string; active: boolean }[];
  className?: string;
}) {
  return (
    <nav aria-label={label} className={cn("flex flex-wrap gap-x-1 border-b", className)}>
      {items.map(({ href, label, active }) => (
        <Button key={href} variant="ghost" asChild className={cn(
          "h-auto min-h-11 rounded-none border-0 border-b-2 px-3 py-2 text-sm whitespace-normal",
          active ? "border-primary font-semibold text-primary" : "border-transparent text-muted-foreground",
        )}>
          <Link href={href} aria-current={active ? "page" : undefined}>{label}<NavigationPending /></Link>
        </Button>
      ))}
    </nav>
  );
}
