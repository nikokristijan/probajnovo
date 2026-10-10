"use client";

import Link from "next/link";
import { UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/recenzije/ui/button";
import { Card, EmptyState } from "@/components/recenzije/ui/primitives";

export default function MenuError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Card>
      <EmptyState
        icon={UtensilsCrossed}
        title="Jelovnik se nije učitao"
        description={error.digest ? `Oznaka greške: ${error.digest}` : "Pokušajte ponovno. Ako se ponavlja, javite nam se."}
        action={
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button onClick={reset}>Pokušaj ponovno</Button>
            <Button variant="secondary" asChild>
              <Link href="/recenzije/pregled">Pregled</Link>
            </Button>
          </div>
        }
      />
    </Card>
  );
}
