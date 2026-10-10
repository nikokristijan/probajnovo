"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ImageOff, ShieldAlert, ShieldCheck, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { checkMenuSlugAction, saveMenuSettingsAction } from "@/lib/recenzije/actions/menu";
import ImageUploader from "@/components/admin/ImageUploader";
import { Button } from "@/components/recenzije/ui/button";
import { Dialog, DialogContent, Switch } from "@/components/recenzije/ui/dialog";
import { Card, CardBody, CardHeader, Field, Input, Select, Textarea } from "@/components/recenzije/ui/primitives";
import { guestConsentDetails, guestConsentSummary } from "@/lib/recenzije/guest-consent";
import { defaultMenuTitle, MENU_KIND_LABELS, MENU_KINDS, menuNoun, type MenuKind } from "@/lib/recenzije/menu-noun";
import { validateMenuSlug } from "@/lib/recenzije/menu-slug";
import { cn } from "@/lib/recenzije/utils";
import { DELAY_OPTIONS, type MenuSettingsDTO } from "./menu-types";

/** Polja uz koja se greška prikazuje u obrascu; za sve ostalo greška ide u obavijest. */
const SHOWN_FIELDS = ["slug", "title", "intro", "introEn", "externalUrl", "logoUrl", "delayMinutes", "menuKind"];

type SlugState = { kind: "idle" } | { kind: "checking" } | { kind: "free" } | { kind: "error"; message: string };

/** Postavke jelovnika: tekstovi, vanjska adresa, odgoda poruke, pregled bez broja i javna adresa (slug). */
export function MenuSettingsForm({ settings, host, readOnly }: { settings: MenuSettingsDTO; host: string; readOnly: boolean }) {
  // Nakon spremanja poslužitelj vraća nove postavke; ključ ponovno postavlja obrazac na spremljene vrijednosti.
  const key = [settings.slug, settings.title, settings.intro, settings.introEn, settings.externalUrl, settings.logoUrl, settings.allowSkip, settings.delayMinutes, settings.menuKind, settings.noticesEnabled].join("\u0001");
  return <SettingsFormInner key={key} settings={settings} host={host} readOnly={readOnly} />;
}

