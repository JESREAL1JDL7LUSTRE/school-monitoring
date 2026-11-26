import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function PasswordCard({ title, description, children, backHref = "/login", backLabel = "Back to sign in" }: {
  title: string;
  description: string;
  children: ReactNode;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <main className="grid min-h-dvh place-items-center bg-muted/40 px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle><h1 className="text-2xl font-semibold tracking-tight">{title}</h1></CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {children}
          <Button asChild variant="link" className="min-h-11 px-0"><Link href={backHref}>{backLabel}</Link></Button>
        </CardContent>
      </Card>
    </main>
  );
}
