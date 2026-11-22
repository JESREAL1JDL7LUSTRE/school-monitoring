"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardError({ reset }: { reset: () => void }) {
  return (
    <Card>
      <CardHeader><CardTitle>School records are unavailable</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p role="alert" className="text-muted-foreground">The page could not load. Try opening it again.</p>
        <Button onClick={reset}>Try again</Button>
      </CardContent>
    </Card>
  );
}
