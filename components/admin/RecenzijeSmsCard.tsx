"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { initialState } from "@/lib/recenzije/action";
import { checkSmsStatusAction, registerWebhooksAction, sendTestSmsAction } from "@/lib/recenzije/actions/novo-admin";
import type { SmsSenderStatus } from "@/lib/recenzije/services/sms-status";

/**
 * SMS pošiljatelj za sve klijente: aktivni pružatelj (Twilio ili neobavezni NOVO Android mobitel), što mu fali,
 * kratka uputa za Twilio i probni SMS koji radi s oba. Stanje stiže sa servera (samo env, bez mreže); probni SMS,
 * provjera statusa i povezivanje webhookova su server radnje samo za glavnog admina. Prava greška (npr. Twilio
 * 21408) prikazuje se onakva kakva jest, s uputom.
 */

export type SmsSenderView = { available: true; status: SmsSenderStatus } | { available: false; error: string };

function SubmitButton({ children, pendingLabel, className, disabled }: { children: string; pendingLabel: string; className: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || disabled} className={className + " disabled:opacity-50 disabled:cursor-not-allowed"}>
      {pending ? pendingLabel : children}
    </button>
  );
}

function Notice({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <div
      role={ok ? "status" : "alert"}
      className={
        "rounded-xl border px-3.5 py-2 text-sm break-words " +
        (ok ? "border-[#0b7a3e]/30 bg-[#0b7a3e]/5" : "border-[#d70015]/30 bg-[#d70015]/5 text-[#b80012]")
      }
    >
      {children}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="text-xs font-semibold px-3 py-1.5 rounded-full border border-black/15 hover:border-black/40 shrink-0"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          /* adresa je označiva jednim klikom pa se može kopirati ručno */
        }
      }}
    >
      {copied ? "Kopirano" : "Kopiraj"}
    </button>
  );
}

function EnvList({ names }: { names: string[] }) {
  return (
    <ul className="mt-1 flex flex-wrap gap-1.5">
      {names.map((name) => (
        <li key={name}>
          <code className="font-mono text-xs bg-black/5 rounded px-1.5 py-0.5 break-all">{name}</code>
        </li>
      ))}
    </ul>
  );
}

const BADGE = {
  ok: "bg-[#0b7a3e]/10 text-[#0b7a3e]",
  warn: "bg-[#ff7f00]/12 text-[#9a4a00]",
  error: "bg-[#d70015]/8 text-[#b80012]",
} as const;

const PROVIDER_NAME = { twilio: "Twilio", novo: "NOVO mobitel (Android)", none: "nijedan" } as const;

