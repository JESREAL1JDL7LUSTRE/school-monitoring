import { Card, CardContent } from "@/components/ui/card";

export default function Loading() {
  return (
    <Card className="min-h-48">
      <CardContent role="status" className="text-sm text-muted-foreground">Loading school records…</CardContent>
    </Card>
  );
}
