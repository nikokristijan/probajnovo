import { redirect } from "next/navigation";

/**
 * Zadaci su dio Portala (NOVO/Revolut redizajn — jedna stranica, bez
 * tabova, vidi app/admin/portal/layout.tsx). Stara ruta ostaje kao trajni
 * redirect umjesto 404, za stare bookmarkove/linkove.
 */
export default function ZadaciRedirectPage() {
  redirect("/admin/portal");
}
