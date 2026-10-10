"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { initialState, type ActionState } from "@/lib/recenzije/action";
import {
  checkOrgTextbeeAction,
  regenerateOrgSecretAction,
  removeOrgTextbeeAction,
  revealOrgSecretAction,
  saveOrgTextbeeAction,
  sendOrgTestSmsAction,
} from "@/lib/recenzije/actions/novo-admin";
import RecenzijeConfirmButton from "@/components/admin/RecenzijeConfirmButton";
import { CopyButton, Notice, SubmitButton } from "@/components/admin/RecenzijeSmsCard";

/**
 * Mobitel jednog klijenta (TextBee): poruke tog klijenta odlaze s broja tog mobitela, a ne sa zajedničkog pošiljatelja. Samo za glavnog admina
 * (kartica klijenta je dio /admin/recenzije; svaka radnja ponovno provjerava ovlast na serveru). API ključ je samo za upis: ovamo nikad ne stiže,
 * pa ga forma ne može prikazati. Tajna webhooka se ne šalje u HTML stranice, nego se dohvaća tek na zahtjev (gumb „Prikaži tajnu”).
 */

export type ClientPhoneProps = {
  orgId: string;
  orgName: string;
  /** Ključ je spremljen (sam ključ se ne prikazuje). */
  keySet: boolean;
  deviceId: string | null;
  secretSet: boolean;
  webhookUrl: string;
  webhookUrlProblem: string | null;
  /** Kad je potpisan webhook zadnji put stigao (već oblikovano za prikaz) ili null. */
  hookSeenLabel: string | null;
  events: string[];
};

const ghostBtn = "text-xs font-semibold px-4 py-2 rounded-full border border-black/15 hover:border-black/40";
const smallLabel = "flex flex-col gap-1 text-xs text-black/60 min-w-0";

