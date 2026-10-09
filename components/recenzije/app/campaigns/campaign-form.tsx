"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Rocket, Save, Users } from "lucide-react";
import { toast } from "sonner";
import { audiencePreviewAction, saveCampaignAction, type CampaignInput } from "@/lib/recenzije/actions/campaigns";
import { PhoneMockup } from "@/components/recenzije/phone";
import { Button } from "@/components/recenzije/ui/button";
import { Switch } from "@/components/recenzije/ui/dialog";
import { Card, Field, Input, Select, Textarea } from "@/components/recenzije/ui/primitives";
import { renderTemplate } from "@/lib/recenzije/messages";
import { REVIEW_STATUS, REVIEW_STATUS_ORDER } from "@/lib/recenzije/status";
import { cn } from "@/lib/recenzije/utils";

export function CampaignForm({
  initial,
  services,
  businessName,
  previewLink,
  locked,
}: {
  initial: CampaignInput & { status?: string };
  services: string[];
  businessName: string;
  previewLink: string;
  locked?: boolean;
}) {
  const router = useRouter();
  const [v, setV] = useState<CampaignInput>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [audience, setAudience] = useState<{ count: number; sample: string[] } | null>(null);
  const [saving, startSave] = useTransition();
  const [launching, startLaunch] = useTransition();
  const set = <K extends keyof CampaignInput>(k: K, val: CampaignInput[K]) => setV((s) => ({ ...s, [k]: val }));

  useEffect(() => {
    const t = setTimeout(async () => {
      const r = await audiencePreviewAction({
        serviceWithinDays: Number(v.serviceWithinDays) || 30,
        statuses: v.statuses as string[],
        service: v.service,
      });
      if (r.ok) setAudience(r.data as { count: number; sample: string[] });
    }, 250);
    return () => clearTimeout(t);
  }, [v.serviceWithinDays, v.statuses, v.service]);

  const submit = (launch: boolean) => {
    const start = launch ? startLaunch : startSave;
    start(async () => {
      const r = await saveCampaignAction(v, launch);
      if (r.ok) {
        toast.success(r.message);
        setErrors({});
        if (!v.id) router.replace(`/recenzije/kampanje/${r.data?.id}`);
        else router.refresh();
      } else {
        setErrors(r.fieldErrors ?? {});
        toast.error(r.error);
      }
    });
  };

  const sample = (text: string) =>
    renderTemplate(text, { firstName: "Ivana", lastName: "Horvat", businessName, service: v.service || "servis", reviewLink: previewLink });
  const delayUnit = Number(v.delayMinutes) % 1440 === 0 && Number(v.delayMinutes) > 0 ? "days" : Number(v.delayMinutes) % 60 === 0 && Number(v.delayMinutes) > 0 ? "hours" : "minutes";

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-4">
        <Card className="space-y-4 p-5">
          <h2 className="label flex items-center gap-2"><span className="size-1.5 bg-orange" />Osnovno</h2>
          <Field label="Naziv kampanje" htmlFor="c-name" error={errors.name}>
            <Input id="c-name" value={v.name} onChange={(e) => set("name", e.target.value)} placeholder="npr. Ljetna akcija recenzija" />
          </Field>
          <Field label="Okidač" htmlFor="c-trigger">
            <Select id="c-trigger" value={v.trigger} onChange={(e) => set("trigger", e.target.value as CampaignInput["trigger"])}>
              <option value="LAUNCH">Jednokratno: pošalji svima u publici pri pokretanju</option>
              <option value="SERVICE_COMPLETED">Stalno: i svakom novom završenom poslu koji odgovara</option>
            </Select>
          </Field>
        </Card>

        <Card className="space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="label flex items-center gap-2"><span className="size-1.5 bg-orange" />Publika</h2>
            {audience && (
              <span className="label inline-flex items-center gap-1.5 rounded-full bg-foreground px-3 py-1 text-white">
                <Users className="size-3.5" /> {audience.count} klijenata odgovara
              </span>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Usluga u zadnjih" htmlFor="c-days">
              <Select id="c-days" value={String(v.serviceWithinDays)} onChange={(e) => set("serviceWithinDays", Number(e.target.value))}>
                {[7, 14, 30, 60, 90, 180, 365].map((d) => (
                  <option key={d} value={d}>
                    {d} dana
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Vrsta usluge" htmlFor="c-service">
              <Select id="c-service" value={v.service ?? ""} onChange={(e) => set("service", e.target.value)}>
                <option value="">Bilo koja usluga</option>
                {services.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
            </Field>
          </div>
          <fieldset>
            <legend className="label mb-2 text-muted">Status recenzije</legend>
            <div className="flex flex-wrap gap-2">
              {REVIEW_STATUS_ORDER.map((s) => {
                const on = (v.statuses as string[]).includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={on}
                    onClick={() => set("statuses", on ? (v.statuses as string[]).filter((x) => x !== s) : [...(v.statuses as string[]), s])}
                    className={cn(
                      "label min-h-10 rounded-full border px-3 py-1.5 sm:pointer-fine:min-h-0",
                      on ? "border-foreground bg-foreground text-white" : "border-border-strong text-muted hover:text-foreground"
                    )}
                  >
                    {REVIEW_STATUS[s].label}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-muted">Bez odabira znači svi statusi. Odjavljeni klijenti su uvijek isključeni.</p>
          </fieldset>
          {audience && audience.sample.length > 0 && (
            <p className="text-xs text-subtle">
              npr. {audience.sample.join(", ")}
              {audience.count > audience.sample.length ? "…" : ""}
            </p>
          )}
        </Card>

        <Card className="space-y-4 p-5">
          <h2 className="label flex items-center gap-2"><span className="size-1.5 bg-orange" />Poruka</h2>
          <Field label="SMS" htmlFor="c-body" error={errors.messageBody} hint="Varijable: {first_name} {business_name} {service} {technician} {review_link}. Pišite bez kvačica (č, ć, š) da SMS ostane jeftiniji.">
            <Textarea id="c-body" value={v.messageBody} onChange={(e) => set("messageBody", e.target.value)} rows={4} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Pošalji nakon" htmlFor="c-delay" hint="Vrijeme od ulaska u kampanju">
              <div className="flex gap-2">
                <Input
                  id="c-delay"
                  type="number"
                  min={0}
                  value={delayUnit === "days" ? Number(v.delayMinutes) / 1440 : delayUnit === "hours" ? Number(v.delayMinutes) / 60 : Number(v.delayMinutes)}
                  onChange={(e) => {
                    const n = Math.max(0, Number(e.target.value) || 0);
                    set("delayMinutes", delayUnit === "days" ? n * 1440 : delayUnit === "hours" ? n * 60 : n);
                  }}
                />
                <Select
                  id="c-delay-unit"
                  aria-label="Jedinica"
                  value={delayUnit}
                  onChange={(e) => {
                    const cur = delayUnit === "days" ? Number(v.delayMinutes) / 1440 : delayUnit === "hours" ? Number(v.delayMinutes) / 60 : Number(v.delayMinutes);
                    const n = cur || 1;
                    set("delayMinutes", e.target.value === "days" ? n * 1440 : e.target.value === "hours" ? n * 60 : n);
                  }}
                  className="w-32"
                >
                  <option value="minutes">minuta</option>
                  <option value="hours">sati</option>
                  <option value="days">dana</option>
                </Select>
              </div>
            </Field>
          </div>
        </Card>

        <Card className="space-y-4 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="label flex items-center gap-2"><span className="size-1.5 bg-orange" />Podsjetnik</h2>
              <p className="text-xs text-muted">Šalje se samo ako klijent još nije ostavio recenziju.</p>
            </div>
            <Switch checked={!!v.followUpEnabled} onCheckedChange={(c) => set("followUpEnabled", c)} label="Uključi podsjetnik" />
          </div>
          {v.followUpEnabled && (
            <>
              <Field label="Čekaj prije podsjetnika" htmlFor="c-fu-wait">
                <Select id="c-fu-wait" value={String(v.followUpAfterHours)} onChange={(e) => set("followUpAfterHours", Number(e.target.value))}>
                  {[24, 48, 72, 120, 168].map((h) => (
                    <option key={h} value={h}>
                      {h / 24} {h === 24 ? "dan" : "dana"}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Tekst podsjetnika" htmlFor="c-fu-body" error={errors.followUpBody}>
                <Textarea id="c-fu-body" value={v.followUpBody ?? ""} onChange={(e) => set("followUpBody", e.target.value)} rows={3} />
              </Field>
            </>
          )}
        </Card>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" loading={saving} onClick={() => submit(false)}>
            {!saving && <Save />} {initial.status === "DRAFT" || !initial.id ? "Spremi skicu" : "Spremi izmjene"}
          </Button>
          {!locked && (initial.status === "DRAFT" || !initial.id) && (
            <Button loading={launching} onClick={() => submit(true)}>
              {!launching && <Rocket />} Pokreni kampanju
            </Button>
          )}
        </div>
      </div>

      <aside className="xl:sticky xl:top-20 xl:self-start">
        <PhoneMockup
          sender={businessName}
          messages={[{ text: sample(v.messageBody), time: "Pregled" }, ...(v.followUpEnabled && v.followUpBody ? [{ text: sample(v.followUpBody) }] : [])]}
        />
      </aside>
    </div>
  );
}
