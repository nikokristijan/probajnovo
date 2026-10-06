"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/recenzije/ui/button";

export function PrintButton() {
  return (
    <Button variant="secondary" onClick={() => window.print()}>
      <Printer /> Spremi kao PDF
    </Button>
  );
}
