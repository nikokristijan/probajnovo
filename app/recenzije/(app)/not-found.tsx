import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/recenzije/ui/button";
import { Card, EmptyState } from "@/components/recenzije/ui/primitives";

export default function NotFound() {
  return (
    <Card>
      <EmptyState
        icon={SearchX}
        title="Nije pronađeno"
        description="Ovo ne postoji ili pripada drugoj tvrtki."
        action={
          <Button asChild variant="secondary">
            <Link href="/recenzije/pregled">Natrag na pregled</Link>
          </Button>
        }
      />
    </Card>
  );
}