export default function RecenzijeSmsCard({ sms }: { sms: SmsSenderView }) {
  const [test, testAction] = useActionState(sendTestSmsAction, initialState);
  const [check, checkAction] = useActionState(checkSmsStatusAction, initialState);
  const [hooks, hooksAction] = useActionState(registerWebhooksAction, initialState);

  const st = sms.available ? sms.status : null;
  // Dok status nije dostupan gumbi ostaju uključeni da se vidi prava greška; inače čekaju pružatelja.
  const blocked = st !== null && !st.ready;
  const lastSid = test.ok && test.data?.provider === "twilio" && typeof test.data.sid === "string" ? test.data.sid : null;

  const badge = !st ? "Status nedostupan" : st.active === "none" ? st.summary : `${st.summary} · ${st.level === "ok" ? "spreman" : "upozorenje"}`;
  const badgeCls = !st ? BADGE.error : BADGE[st.level];

  // Pružatelji koji nisu postavljeni. Dok nijedan ne radi, oba su otvorena; inače se sklapaju da ne smetaju.
  const notConfigured = st
    ? [
        { id: "twilio", label: "Twilio", note: "preporučeno bez Android mobitela", missing: st.twilio.missing, ok: st.twilio.configured },
        { id: "novo", label: "Android mobitel", note: "neobavezno", missing: st.novo.missing, ok: st.novo.configured },
      ].filter((p) => !p.ok && p.missing.length > 0)
    : [];

  return (
    <section className="neu-card px-4 py-4 flex flex-col gap-4" aria-labelledby="sms-posiljatelj">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h2 id="sms-posiljatelj" className="font-semibold text-sm">
            SMS pošiljatelj
          </h2>
          <p className="text-xs text-black/55 mt-0.5 max-w-[60ch]">
            Jedan zajednički pošiljatelj šalje poruke svih klijenata. Tekst poruke sadrži naziv klijentove tvrtke.
          </p>
        </div>
        <span className={"text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0 " + badgeCls}>{badge}</span>
      </div>

      {!sms.available && <Notice ok={false}>Status nije moguće pročitati: {sms.error}</Notice>}

      {st && (
        <dl className="grid gap-x-6 gap-y-1.5 text-xs sm:grid-cols-[auto_1fr]">
          <dt className="text-black/55">Aktivni pružatelj</dt>
          <dd className="font-semibold">{PROVIDER_NAME[st.active]}</dd>
          {st.active === "twilio" && (
            <>
              <dt className="text-black/55">Pošiljatelj</dt>
              <dd className="font-semibold break-words">{st.twilio.senderLabel}</dd>
              <dt className="text-black/55">Statusi isporuke</dt>
              <dd className={st.twilio.statusCallbackUsable ? "text-[#0b7a3e] font-semibold" : "text-[#9a4a00] font-semibold"}>
                {st.twilio.statusCallbackUsable ? "javljaju se na javnu https adresu" : `ne ažuriraju se (${st.twilio.statusCallbackProblem})`}
              </dd>
            </>
          )}
        </dl>
      )}

      {st && st.repliesLine && (
        <p className="text-xs max-w-[80ch]">
          <b>{st.repliesLine.slice(0, st.repliesLine.indexOf(":") + 1)}</b> {st.repliesLine.slice(st.repliesLine.indexOf(":") + 1).trim()}
        </p>
      )}

      {st && st.problems.length > 0 && (
        <div
          className={
            "rounded-xl border px-3.5 py-2.5 text-sm " +
            (st.level === "error"
              ? "border-[#d70015]/30 bg-[#d70015]/5 text-[#b80012]"
              : st.level === "warn"
                ? "border-[#ff7f00]/30 bg-[#ff7f00]/5"
                : "border-black/10 bg-black/[0.02] text-black/70")
          }
          role={st.level === "error" ? "alert" : undefined}
        >
          <ul className="flex flex-col gap-1">
            {st.problems.map((p) => (
              <li key={p} className="break-words">
                {p}
              </li>
            ))}
          </ul>
        </div>
      )}

      {notConfigured.map((p) =>
        st && st.active === "none" ? (
          <div key={p.id} className="rounded-xl border border-[#ff7f00]/30 bg-[#ff7f00]/5 px-3.5 py-2.5 text-sm">
            <div className="font-semibold">
              {p.label} ({p.note}): još fali u postavkama servera (env varijable)
            </div>
            <EnvList names={p.missing} />
          </div>
        ) : (
          <details key={p.id} className="group text-xs">
            <summary className="cursor-pointer font-semibold text-black/60 hover:text-black list-none inline-flex items-center gap-1">
              <span className="transition-transform group-open:rotate-90">›</span> {p.label} nije postavljen ({p.note})
            </summary>
            <div className="mt-1.5 pl-3">
              <div className="text-black/55">Fali:</div>
              <EnvList names={p.missing} />
            </div>
          </details>
        )
      )}

      {st && (
        <details className="group text-xs" open={!st.twilio.configured}>
          <summary className="cursor-pointer font-semibold text-black/70 hover:text-black list-none inline-flex items-center gap-1">
            <span className="transition-transform group-open:rotate-90">›</span> Postavljanje Twilija u 4 koraka
          </summary>
          <ol className="mt-2 flex list-decimal flex-col gap-1.5 pl-5 text-black/70 max-w-[80ch]">
            <li>
              <b className="text-black">Račun i broj/oznaka pošiljatelja.</b> Napravite Twilio račun, pa kupite broj ili odaberite alfanumeričku oznaku (do 11
              znakova, npr. <code className="font-mono">NOVO</code>). Hrvatska ne podržava dvosmjerni SMS, pa nitko ne može odgovoriti na poruku. Izvori se
              razilaze oko toga treba li oznaku prethodno registrirati; to potvrđuje probni SMS u koraku 4.
            </li>
            <li>
              <b className="text-black">Geo permissions.</b> U Twilio konzoli otvorite Messaging, Settings, Geo permissions i uključite Croatia. Bez toga Twilio
              vraća grešku 21408.
            </li>
            <li>
              <b className="text-black">Env varijable na serveru:</b> <code className="font-mono">TWILIO_ACCOUNT_SID</code>,{" "}
              <code className="font-mono">TWILIO_AUTH_TOKEN</code> i <code className="font-mono">TWILIO_PHONE_NUMBER</code> (broj +385… ili oznaka, npr. NOVO;
              ili umjesto njega <code className="font-mono">TWILIO_MESSAGING_SERVICE_SID</code>). <code className="font-mono">NR_APP_URL</code> mora biti javna
              https adresa, inače je slanje klijentima blokirano (poveznice za recenziju i odjavu ne bi radile). Neobavezno: <code className="font-mono">NR_SHORT_URL</code> (kraća javna adresa za poveznice u
              poruci).
            </li>
            <li>
              <b className="text-black">Probni SMS</b> na svoj mobitel (ispod), pa „Provjeri status”.
            </li>
          </ol>
        </details>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-3">
          <form action={testAction} className="flex flex-col gap-2" noValidate>
            <label className="flex flex-col gap-1 text-xs text-black/60">
              Probni SMS na broj{st && st.active !== "none" ? ` (šalje se preko: ${PROVIDER_NAME[st.active]})` : ""}
              <input
                name="to"
                type="tel"
                inputMode="tel"
                autoComplete="off"
                placeholder="npr. 091 234 5678"
                defaultValue={test.values?.to}
                className="admin-input text-sm"
                aria-invalid={!!test.fieldErrors?.to}
                disabled={blocked}
              />
              {test.fieldErrors?.to && <span className="text-[11px] text-[#b80012]">{test.fieldErrors.to}</span>}
            </label>
            <div>
              <SubmitButton pendingLabel="Šaljem…" disabled={blocked} className="rounded-full bg-black text-white text-xs font-semibold px-4 py-2">
                Pošalji probni SMS
              </SubmitButton>
            </div>
            {test.error && <Notice ok={false}>{test.error}</Notice>}
            {test.ok && test.message && <Notice ok>{test.message}</Notice>}
          </form>

          {lastSid && (
            <form action={checkAction} className="flex flex-col gap-2">
              <input type="hidden" name="sid" value={lastSid} />
              <div>
                <SubmitButton pendingLabel="Provjeravam…" className="text-xs font-semibold px-4 py-2 rounded-full border border-black/15 hover:border-black/40">
                  Provjeri status
                </SubmitButton>
              </div>
              {check.error && <Notice ok={false}>{check.error}</Notice>}
              {check.ok && check.message && <Notice ok>{check.message}</Notice>}
            </form>
          )}
        </div>

        {st && st.novo.configured && (
          <form action={hooksAction} className="flex flex-col gap-2">
            <div className="text-xs font-semibold">Android mobitel</div>
            <div className="flex flex-col gap-1.5 text-xs">
              <div className="text-black/55">Webhook adresa (odgovori i isporuka):</div>
              <div className="flex items-center gap-2 flex-wrap">
                <code className="font-mono text-xs break-all select-all min-w-0 flex-1 basis-60">{st.novo.webhookUrl}</code>
                <CopyButton text={st.novo.webhookUrl} />
              </div>
              <div className="text-black/55">
                Potpisni ključ webhookova:{" "}
                <b className={st.novo.signingKeyConfigured ? "text-[#0b7a3e]" : "text-[#9a4a00]"}>
                  {st.novo.signingKeyConfigured ? "postavljen" : "nije postavljen"}
                </b>
              </div>
            </div>
            <div className="text-xs text-black/60">
              Jednim klikom upiše webhook adresu u aplikaciju na mobitelu da se odgovori klijenata i isporuka vide u poruci.
            </div>
            <div>
              <SubmitButton pendingLabel="Povezujem…" className="text-xs font-semibold px-4 py-2 rounded-full border border-black/15 hover:border-black/40">
                Poveži webhookove
              </SubmitButton>
            </div>
            {hooks.error && <Notice ok={false}>{hooks.error}</Notice>}
            {hooks.ok && hooks.message && <Notice ok>{hooks.message}</Notice>}
          </form>
        )}
      </div>
    </section>
  );
}
