"use client";

import { Button } from "@/components/ui/button";

export const InventoryPrintButton = ({ label = "Print or save PDF" }: { label?: string }) => (
  <Button type="button" onClick={() => window.print()}>{label}</Button>
);
