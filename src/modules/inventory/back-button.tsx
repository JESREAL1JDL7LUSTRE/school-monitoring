import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export function InventoryBackButton({ href }: { href: string }) {
  return (
    <Button variant="outline" asChild className="print:hidden">
      <Link href={href}>
        <ArrowLeft aria-hidden />
        {href.startsWith("/inventory/items/") ? "Back to item" : "Back to inventory"}
      </Link>
    </Button>
  );
}
