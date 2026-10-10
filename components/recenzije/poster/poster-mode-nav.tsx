import Link from "next/link";
import { cn } from "@/lib/recenzije/utils";

export type PosterMode = "recenzija" | "jelovnik";

const MODES: { id: PosterMode; label: string; hint: string; href: string }[] = [
  { id: "recenzija", label: "Google recenzija", hint: "QR vodi na recenziju", href: "/recenzije/plakat" },
  { id: "jelovnik", label: "Jelovnik", hint: "QR vodi na jelovnik", href: "/recenzije/plakat?nacin=jelovnik" },
];

/** Prekidač načina na stranici QR plakata (samo za ugostiteljstvo). Obične poveznice: stranica se gradi na poslužitelju. */
export function PosterModeNav({ active }: { active: PosterMode }) {
  return (
    <nav aria-label="Vrsta QR koda" className="mb-6 grid max-w-xl grid-cols-2 border border-foreground">
      {MODES.map((m) => {
        const on = m.id === active;
        return (
          <Link
            key={m.id}
            href={m.href}
            replace
            aria-current={on ? "page" : undefined}
            className={cn(
              "flex min-h-11 flex-col items-start gap-1 px-3 py-3 transition-colors sm:px-4",
              on ? "bg-foreground text-white" : "bg-white text-foreground hover:bg-surface-2"
            )}
          >
            <span className="text-sm font-bold">{m.label}</span>
            <span className={cn("label", on ? "text-white/70" : "text-muted")}>{m.hint}</span>
          </Link>
        );
      })}
    </nav>
  );
}