function SettingsFormInner({ settings, host, readOnly }: { settings: MenuSettingsDTO; host: string; readOnly: boolean }) {
  const [pending, start] = useTransition();
  const [title, setTitle] = useState(settings.title);
  const [intro, setIntro] = useState(settings.intro ?? "");
  const [introEn, setIntroEn] = useState(settings.introEn ?? "");
  const [externalUrl, setExternalUrl] = useState(settings.externalUrl ?? "");
  const [logoUrl, setLogoUrl] = useState(settings.logoUrl ?? "");
  const [logoBroken, setLogoBroken] = useState(false);
  const [delay, setDelay] = useState(settings.delayMinutes);
  const [allowSkip, setAllowSkip] = useState(settings.allowSkip);
  const [menuKind, setMenuKind] = useState<MenuKind>(settings.menuKind);
  const [notices, setNotices] = useState(settings.noticesEnabled);
  const [slug, setSlug] = useState(settings.slug);
  const [slugState, setSlugState] = useState<SlugState>({ kind: "idle" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmSlug, setConfirmSlug] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(settings.slug);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const slugChanged = slug.trim() !== settings.slug;
  const dirty =
    slugChanged ||
    title.trim() !== settings.title ||
    intro.trim() !== (settings.intro ?? "") ||
    introEn.trim() !== (settings.introEn ?? "") ||
    externalUrl.trim() !== (settings.externalUrl ?? "") ||
    logoUrl.trim() !== (settings.logoUrl ?? "") ||
    delay !== settings.delayMinutes ||
    allowSkip !== settings.allowSkip ||
    menuKind !== settings.menuKind ||
    notices !== settings.noticesEnabled;
  const slugOk = !slugChanged || slugState.kind === "free";

  function onSlugChange(raw: string) {
    const value = raw.toLowerCase().replace(/\s+/g, "-");
    setSlug(value);
    latest.current = value;
    setErrors((e) => ({ ...e, slug: "" }));
    if (timer.current) clearTimeout(timer.current);
    const v = value.trim();
    if (v === settings.slug) return setSlugState({ kind: "idle" });
    const local = validateMenuSlug(v);
    if (!local.ok) return setSlugState({ kind: "error", message: local.error });
    setSlugState({ kind: "checking" });
    timer.current = setTimeout(async () => {
      const r = await checkMenuSlugAction(v);
      if (latest.current !== value) return;
      setSlugState(r.ok ? { kind: "free" } : { kind: "error", message: r.error });
    }, 400);
  }

  function save() {
    setErrors({});
    start(async () => {
      const r = await saveMenuSettingsAction({
        ...(slugChanged ? { slug: slug.trim() } : {}),
        title,
        intro: intro.trim() || null,
        introEn: introEn.trim() || null,
        externalUrl: externalUrl.trim() || null,
        logoUrl: logoUrl.trim() || null,
        allowSkip,
        menuKind,
        noticesEnabled: notices,
        delayMinutes: delay,
      });
      if (r.ok) toast.success(r.message);
      else {
        if (!r.field || !SHOWN_FIELDS.includes(r.field)) toast.error(r.error);
        setErrors({ [r.field ?? "form"]: r.error });
        if (r.field === "slug") setSlugState({ kind: "error", message: r.error });
      }
    });
  }

  const delayOptions = DELAY_OPTIONS.some((o) => o.value === delay)
    ? DELAY_OPTIONS
    : [...DELAY_OPTIONS, { value: delay, label: `${delay} minuta` }].sort((a, b) => a.value - b.value);

  return (
    <Card>
      <CardHeader title="Postavke jelovnika" description="Što gost vidi, kada stiže poruka i na kojoj je adresi jelovnik." />
      <CardBody>
        <form
          className="space-y-5"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (!dirty || !slugOk) return;
            if (slugChanged) setConfirmSlug(true);
            else save();
          }}
        >
          <fieldset disabled={readOnly || pending} className="min-w-0 space-y-5">
            <Field
              label="Naziv na stranici"
              htmlFor="m-kind"
              error={errors.menuKind}
              hint="Kako gost zove stranicu: na gumbima, u naslovu, u podnožju i u tekstu privole piše „jelovnik” ili „meni”. Zadani naslov se prilagodi, a vlastiti naslov ostaje."
            >
              <Select
                id="m-kind"
                value={menuKind}
                onChange={(e) => {
                  const next = e.target.value as MenuKind;
                  // Zadani naslov prati odabir; vlastiti naslov se ne dira.
                  if (MENU_KINDS.some((k) => title.trim().toLowerCase() === defaultMenuTitle(k).toLowerCase())) setTitle(defaultMenuTitle(next));
                  setMenuKind(next);
                }}
              >
                {MENU_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {MENU_KIND_LABELS[k]}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Naslov" htmlFor="m-title" error={errors.title} hint="Prikazuje se gostima iznad stranice, npr. Jelovnik, Meni ili Karta pića.">
              <Input id="m-title" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} aria-invalid={errors.title ? true : undefined} />
            </Field>

            <Field label="Uvod" htmlFor="m-intro" error={errors.intro} hint="Neobavezno. Kratka rečenica ispod naslova, npr. o radnom vremenu ili dnevnoj ponudi.">
              <Textarea id="m-intro" rows={3} value={intro} maxLength={600} onChange={(e) => setIntro(e.target.value)} aria-invalid={errors.intro ? true : undefined} />
            </Field>

            <details className="group border border-border bg-surface-2 px-3 py-2.5 [&[open]>summary]:mb-3" open={Boolean(settings.introEn)}>
              <summary className="label flex min-h-6 cursor-pointer select-none items-center text-muted">Engleski</summary>
              <Field
                label="Uvod (engleski)"
                htmlFor="m-intro-en"
                error={errors.introEn}
                hint="Prekidač HR / EN na javnoj stranici pojavljuje se tek kad postoji ijedan engleski tekst (uvod, naziv ili opis)."
              >
                <Textarea id="m-intro-en" rows={3} value={introEn} maxLength={600} onChange={(e) => setIntroEn(e.target.value)} />
              </Field>
            </details>

            <div className="border border-border bg-surface-2 p-4">
              <p className="text-sm font-bold">Logo lokala</p>
              <p className="mt-1 text-[13px] text-muted">
                Neobavezno. Prikazuje se na vrhu jelovnika i vrata, na crnoj podlozi. Najbolje izgleda logo s prozirnom pozadinom i svijetlim ili zlatnim
                crtežom; bez logotipa gost vidi naziv lokala.
              </p>
              <div className="mt-3 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start">
                <div
                  className="flex h-24 w-full shrink-0 items-center justify-center border border-border-strong bg-[#0a0a0a] p-3 sm:w-56"
                  aria-label="Pregled logotipa na crnoj podlozi"
                >
                  {logoUrl.trim() && !logoBroken ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoUrl.trim()} alt="Logo lokala" className="max-h-full max-w-full object-contain" onError={() => setLogoBroken(true)} />
                  ) : (
                    <span className="flex items-center gap-2 text-[12px] text-[#a8a29a]">
                      <ImageOff className="size-4" aria-hidden />
                      {logoUrl.trim() ? "Slika se ne može učitati" : "Nema logotipa"}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-3">
                  <ImageUploader
                    label="Učitaj sliku"
                    helpText="PNG, WebP ili JPG, do 10 MB."
                    value={[]}
                    onChange={(urls) => {
                      setLogoUrl(urls[0] ?? "");
                      setLogoBroken(false);
                    }}
                  />
                  <Field label="ili adresa slike (https)" htmlFor="m-logo" error={errors.logoUrl} hint="Ako učitavanje nije dostupno, zalijepite https adresu slike.">
                    <Input
                      id="m-logo"
                      type="url"
                      inputMode="url"
                      value={logoUrl}
                      maxLength={1000}
                      placeholder="https://www.konoba.hr/logo.png"
                      onChange={(e) => {
                        setLogoUrl(e.target.value);
                        setLogoBroken(false);
                      }}
                      aria-invalid={errors.logoUrl ? true : undefined}
                    />
                  </Field>
                  {logoUrl.trim() && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setLogoUrl("");
                        setLogoBroken(false);
                      }}
                    >
                      Ukloni logo
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <Field
              label="Vlastiti jelovnik (adresa)"
              htmlFor="m-url"
              error={errors.externalUrl}
              hint="Neobavezno. Ako lokal već ima jelovnik (stranica ili PDF), upišite https adresu: gost ga otvara umjesto našeg prikaza."
            >
              <Input
                id="m-url"
                type="url"
                inputMode="url"
                value={externalUrl}
                maxLength={500}
                placeholder="https://www.konoba.hr/jelovnik.pdf"
                onChange={(e) => setExternalUrl(e.target.value)}
                aria-invalid={errors.externalUrl ? true : undefined}
              />
            </Field>

            <Field
              label="Poruka za recenziju stiže nakon"
              htmlFor="m-delay"
              error={errors.delayMinutes}
              hint="Računa se od unosa broja. Poruke se ne šalju između 22:00 i 09:00: takva poruka ide u 09:00 idućeg jutra."
            >
              <Select id="m-delay" value={delay} onChange={(e) => setDelay(Number(e.target.value))}>
                {delayOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="border border-border bg-surface-2 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-bold">Dopusti pregled bez broja</p>
                  <p className="mt-1 text-[13px] text-muted">
                    Zadano uključeno. Ispod polja za broj gost vidi sitnu poveznicu „Pogledaj {menuNoun(menuKind).acc} bez unosa broja”. Takav pregled ništa ne sprema i ne šalje.
                  </p>
                </div>
                <Switch checked={allowSkip} onCheckedChange={setAllowSkip} label="Dopusti pregled bez broja" />
              </div>
              <div
                className={cn(
                  "mt-3 flex items-start gap-2.5 border-l-[3px] p-3 text-[13px]",
                  allowSkip ? "border-success bg-success-soft text-success" : "border-orange bg-orange-soft text-warning"
                )}
                role="note"
              >
                {allowSkip ? <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden /> : <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />}
                <p className="text-foreground/80">
                  {allowSkip ? (
                    <>
                      <b>Zadano i preporučeno stanje.</b> Gost uvijek može otvoriti {menuNoun(menuKind).acc} i bez broja (sitna poveznica ispod polja), pa je privola dobrovoljna.
                    </>
                  ) : (
                    <>
                      <b>Upozorenje (GDPR):</b> poveznica je uklonjena pa je broj mobitela obavezan za {menuNoun(menuKind).acc}. To može biti u sukobu s GDPR-om jer privola mora biti
                      dobrovoljna, a odgovornost za takvu postavku je vaša. Preporuka: ostavite pregled bez broja uključen.
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="border border-border bg-surface-2 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-bold">Lokal šalje i povremene obavijesti o novostima, događanjima i ponudama</p>
                  <p className="mt-1 text-[13px] text-muted">
                    Zadano isključeno: gost pristaje samo na jednu poruku s molbom za Google recenziju. Uključeno: gost vidi drugi tekst privole koji
                    spominje obavijesti o novostima, događanjima i ponudama, a samo gosti koji su ga prihvatili mogu dobiti više od te jedne poruke
                    (ručne poruke, podsjetnike i kampanje). Promjena vrijedi za nove goste; svatko zadržava privolu koju je dao.
                  </p>
                </div>
                <Switch checked={notices} onCheckedChange={setNotices} label="Lokal šalje i povremene obavijesti o novostima, događanjima i ponudama" />
              </div>
              <div className="mt-3 border-l-[3px] border-border-strong bg-surface p-3 text-[13px]" role="note">
                <p className="label text-muted">Tekst privole koji gost vidi</p>
                <p className="mt-1.5 text-foreground">
                  {guestConsentSummary(settings.venueName, delay, { noticesEnabled: notices, menuKind, allowSkip })}
                </p>
                <p className="mt-1.5 text-muted">{guestConsentDetails(delay, { noticesEnabled: notices, menuKind, allowSkip })}</p>
              </div>
              {notices && (
                <p className="mt-3 flex items-start gap-2.5 border-l-[3px] border-orange bg-orange-soft p-3 text-[13px] text-foreground/80" role="note">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                  <span>
                    <b>Vi odgovarate za sadržaj i učestalost obavijesti.</b> Šaljite samo ono što piše u privoli, rijetko i bez obmanjujućih poruka. Noću
                    (22:00 do 09:00) poruke gostima s jelovnika ne odlaze. Preporučujemo da pravnik pregleda tekst privole prije uključivanja.
                  </span>
                </p>
              )}
            </div>

            <div>
              <label htmlFor="m-slug" className="label mb-2 block text-muted">
                Adresa jelovnika
              </label>
              <div className="flex min-w-0 items-stretch">
                <span className="hidden max-w-[55%] shrink-0 items-center truncate border border-r-0 border-border-strong bg-surface-2 px-3 font-mono text-xs text-muted sm:flex">
                  {host}/jelovnik/
                </span>
                <Input
                  id="m-slug"
                  value={slug}
                  maxLength={40}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  onChange={(e) => onSlugChange(e.target.value)}
                  aria-invalid={slugState.kind === "error" || errors.slug ? true : undefined}
                  aria-describedby="m-slug-help"
                  className="min-w-0 flex-1 font-mono"
                />
              </div>
              <p className="mt-1.5 break-all font-mono text-[11px] text-muted sm:hidden">
                {host}/jelovnik/{slug.trim() || "…"}
              </p>
              <div id="m-slug-help" className="mt-1.5 text-xs" aria-live="polite">
                {slugState.kind === "checking" && <p className="text-muted">Provjeravam je li adresa slobodna…</p>}
                {slugState.kind === "free" && <p className="text-success">Adresa je slobodna.</p>}
                {slugState.kind === "error" && <p className="text-danger">{slugState.message}</p>}
                {slugState.kind === "idle" && errors.slug && <p className="text-danger">{errors.slug}</p>}
                {slugState.kind === "idle" && !errors.slug && <p className="text-muted">Mala slova bez kvačica, brojevi i crtice (3 do 40 znakova).</p>}
              </div>
              {slugChanged && (
                <p className="mt-2 flex items-start gap-2 border-l-[3px] border-orange bg-orange-soft p-3 text-[13px] text-foreground/80">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                  <span>
                    <b>Pažnja:</b> promjena adrese prekida već ispisane QR kodove sa starom adresom. Nakon promjene treba ispisati nove kodove.
                  </span>
                </p>
              )}
            </div>
          </fieldset>

          {readOnly ? (
            <p className="text-xs text-muted">Ovo je primjer za razgledavanje, izmjene su isključene.</p>
          ) : (
            <div className="flex flex-col-reverse items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end">
              {!dirty && <span className="text-xs text-muted sm:mr-2">Nema nespremljenih izmjena.</span>}
              <Button type="submit" loading={pending} disabled={!dirty || !slugOk} className="sm:min-w-32">
                Spremi postavke
              </Button>
            </div>
          )}
        </form>
      </CardBody>

      <Dialog open={confirmSlug} onOpenChange={setConfirmSlug}>
        <DialogContent
          title="Promijeniti adresu jelovnika?"
          description={`Nova adresa: ${host}/jelovnik/${slug.trim()}`}
        >
          <p className="text-sm text-foreground/80">
            Već ispisani QR kodovi sa starom adresom (<b>{settings.slug}</b>) prestat će raditi i gosti će vidjeti grešku. Nakon spremanja ispišite nove kodove u izborniku „QR plakat”.
          </p>
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={() => setConfirmSlug(false)}>
              Odustani
            </Button>
            <Button
              type="button"
              onClick={() => {
                setConfirmSlug(false);
                save();
              }}
            >
              Promijeni adresu
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
