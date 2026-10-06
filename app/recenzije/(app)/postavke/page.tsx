import Link from "next/link";
import { eq } from "drizzle-orm";
import { Bot, CheckCircle2, CircleAlert, CreditCard, Mail, MessageSquare, Smartphone, Timer } from "lucide-react";
import { GoogleIcon } from "@/components/recenzije/auth/oauth";
import { GoogleActions, SmsGatewayForm } from "@/components/recenzije/app/settings/forms";
import { CopyButton } from "@/components/recenzije/app/clients/client-actions";
import { Button } from "@/components/recenzije/ui/button";
import { Alert, Badge, Card, CardBody, CardHeader, PageHeader } from "@/components/recenzije/ui/primitives";
import { db } from "@/lib/recenzije/db";
import { googleConnections } from "@/lib/recenzije/db/schema";
import { env, integrations } from "@/lib/recenzije/env";
import { requireOrg } from "@/lib/recenzije/session";
import { timeAgo } from "@/lib/recenzije/status";

export const metadata = { title: "Postavke" };

const GOOGLE_MESSAGES: Record<string, { tone: "green" | "red" | "amber"; text: string }> = {
  connected: { tone: "green", text: "Google Business Profile je povezan." },
  denied: { tone: "amber", text: "Pristup Googleu nije odobren." },
  invalid_state: { tone: "red", text: "Google poveznica je istekla ili ne pripada ovoj prijavi. Pokušajte ponovno." },
  error: { tone: "red", text: "Povezivanje s Googleom nije uspjelo. Provjerite postavke Google Cloud projekta." },
  not_configured: { tone: "amber", text: "Google OAuth još nije postavljen (GOOGLE_CLIENT_ID i GOOGLE_CLIENT_SECRET)." },
  demo: { tone: "amber", text: "Demo se ne može povezati s pravim Google profilom." },
  forbidden: { tone: "red", text: "Google mogu povezati samo vlasnik i admini." },
};

function Status({ ok, label }: { ok: boolean; label?: string }) {
  return (
    <Badge tone={ok ? "green" : "amber"} dot>
      {label ?? (ok ? "Povezano" : "Nije postavljeno")}
    </Badge>
  );
}

function EnvList({ vars }: { vars: string[] }) {
  return (
    <div className="border border-border bg-surface-2 p-3">
      <p className="mb-2 text-xs text-muted">Dodajte ove varijable u Vercel → Settings → Environment Variables (nikad u preglednik) pa ponovno deployajte:</p>
      <ul className="flex flex-wrap gap-1.5">
        {vars.map((v) => (
          <li key={v}>
            <code className="border border-border-strong bg-white px-2 py-0.5 font-mono text-[11px]">{v}</code>
          </li>
        ))}
      </ul>
    </div>
  );
}