export default function RecenzijeClientPhone(p: ClientPhoneProps) {
  const [check, checkAction] = useActionState(checkOrgTextbeeAction, initialState);
  const [test, testAction] = useActionState(sendOrgTestSmsAction, initialState);
  const [reveal, revealAction] = useActionState(revealOrgSecretAction, initialState);
  const [regen, regenAction] = useActionState(regenerateOrgSecretAction, initialState);

  // Polja su kontrolirana: React nakon svake radnje prazni obične forme, a ključ upisan za „Provjeri vezu” treba ostati do „Spremi”.
  const [apiKey, setApiKey] = useState("");
  const [deviceId, setDeviceId] = useState(p.deviceId ?? "");
  const [save, saveAction] = useActionState(async (prev: ActionState, fd: FormData) => {
    const next = await saveOrgTextbeeAction(prev, fd);
    if (next.ok) setApiKey(""); // spremljeni ključ je šifriran na serveru; polje se prazni
    return next;
  }, initialState);

  const configured = p.keySet && !!p.deviceId;
  // Najnovija tajna: nova (nakon „Nova tajna”) ima prednost pred prikazanom.
  const secret =
    (typeof regen.data?.secret === "string" ? regen.data.secret : null) ?? (typeof reveal.data?.secret === "string" ? reveal.data.secret : null);

  return (
    <div className="flex flex-col gap-4 text-xs">
      <p className="text-black/60 max-w-[80ch]">
        Poruke ovog klijenta odlaze s broja mobitela koji ovdje povežete (TextBee na tom mobitelu). Dok mobitel nije postavljen, šalje se zajedničkim pošiljateljem. Ako slanje s
        ovog mobitela ne uspije, poruka se <b className="text-black">ne šalje drugim brojem</b>, nego se sprema kao neuspjela s razlogom.
      </p>

      <form action={saveAction} className="flex flex-col gap-3" noValidate autoComplete="off">
        <input type="hidden" name="orgId" value={p.orgId} />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={smallLabel}>
            API ključ
            <input
              name="apiKey"
              type="password"
              autoComplete="new-password"
              spellCheck={false}
              placeholder={p.keySet ? "postavljen (ostavite prazno da ostane)" : "ključ iz TextBee nadzorne ploče"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="admin-input text-sm"
              aria-invalid={!!(save.fieldErrors?.apiKey || check.fieldErrors?.apiKey)}
            />
            {(save.fieldErrors?.apiKey || check.fieldErrors?.apiKey) && (
              <span className="text-[11px] text-[#b80012]">{save.fieldErrors?.apiKey ?? check.fieldErrors?.apiKey}</span>
            )}
          </label>
          <label className={smallLabel}>
            ID uređaja
            <input
              name="deviceId"
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              placeholder="ID mobitela u TextBeeu"
              className="admin-input text-sm font-mono"
              aria-invalid={!!save.fieldErrors?.deviceId}
            />
            {save.fieldErrors?.deviceId && <span className="text-[11px] text-[#b80012]">{save.fieldErrors.deviceId}</span>}
          </label>
        </div>
        <SaveCheckButtons checkAction={checkAction} />
        {save.error && <Notice ok={false}>{save.error}</Notice>}
        {save.ok && save.message && <Notice ok>{save.message}</Notice>}
        {check.error && <Notice ok={false}>{check.error}</Notice>}
        {check.ok && check.message && <Notice ok>{check.message}</Notice>}
        <p className="text-[11px] text-black/45">
          „Provjeri vezu” samo čita popis uređaja i ne šalje nikakvu poruku. Ključ se nikad ne prikazuje; prazno polje zadržava spremljeni.
        </p>
      </form>

      {configured && (
        <form action={testAction} className="flex flex-col gap-2" noValidate>
          <input type="hidden" name="orgId" value={p.orgId} />
          <label className={smallLabel}>
            Probna poruka na broj (šalje se s mobitela ovog klijenta)
            <input
              name="to"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              placeholder="npr. 091 234 5678 (vaš broj)"
              defaultValue={test.values?.to}
              className="admin-input text-sm"
              aria-invalid={!!test.fieldErrors?.to}
            />
            {test.fieldErrors?.to && <span className="text-[11px] text-[#b80012]">{test.fieldErrors.to}</span>}
          </label>
          <div>
            <SubmitButton pendingLabel="Šaljem…" className={ghostBtn}>
              Pošalji probnu poruku
            </SubmitButton>
          </div>
          {test.error && <Notice ok={false}>{test.error}</Notice>}
          {test.ok && test.message && <Notice ok>{test.message}</Notice>}
        </form>
      )}

      {p.secretSet && (
        <div className="rounded-xl border border-black/10 p-3 flex flex-col gap-2.5 min-w-0">
          <div className="font-semibold text-sm">Odgovori i isporuka (webhook)</div>
          {p.hookSeenLabel ? (
            <div className="text-[#0b7a3e] font-semibold">Webhook radi: zadnji događaj {p.hookSeenLabel}.</div>
          ) : (
            <div className="rounded-lg border border-[#ff7f00]/30 bg-[#ff7f00]/5 px-3 py-2 text-[#7a3a00]">
              Webhook još nije primio nijedan događaj. Poruke ovog klijenta već završavaju uputom „Za odjavu napišite STOP.”, ali odgovor STOP neće stići dok ne napravite
              webhook u TextBeeu (koraci ispod).
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <div className="text-black/55">Adresa webhooka:</div>
            <div className="flex items-center gap-2 flex-wrap">
              <code className="font-mono text-xs break-all select-all min-w-0 flex-1 basis-60">{p.webhookUrl}</code>
              <CopyButton text={p.webhookUrl} />
            </div>
            {p.webhookUrlProblem && (
              <div className="text-[#9a4a00]">Ova adresa trenutno nije javna ({p.webhookUrlProblem}), pa je TextBee ne može dosegnuti. Postavite NR_APP_URL na javnu https adresu.</div>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="text-black/55">Tajna webhooka:</div>
            {secret && (
              <div className="flex items-center gap-2 flex-wrap">
                <code className="font-mono text-xs break-all select-all min-w-0 flex-1 basis-60">{secret}</code>
                <CopyButton text={secret} />
              </div>
            )}
            <div className="flex gap-2 flex-wrap items-center">
              {!secret && (
                <form action={revealAction}>
                  <input type="hidden" name="orgId" value={p.orgId} />
                  <SubmitButton pendingLabel="Učitavam…" className={ghostBtn}>
                    Prikaži tajnu
                  </SubmitButton>
                </form>
              )}
              <form
                action={regenAction}
                onSubmit={(e) => {
                  // Stara tajna odmah prestaje vrijediti, pa odgovori i isporuka ne stižu dok se nova ne upiše u TextBee.
                  if (!window.confirm("Nova tajna odmah zamjenjuje staru. Odgovori i isporuka neće stizati dok je ne upišete u webhook u TextBeeu. Nastaviti?")) e.preventDefault();
                }}
              >
                <input type="hidden" name="orgId" value={p.orgId} />
                <SubmitButton pendingLabel="Mijenjam…" className={ghostBtn}>
                  Nova tajna
                </SubmitButton>
              </form>
            </div>
            {reveal.error && <Notice ok={false}>{reveal.error}</Notice>}
            {regen.error && <Notice ok={false}>{regen.error}</Notice>}
            {regen.ok && regen.message && <Notice ok>{regen.message}</Notice>}
          </div>

          <ol className="flex list-decimal flex-col gap-1 pl-5 text-black/70 max-w-[80ch]">
            <li>
              U TextBee nadzornoj ploči tog mobitela (račun s kojim je mobitel povezan) otvorite Webhooks i napravite novi webhook s gornjom <b className="text-black">adresom</b>.
            </li>
            <li>
              U polje za tajnu (signing secret) zalijepite gornju <b className="text-black">tajnu</b>.
            </li>
            <li>
              Označite događaje{" "}
              {p.events.map((e) => (
                <code key={e} className="font-mono text-[11px] bg-black/5 rounded px-1.5 py-0.5 mr-1 inline-block break-all">
                  {e}
                </code>
              ))}
              pa spremite. Pošaljite probnu poruku: iznad se tada pojavi „Webhook radi”.
            </li>
          </ol>
          <p className="text-[11px] text-black/45">
            Privatnost: uz webhook TextBee na server šalje svaki SMS primljen na tom mobitelu, ne samo odgovore klijenata. Odgovor STOP odjavljuje broj u svim klijentima.
          </p>
        </div>
      )}

      {configured && (
        <div>
          <RecenzijeConfirmButton
            action={removeOrgTextbeeAction}
            orgId={p.orgId}
            title={`Ukloniti mobitel klijenta ${p.orgName}?`}
            description="Ključ, ID uređaja i tajna webhooka se brišu. Poruke ovog klijenta od sada idu zajedničkim pošiljateljem, s drugog broja."
            buttonLabel="Ukloni"
            confirmLabel="Ukloni mobitel"
            pendingLabel="Uklanjam…"
          />
        </div>
      )}
    </div>
  );
}

/** „Spremi” (radnja forme) i „Provjeri vezu” (formAction) u istoj formi: tekst čekanja mijenja samo gumb koji je kliknut. */
function SaveCheckButtons({ checkAction }: { checkAction: (formData: FormData) => void }) {
  const { pending } = useFormStatus();
  const [clicked, setClicked] = useState<"save" | "check">("save");
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="submit"
        disabled={pending}
        onClick={() => setClicked("save")}
        className="rounded-full bg-black text-white text-xs font-semibold px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {pending && clicked === "save" ? "Spremam…" : "Spremi"}
      </button>
      <button type="submit" formAction={checkAction} disabled={pending} onClick={() => setClicked("check")} className={ghostBtn + " disabled:opacity-50 disabled:cursor-not-allowed"}>
        {pending && clicked === "check" ? "Provjeravam…" : "Provjeri vezu"}
      </button>
    </div>
  );
}
