import { InboxIcon, AlertIcon } from "@/components/admin/Icons";

/**
 * Prazno/greška stanje za popise (vikendice, firme, upiti...) — zamjenjuje
 * golu rečenicu ("Još nema dodanih vikendica.") utisnutom neumorphism
 * pločicom s ikonom, na izričit zahtjev ("no loading or empty screens" —
 * vidi priloženi TikTok "signs" pregled). variant="error" koristi crvenkastu
 * ikonu za neuspjelo dohvaćanje podataka, inače (default "empty") neutralnu
 * ikonu poštanskog sandučića za "prazan popis".
 */
export function EmptyState({
  title,
  hint,
  variant = "empty",
}: {
  title: string;
  hint?: string;
  variant?: "empty" | "error";
}) {
  return (
    <div className="neu-empty" role={variant === "error" ? "alert" : undefined}>
      {variant === "error" ? (
        <AlertIcon className="text-red-500" />
      ) : (
        <InboxIcon />
      )}
      <div>
        <div className="neu-empty-text font-semibold">{title}</div>
        {hint && <div className="neu-empty-text mt-0.5">{hint}</div>}
      </div>
    </div>
  );
}

export default EmptyState;
