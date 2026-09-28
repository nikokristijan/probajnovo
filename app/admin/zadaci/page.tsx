import { redirect } from "next/navigation";

/**
 * Zadaci su spojeni u Portal (Faza 3, "Zadaci i poruke nek budu u jednom
 * tabu, 'Portal'") — vidi app/admin/portal (tab "Zadaci", ?tab=zadaci).
 * Stara ruta ostaje kao trajni redirect umjesto 404, za stare
 * bookmarkove/linkove.
 */
export default function ZadaciRedirectPage() {
  redirect("/admin/portal?tab=zadaci");
}
