import { requireFullAdmin } from "@/lib/auth";
import { listNfcLinks } from "@/lib/db/links";
import { LINK_HOST, publicNfcLinkUrl } from "@/lib/linkHost";
import NfcLinkCreateForm from "@/components/admin/NfcLinkCreateForm";
import NfcLinkCard from "@/components/admin/NfcLinkCard";
import { EmptyState } from "@/components/admin/EmptyState";
import { StatCard } from "@/components/admin/StatCard";

export const dynamic = "force-dynamic";

/**
 * NFC linkovi (privjesci): jedan kratki link na stotinama oznaka, a
 * odredište se mijenja ovdje — vidi nfcLinks u lib/db/schema.ts.
 */
export default async function NfcLinksPage() {
  await requireFullAdmin();
  const links = await listNfcLinks();
  const totalScans = links.reduce((a, l) => a + l.scanCount, 0);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-bold">NFC linkovi</h1>
        <p className="text-sm text-black/55 mt-1 max-w-2xl">
          Na sve privjeske iz jedne serije upiši isti link. Kad promijeniš odredište ovdje, svi privjesci odmah vode na
          novu adresu, bez ponovnog programiranja. Otvaranje je trenutno preusmjeravanje, bez ikakve međustranice.
        </p>
        {!LINK_HOST && (
          <p className="mt-3 text-sm rounded-xl bg-[#fff4e5] text-[#8a4b00] px-4 py-3 max-w-2xl">
            Linkovi zasad idu preko probajnovo.com, pa telefon pri dodiru prikaže tu domenu. Za potpuno neutralan link
            spoji vlastitu kratku domenu (postavka NEXT_PUBLIC_LINK_HOST) prije programiranja privjesaka.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-xl">
        <StatCard label="Linkova" value={links.length} />
        <StatCard label="Otvaranja ukupno" value={totalScans} />
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-bold">Novi link</h2>
        <NfcLinkCreateForm />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-bold">Svi linkovi</h2>
        {links.length === 0 ? (
          <EmptyState title="Još nema linkova" hint="Napravi prvi gore, pa ga upiši na privjeske." />
        ) : (
          links.map((l) => <NfcLinkCard key={`${l.id}-${new Date(l.updatedAt).getTime()}`} link={l} publicUrl={publicNfcLinkUrl(l.code)} />)
        )}
      </section>

      <section className="text-xs text-black/50 max-w-2xl leading-relaxed">
        <b className="text-black/70">Upisivanje na privjeske:</b> u aplikaciji NFC Tools odaberi Write → Add a record → URL i zalijepi
        link iznad. Nakon provjere oznaku možeš zaključati (Lock tag) da je nitko ne može prepisati. Odredište se i dalje mijenja ovdje.
      </section>
    </div>
  );
}
