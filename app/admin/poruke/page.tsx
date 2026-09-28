import { redirect } from "next/navigation";

/**
 * Poruke su spojene u Portal (Faza 3, "Zadaci i poruke nek budu u jednom
 * tabu, 'Portal'") — vidi app/admin/portal (tab "Tim", zadano ?tab=poruke).
 * Stara ruta ostaje kao trajni redirect umjesto 404, za stare
 * bookmarkove/linkove.
 */
export default function PorukeRedirectPage() {
  redirect("/admin/portal?tab=poruke");
}
