"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/recenzije/ui/button";
import { Card, EmptyState } from "@/components/recenzije/ui/primitives";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Card>
      <EmptyState
        icon={AlertTriangle}
        title="Stranica se nije učitala"
        description={error.digest ? `Oznaka greške: ${error.digest}` : "Pokušajte ponovno. Ako se ponavlja, javite nam se."}
        action={<Button onClick={reset}>Pokušaj ponovno</Button>}
      />
    </Card>
  );
}
