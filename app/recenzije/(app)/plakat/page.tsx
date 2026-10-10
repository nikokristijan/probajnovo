import Link from "next/link";
import { CircleAlert, Plug } from "lucide-react";
import { MenuPosterStudio } from "@/components/recenzije/poster/menu-poster-studio";
import { PosterModeNav } from "@/components/recenzije/poster/poster-mode-nav";
import { PosterStudio } from "@/components/recenzije/poster/poster-studio";
import { Button } from "@/components/recenzije/ui/button";
import { Alert, Card, EmptyState, PageHeader } from "@/components/recenzije/ui/primitives";
import { requireOrg } from "@/lib/recenzije/session";
import { getVenueMenuForOperator } from "@/lib/recenzije/services/menus";
import { buildQrMatrix, parseReviewUrl, type QrMatrix } from "@/lib/recenzije/services/qr";

export const metadata = { title: "QR plakat" };

type SP = Record<string, string | undefined>;

export default async function PosterPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const ctx = await requireOrg();
  // Način "Jelovnik" postoji samo za ugostiteljske tvrtke; za ostale stranica ostaje kakva je bila.
  if (ctx.org.isVenue && sp.nacin === "jelovnik") return <MenuPoster />;
  const raw = ctx.org.googleReviewUrl?.trim() || null;
  const reviewUrl = parseReviewUrl(raw);

  // QR se gradi na serveru iz linka aktivne tvrtke; u preglednik ide samo gotov SVG path.
  let qr: QrMatrix | null = null;
  let qrFailed = false;
  if (reviewUrl) {
    try {
      qr = buildQrMatrix(reviewUrl);
    } catch (e) {
      console.error("[recenzije] QR plakat", e);
      qrFailed = true;
    }
  }

  return (
    <>
      {ctx.org.isVenue && <PosterModeNav active="recenzija" />}
      <PageHeader
        kicker="QR plakat"
        title="Plakat za Google recenziju"
        description="Ispišite plakat ili stolnu karticu. Gost skenira kod mobitelom i odmah dođe na Google stranicu za recenziju, bez traženja i bez aplikacije."
        actions={
          <Button variant="secondary" asChild>
            <Link href="/recenzije/postavke">Uredi link za recenzije</Link>
          </Button>
        }
      />

      {reviewUrl && qr ? (
        <PosterStudio orgName={ctx.org.name} reviewUrl={reviewUrl} qr={qr} />
      ) : qrFailed ? (
        <Alert
          tone="red"
          icon={CircleAlert}
          title="QR kod se nije mogao napraviti"
          action={
            <Button size="sm" variant="secondary" asChild>
              <Link href="/recenzije/postavke">Provjeri link</Link>
            </Button>
          }
        >
          Link za recenzije je predug ili neispravan za QR kod. Zamijenite ga kraćim Google linkom (https://g.page/r/… ili https://search.google.com/local/writereview?placeid=…).
        </Alert>
      ) : (
        <Card>
          <EmptyState
            icon={Plug}
            title={raw ? "Link za recenzije nije ispravan" : "Najprije dodajte Google link"}
            description={
              raw
                ? "Spremljeni link nije ispravna http(s) adresa ili je predug (najviše 500 znakova) pa se QR kod ne može napraviti. Zamijenite ga Googleovim linkom za recenzije."
                : "Plakat vodi na Google stranicu za recenziju. Povežite Google Business Profile ili zalijepite link za recenzije u Postavkama."
            }
            action={
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button asChild>
                  <Link href="/recenzije/postavke#google">Poveži Google</Link>
                </Button>
                <Button variant="secondary" asChild>
                  <Link href="/recenzije/postavke">Zalijepi link</Link>
                </Button>
              </div>
            }
          />
        </Card>
      )}
    </>
  );
}

/** QR plakat za digitalni jelovnik ugostiteljske tvrtke: kod vodi na /jelovnik/<slug>, adresa se uzima iz baze za aktivnu tvrtku. */
async function MenuPoster() {
  const ctx = await requireOrg();
  const view = await getVenueMenuForOperator(ctx.org.id);
  let qr: QrMatrix | null = null;
  let qrFailed = false;
  if (view) {
    try {
      qr = buildQrMatrix(view.publicUrl);
    } catch (e) {
      console.error("[recenzije] QR jelovnika", e);
      qrFailed = true;
    }
  }

  return (
    <>
      <PosterModeNav active="jelovnik" />
      <PageHeader
        kicker="QR plakat"
        title="QR kod za jelovnik"
        description="Ispišite plakat, stolnu karticu ili ploču sa svim stolovima. Gost skenira kod mobitelom i otvara jelovnik."
        actions={
          <Button variant="secondary" asChild>
            <Link href="/recenzije/jelovnik">Uredi jelovnik</Link>
          </Button>
        }
      />
      {view && qr ? (
        <div className="space-y-6">
          {!view.menu.enabled && (
            <Alert
              tone="amber"
              icon={CircleAlert}
              title="Jelovnik je isključen"
              action={
                <Button size="sm" variant="secondary" asChild>
                  <Link href="/recenzije/jelovnik">Uključi</Link>
                </Button>
              }
            >
              Gost koji skenira kod vidi stranicu s greškom. Uključite jelovnik prije ispisa.
            </Alert>
          )}
          <MenuPosterStudio orgName={ctx.org.name} baseUrl={view.publicUrl} initialQr={qr} allowSkip={view.menu.allowSkip} />
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={CircleAlert}
            title={qrFailed ? "QR kod se nije mogao napraviti" : "Jelovnik nije dostupan"}
            description={
              qrFailed
                ? "Adresa jelovnika je predugačka za QR kod. Skratite je u Postavkama jelovnika."
                : "Ova tvrtka nema digitalni jelovnik. Vrstu poslovanja mijenja NOVO tim u adminu."
            }
            action={
              <Button asChild>
                <Link href="/recenzije/jelovnik?tab=postavke">Postavke jelovnika</Link>
              </Button>
            }
          />
        </Card>
      )}
    </>
  );
}
