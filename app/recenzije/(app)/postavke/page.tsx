import Link from "next/link";
import { eq } from "drizzle-orm";
import { CircleAlert, Smartphone } from "lucide-react";
import { GoogleIcon } from "@/components/recenzije/auth/oauth";
import { BusinessForm, GoogleActions, LegacyPhoneSwitch } from "@/components/recenzije/app/settings/forms";
import { Button } from "@/components/recenzije/ui/button";
import { Alert, Badge, Card, CardBody, CardHeader, PageHeader } from "@/components/recenzije/ui/primitives";
import { db } from "@/lib/recenzije/db";
import { googleConnections } from "@/lib/recenzije/db/schema";
import { integrations } from "@/lib/recenzije/env";
import { OPERATOR_EMAIL } from "@/lib/recenzije/operator";
import { requireOrg } from "@/lib/recenzije/session";
import { smsProvider, smsSenderKind } from "@/lib/recenzije/services/sms";
import { timeAgo } from "@/lib/recenzije/status";

export const metadata = { title: "Postavke" };

const GOOGLE_MESSAGES: Record<string, { tone: "green" | "red" | "amber"; text: string }> = {
  connected: { tone: "green", text: "Google Business Profile je povezan." },
  denied: { tone: "amber", text: "Pristup Googleu nije odobren." },
  invalid_state: { tone: "red", text: "Veza s Googleom je istekla. Pokušajte ponovno." },
  error: { tone: "red", text: "Povezivanje s Googleom nije uspjelo. Pokušajte ponovno ili koristite link za recenzije." },
  not_configured: { tone: "amber", text: "Povezivanje s Googleom trenutno nije dostupno. Recenzije i dalje rade preko linka." },
  demo: { tone: "amber", text: "Primjer se ne može povezati s pravim Google profilom." },
  forbidden: { tone: "red", text: "Google mogu povezati samo vlasnik i admini." },
};

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ google?: string }> }) {
  const { google } = await searchParams;
  const ctx = await requireOrg();
  const [conn] = await db.select().from(googleConnections).where(eq(googleConnections.organizationId, ctx.org.id)).limit(1);
  const msg = google ? GOOGLE_MESSAGES[google] : null;
  const connected = conn?.status === "CONNECTED";
  const canEdit = ctx.role !== "MEMBER" && !ctx.org.isDemo;
  const isOperator = ctx.user.email === OPERATOR_EMAIL;
  const provider = smsProvider(ctx.org);
  const ownPhone = smsSenderKind(ctx.org) === "org_textbee";
  // Zajednički pošiljatelj (Twilio, TextBee ili NOVO mobitel) na koji se stari mobitel tvrtke može prebaciti.
  const sharedSmsReady = smsProvider(null) !== null;

  return (
    <>
      <PageHeader kicker="Postavke" title="Postavke" description="Podaci tvrtke koji se koriste u porukama, linkovima i izvještajima." />
      {msg && <Alert tone={msg.tone} title={msg.text} className="mb-4" />}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <Card id="tvrtka">
          <CardHeader title="Podaci tvrtke" />
          <CardBody>
            <BusinessForm key={ctx.org.id} org={ctx.org} canEdit={canEdit} demo={ctx.org.isDemo} />
          </CardBody>
        </Card>

        <div className="space-y-4">
          <Card id="sms">
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <Smartphone className="size-4" /> SMS poruke
                </span>
              }
              action={
                <Badge tone={ctx.org.isDemo ? "neutral" : provider === "novo" || provider === "textbee" || provider === "twilio" ? "green" : "amber"} dot>
                  {ctx.org.isDemo
                    ? "Primjer"
                    : ownPhone
                      ? "Vlastiti broj"
                      : provider === "novo" || provider === "textbee"
                        ? "NOVO broj"
                        : provider === "twilio"
                          ? "NOVO pošiljatelj"
                          : provider
                            ? "Drugi broj"
                            : "Nije spremno"}
                </Badge>
              }
            />
            <CardBody className="space-y-3 pt-3 text-sm">
              {ctx.org.isDemo && <p className="text-muted">Primjer: slanje SMS-a je isključeno.</p>}
              {!ctx.org.isDemo && ownPhone && <p>SMS se šalju s mobitela ove tvrtke (TextBee). U tekstu poruke je naziv ove tvrtke.</p>}
              {!ctx.org.isDemo && !ownPhone && (provider === "novo" || provider === "textbee") && (
                <p>SMS se šalju s NOVO broja. U tekstu poruke je naziv ove tvrtke.</p>
              )}
              {!ctx.org.isDemo && provider === "twilio" && (
                <p>
                  SMS se šalju preko Twilija s NOVO pošiljatelja. U tekstu poruke je naziv ove tvrtke, a u svakoj je i poveznica za odjavu.
                </p>
              )}
              {!ctx.org.isDemo && provider === "gateway" && (
                <>
                  <p>Ova tvrtka još ima vlastiti mobitel iz starog načina, pa SMS idu s njega, a ne s NOVO pošiljatelja.</p>
                  <LegacyPhoneSwitch canEdit={canEdit && sharedSmsReady} />
                  {!sharedSmsReady && <p className="text-xs text-muted">Prebacivanje je moguće tek kad NOVO postavi SMS pošiljatelja.</p>}
                </>
              )}
              {!ctx.org.isDemo && !provider && (
                <p className="flex items-start gap-2 text-warning">
                  <CircleAlert className="mt-0.5 size-4 shrink-0" />
                  <span>SMS se zasad ne mogu slati jer SMS pošiljatelj nije postavljen.</span>
                </p>
              )}
              {!ctx.org.isDemo &&
                provider !== "novo" &&
                provider !== "textbee" &&
                provider !== "twilio" &&
                (isOperator ? (
                  <Link href="/admin/recenzije" className="label inline-block text-accent underline underline-offset-4">
                    Otvori admin →
                  </Link>
                ) : (
                  <p className="text-xs text-muted">Javite se NOVO-u.</p>
                ))}
            </CardBody>
          </Card>

          <Card id="google">
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <GoogleIcon /> Google Business
                </span>
              }
              description="Nije obavezno. Recenzije rade i preko linka ili Place ID-a."
              action={
                <Badge tone={connected ? "green" : conn?.status === "ERROR" ? "red" : "neutral"} dot>
                  {connected ? "Povezano" : conn?.status === "ERROR" ? "Greška" : "Nije povezano"}
                </Badge>
              }
            />
            <CardBody className="space-y-4 pt-3">
              {conn && (
                <dl className="grid gap-3 text-sm">
                  <div className="min-w-0">
                    <dt className="label text-muted">Lokacija</dt>
                    <dd className="mt-1 break-words">{conn.locationTitle ?? ctx.org.name}</dd>
                  </div>
                  <div>
                    <dt className="label text-muted">Zadnje preuzimanje</dt>
                    <dd className="mt-1">{ctx.org.googleSyncedAt ? timeAgo(ctx.org.googleSyncedAt) : "Nikad"}</dd>
                  </div>
                  {conn.googleEmail && (
                    <div className="min-w-0">
                      <dt className="label text-muted">Račun</dt>
                      <dd className="mt-1 break-all text-[13px]">{conn.googleEmail}</dd>
                    </div>
                  )}
                </dl>
              )}
              {conn?.lastError && (
                <p className="flex items-start gap-2 border-l-[3px] border-danger bg-danger-soft px-3 py-2 text-[13px] text-danger">
                  <CircleAlert className="mt-0.5 size-4 shrink-0" /> <span className="min-w-0 break-words">{conn.lastError}</span>
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2">
                {integrations.googleOAuth() && canEdit ? (
                  <Button asChild size="sm" variant={connected ? "secondary" : "primary"}>
                    {/* Puna navigacija: pokreće Google OAuth. */}
                    {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
                    <a href="/api/recenzije/google/connect">
                      <GoogleIcon /> {connected ? "Ponovno poveži" : "Poveži Google"}
                    </a>
                  </Button>
                ) : (
                  <Button size="sm" disabled>
                    <GoogleIcon /> Poveži Google
                  </Button>
                )}
                {conn && canEdit && <GoogleActions />}
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