function UrlRow({ label, url }: { label: string; url: string }) {
  return (
    <div className="min-w-0">
      <p className="label text-muted">{label}</p>
      <div className="mt-1.5 flex items-center gap-1 border border-border bg-surface-2 py-1 pl-3 pr-1">
        <code className="min-w-0 flex-1 truncate font-mono text-xs">{url}</code>
        <CopyButton value={url} />
      </div>
    </div>
  );
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ google?: string }> }) {
  const { google } = await searchParams;
  const ctx = await requireOrg();
  const [conn] = await db.select().from(googleConnections).where(eq(googleConnections.organizationId, ctx.org.id)).limit(1);
  const msg = google ? GOOGLE_MESSAGES[google] : null;
  const connected = conn?.status === "CONNECTED";
  const canEdit = ctx.role !== "MEMBER" && !ctx.org.isDemo;
  const gatewayOn = Boolean(ctx.org.smsGatewayUser && ctx.org.smsGatewayPassEnc);
  const twilioOn = integrations.twilio();

  return (
    <>
      <PageHeader
        kicker="Postavke"
        title="Povezivanje"
        description="Google, SMS, AI i naplata. Ništa se ne glumi: usluga piše „Povezano” tek kad stvarno radi."
        actions={
          <Button variant="secondary" asChild>
            <Link href="/recenzije/postavke/tvrtka">Profil tvrtke</Link>
          </Button>
        }
      />
      {msg && <Alert tone={msg.tone} title={msg.text} className="mb-4" />}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* SMS */}
        <Card className="lg:col-span-2" id="sms">
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <Smartphone className="size-4" /> SMS s vašeg mobitela
              </span>
            }
            description="Najjeftinije: poruke idu s vašeg broja preko starog Android mobitela, po cijeni vaše tarife (uz neograničene SMS-ove 0 €)."
            action={<Status ok={gatewayOn} label={gatewayOn ? `Povezano · ${ctx.org.smsGatewayUser}` : undefined} />}
          />
          <CardBody className="grid gap-6 lg:grid-cols-[1fr_1fr]">
            <ol className="space-y-3 text-[14px] leading-relaxed">
              {[
                <>Na Android mobitel s SIM karticom tvrtke instalirajte besplatnu aplikaciju <b>SMS Gateway for Android</b> (Google Play / sms-gate.app, otvoreni kod).</>,
                <>U aplikaciji uključite <b>Cloud server</b> i pritisnite Online. Pojavit će se korisničko ime i lozinka.</>,
                <>U aplikaciji: Settings → Webhooks → kopirajte <b>Signing Key</b>.</>,
                <>Upišite sve troje ovdje i spremite. Mi provjerimo vezu i sami postavimo potvrde isporuke i odgovore.</>,
                <>Mobitel ostavite na punjaču, s uključenim internetom. Poruke idu s vašeg broja, a odgovori klijenata (i STOP) stižu ovdje.</>,
              ].map((t, i) => (
                <li key={i} className="flex gap-3">
                  <span className="label mt-0.5 shrink-0 text-accent">0{i + 1}</span>
                  <span>{t}</span>
                </li>
              ))}
            </ol>
            <div className="space-y-4">
              <SmsGatewayForm connectedUser={ctx.org.smsGatewayUser} hasSigningKey={Boolean(ctx.org.smsGatewaySigningKeyEnc)} canEdit={canEdit} />
              <UrlRow label="Webhook adresa (postavlja se sama)" url={`${env.appUrl}/api/recenzije/webhooks/sms-gateway/${ctx.org.id}`} />
            </div>
          </CardBody>
          <div className="border-t border-border px-5 py-4">
            <p className="label flex items-center gap-2 text-muted">
              <MessageSquare className="size-3.5" /> Rezerva: Twilio (plaća se po poruci)
              <Status ok={twilioOn} label={twilioOn ? "Twilio uključen" : "Twilio nije postavljen"} />
            </p>
            {!twilioOn ? (
              <div className="mt-3">
                <EnvList vars={["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_PHONE_NUMBER"]} />
              </div>
            ) : (
              <p className="mt-2 flex items-center gap-2 text-sm">
                <CheckCircle2 className="size-4 text-success" /> Šalje s {env.twilioFrom || "Messaging Servicea"} za tvrtke bez povezanog mobitela.
              </p>
            )}
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <UrlRow label="Twilio: dolazne poruke (na broju)" url={`${env.appUrl}/api/recenzije/webhooks/twilio/inbound`} />
              <UrlRow label="Twilio: status isporuke (automatski)" url={`${env.appUrl}/api/recenzije/webhooks/twilio/status`} />
            </div>
          </div>
        </Card>

        {/* Google */}
        <Card className="lg:col-span-2" id="google">
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <GoogleIcon /> Google Business Profile
              </span>
            }
            description="Čita sve vaše recenzije, daje službeni link za recenziju i omogućuje odgovaranje odavde."
            action={<Status ok={connected} label={connected ? "Povezano" : conn?.status === "ERROR" ? "Greška" : "Nije povezano"} />}
          />
          <CardBody className="space-y-4">
            <dl className="grid gap-4 text-sm sm:grid-cols-3">
              <div>
                <dt className="label text-muted">Naziv</dt>
                <dd className="mt-1">{conn?.locationTitle ?? ctx.org.name}</dd>
              </div>
              <div>
                <dt className="label text-muted">Place ID</dt>
                <dd className="mt-1 truncate font-mono text-xs">{ctx.org.googlePlaceId ?? "—"}</dd>
              </div>
              <div>
                <dt className="label text-muted">Zadnje preuzimanje</dt>
                <dd className="mt-1">{ctx.org.googleSyncedAt ? timeAgo(ctx.org.googleSyncedAt) : "Nikad"}</dd>
              </div>
              <div className="sm:col-span-3">
                <dt className="label text-muted">Link za recenzije</dt>
                <dd className="mt-1 break-all text-[13px]">
                  {ctx.org.googleReviewUrl ?? (
                    <Link href="/recenzije/postavke/tvrtka" className="text-warning underline">
                      Nije postavljen. Dodajte ga u Profil tvrtke →
                    </Link>
                  )}
                </dd>
              </div>
            </dl>
            {conn?.googleEmail && <p className="text-xs text-muted">Prijavljeni kao {conn.googleEmail}</p>}
            {conn?.lastError && (
              <p className="flex items-start gap-2 border-l-[3px] border-danger bg-danger-soft px-3 py-2 text-[13px] text-danger">
                <CircleAlert className="mt-0.5 size-4 shrink-0" /> {conn.lastError}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {integrations.googleOAuth() && canEdit ? (
                <Button asChild variant={connected ? "secondary" : "primary"}>
                  {/* Puna navigacija: pokreće Google OAuth. */}
                  {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
                  <a href="/api/recenzije/google/connect">
                    <GoogleIcon /> {connected ? "Ponovno poveži" : "Poveži Google Business Profile"}
                  </a>
                </Button>
              ) : (
                <Button disabled>
                  <GoogleIcon /> Poveži Google Business Profile
                </Button>
              )}
              {conn && canEdit && <GoogleActions />}
            </div>
            {!integrations.googleOAuth() && (
              <>
                <EnvList vars={["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"]} />
                <p className="text-xs text-muted">
                  Google Cloud: napravite OAuth klijent (Web), dodajte redirect adrese ispod, uključite Business Profile API-je i zatražite pristup. Dok Google ne odobri projekt, API vraća 403 i to ćemo prikazati.
                </p>
              </>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <UrlRow label="OAuth redirect (Business Profile)" url={`${env.appUrl}/api/recenzije/google/callback`} />
              <UrlRow label="OAuth redirect (prijava Googleom)" url={`${env.appUrl}/api/recenzije/auth/google/callback`} />
            </div>
            <p className="text-xs text-muted">
              Bez OAutha: Place ID + <code className="font-mono">GOOGLE_PLACES_API_KEY</code> daju ocjenu i 5 najnovijih recenzija (Googleovo ograničenje).{" "}
