"use client";

import Link from "next/link";
import { QrCode } from "lucide-react";
import { Button } from "@/components/recenzije/ui/button";
import { Card, EmptyState } from "@/components/recenzije/ui/primitives";

export default function PosterError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Card>
      <EmptyState
        icon={QrCode}
        title="Plakat se nije učitao"
        description={error.digest ? `Oznaka greške: ${error.digest}` : "Pokušajte ponovno. Ako se ponavlja, provjerite link za recenzije u Postavkama."}
        action={
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button onClick={reset}>Pokušaj ponovno</Button>
            <Button variant="secondary" asChild>
              <Link href="/recenzije/postavke">Postavke</Link>
            </Button>
          </div>
        }
      />
    </Card>
  );
}
