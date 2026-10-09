import Link from "next/link";
import { CircleAlert, Plug } from "lucide-react";
import { PosterStudio } from "@/components/recenzije/poster/poster-studio";
import { Button } from "@/components/recenzije/ui/button";
import { Alert, Card, EmptyState, PageHeader } from "@/components/recenzije/ui/primitives";
import { requireOrg } from "@/lib/recenzije/session";
import { buildQrMatrix, parseReviewUrl, type QrMatrix } from "@/lib/recenzije/services/qr";

export const metadata = { title: "QR plakat" };

export default async function PosterPage() {
  const ctx = await requireOrg();
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
