import { redirect } from "next/navigation";

/**
 * Poruke su dio Portala (NOVO/Revolut redizajn — jedna stranica, bez
 * tabova, vidi app/admin/portal/layout.tsx). Stara ruta ostaje kao trajni
 * redirect umjesto 404, za stare bookmarkove/linkove.
 */
export default function PorukeRedirectPage() {
  redirect("/admin/portal");
}
