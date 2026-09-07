import { redirect } from "next/navigation";

/**
 * Prodaja je spojena u /admin/financije (na izričit zahtjev korisnika —
 * "spoji tab financije i prodaja u jedan", vidi app/admin/financije/page.tsx
 * AgencyLedgerTable). Ova ruta ostaje kao trajni redirect umjesto da se
 * potpuno obriše, da stari linkovi/bookmarkovi (i eventualni vanjski
 * linkovi poput onog iz app/admin/vikendice) ne završe na 404.
 */
export default function AdminProdajaRedirectPage() {
  redirect("/admin/financije");
}
