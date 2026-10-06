"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { FlaskConical, Save, Search, Send, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  deleteTemplateAction,
  generateMessageAction,
  saveTemplateAction,
  sendNowAction,
  sendTestAction,
} from "@/lib/recenzije/actions/messages";
import { PhoneMockup } from "@/components/recenzije/phone";
import { Button } from "@/components/recenzije/ui/button";
import { Dialog, DialogContent } from "@/components/recenzije/ui/dialog";
import { Badge, Card, Field, Input, Select, Textarea } from "@/components/recenzije/ui/primitives";
import { DEFAULT_REQUEST } from "@/lib/recenzije/automation/templates";
import { TEMPLATE_VARIABLES } from "@/lib/recenzije/automation/types";
import { renderTemplate, smsSegments, stripDiacritics } from "@/lib/recenzije/messages";

const LANGS = [
  { v: "Croatian", l: "Hrvatski" },
  { v: "English", l: "Engleski" },
  { v: "German", l: "Njemački" },
  { v: "Italian", l: "Talijanski" },
  { v: "Slovenian", l: "Slovenski" },
];
import { cn } from "@/lib/recenzije/utils";

type Template = { id: string; name: string; kind: string; body: string };
type ClientOpt = { id: string; name: string; firstName: string; lastName: string; service: string | null; technician: string | null; serviceDate: Date | null; optOut: boolean };

export function MessageBuilder({
  templates,
  clients,
  businessName,
  previewLink,
  status,
}: {
  templates: Template[];
  clients: ClientOpt[];
  businessName: string;
  previewLink: string;
  status: { ai: boolean; sms: boolean; demo: boolean; reviewUrl: boolean };
}) {
  const [text, setText] = useState(templates.find((t) => t.kind === "REVIEW_REQUEST")?.body ?? DEFAULT_REQUEST);
  const [templateId, setTemplateId] = useState<string>("");
  const [previewId, setPreviewId] = useState(clients[0]?.id ?? "");
  const [recipients, setRecipients] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [tone, setTone] = useState<"friendly" | "professional" | "short">("friendly");
  const [language, setLanguage] = useState("Croatian");
  const [kind, setKind] = useState<"request" | "follow_up">("request");
  const [instructions, setInstructions] = useState("");
  const [variants, setVariants] = useState<string[]>([]);
  const [aiError, setAiError] = useState<string | null>(null);
  const [testOpen, setTestOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [tplName, setTplName] = useState("");
  const [genPending, startGen] = useTransition();
  const [sendPending, startSend] = useTransition();
  const [testPending, startTest] = useTransition();
  const [savePending, startSave] = useTransition();
  const ref = useRef<HTMLTextAreaElement>(null);

  const previewClient = clients.find((c) => c.id === previewId);
  const rendered = renderTemplate(text, {
    firstName: previewClient?.firstName ?? "Ivana",
    lastName: previewClient?.lastName ?? "Horvat",
    businessName,
    service: previewClient?.service ?? "AC Repair",
    technician: previewClient?.technician,
    serviceDate: previewClient?.serviceDate ? new Date(previewClient.serviceDate) : new Date(),
    reviewLink: previewLink,
  });
  const seg = smsSegments(rendered);
  const filtered = useMemo(
    () => clients.filter((c) => c.name.toLowerCase().includes(search.toLowerCase())).slice(0, 50),
    [clients, search]
  );

  const insert = (v: string) => {
    const el = ref.current;
    if (!el) return setText((t) => t + v);
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    const next = text.slice(0, start) + v + text.slice(end);
    setText(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + v.length, start + v.length);
    });
  };

  const notReady = status.demo
    ? "Demo: slanje je isključeno."
    : !status.sms
      ? "Slanje SMS-a nije postavljeno. Povežite mobitel u Postavkama."
      : null;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-4">
        <Card className="p-5">
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Krenite od predloška" htmlFor="tpl" className="min-w-48 flex-1">
              <Select
                id="tpl"
                value={templateId}
                onChange={(e) => {
                  setTemplateId(e.target.value);
                  const t = templates.find((x) => x.id === e.target.value);
                  if (t) {
                    setText(t.body);
                    setTplName(t.name);
                  }
                }}
              >
                <option value="">Odaberite spremljeni predložak…</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </Field>
            {templateId && (
              <Button
                variant="ghost"
                size="sm"
                className="mb-1"
                onClick={async () => {
                  const r = await deleteTemplateAction(templateId);
                  if (r.ok) {
                    toast.success(r.message);
                    setTemplateId("");
                  } else toast.error(r.error);
                }}
              >
                <Trash2 /> Obriši predložak
              </Button>
            )}
          </div>

          <div className="mt-5">
            <label htmlFor="msg" className="label mb-2 block text-muted">
              Poruka
            </label>
            <Textarea id="msg" ref={ref} value={text} onChange={(e) => setText(e.target.value)} rows={6} className="min-h-36 text-[15px]" />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5">
                {TEMPLATE_VARIABLES.map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => insert(v.key)}
                    className="border border-border-strong bg-white px-2 py-1 font-mono text-[11px] text-muted hover:border-foreground hover:text-foreground"
                  >
                    {v.key}
                  </button>
                ))}
              </div>
              <span className={cn("tabular flex items-center gap-2 font-mono text-[11px]", seg.segments > 1 ? "text-warning" : "text-subtle")}>
                {seg.encoding === "Unicode" && (
                  <button type="button" onClick={() => setText(stripDiacritics(text))} className="underline underline-offset-2 hover:text-foreground">
                    Ukloni kvačice
                  </button>
                )}
                {seg.length} znakova · {seg.segments} SMS · {seg.encoding}
              </span>
            </div>
            {!text.includes("{review_link}") && (
              <p className="mt-2 text-xs text-warning">U poruci nema {"{review_link}"}, pa se klikovi neće pratiti.</p>
            )}
          </div>
        </Card>

        {/* AI */}
        <Card className="p-5">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-orange" />
            <h2 className="label">Napiši pomoću AI</h2>
            {!status.ai && <Badge tone="amber">Nije postavljeno</Badge>}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Vrsta" htmlFor="ai-kind">
              <Select id="ai-kind" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
                <option value="request">Zahtjev za recenziju</option>
                <option value="follow_up">Podsjetnik</option>
              </Select>
            </Field>
            <Field label="Ton" htmlFor="ai-tone">
              <Select id="ai-tone" value={tone} onChange={(e) => setTone(e.target.value as typeof tone)}>
                <option value="friendly">Prijateljski</option>
                <option value="professional">Profesionalno</option>
                <option value="short">Kratko i jasno</option>
              </Select>
            </Field>
            <Field label="Jezik" htmlFor="ai-lang">
              <Select id="ai-lang" value={language} onChange={(e) => setLanguage(e.target.value)}>
                {LANGS.map((l) => (
                  <option key={l.v} value={l.v}>
                    {l.l}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Prilagodi klijentu" htmlFor="ai-client">
              <Select id="ai-client" value={previewId} onChange={(e) => setPreviewId(e.target.value)}>
                <option value="">Bilo koji klijent</option>
                {clients.slice(0, 100).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Dodatne upute" htmlFor="ai-instr" className="mt-3">
            <Input
              id="ai-instr"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="npr. spomeni 2 godine jamstva, potpiši se kao Marko"
              maxLength={500}
            />
          </Field>
          <Button
            className="mt-4"
            variant="secondary"
            loading={genPending}
            onClick={() =>
              startGen(async () => {
                setAiError(null);
                const r = await generateMessageAction({ kind, tone, language, instructions, clientId: previewId });
                if (r.ok) setVariants((r.data?.variants as string[]) ?? []);
                else setAiError(r.error ?? "AI request failed");
              })
            }
          >
            {!genPending && <Sparkles />} Generiraj pomoću AI
          </Button>
          {aiError && (
            <p className="mt-3 border-l-[3px] border-orange bg-orange-soft px-3 py-2 text-[13px] text-warning">
              {aiError}
              {!status.ai && " Upute su u Postavkama."}
            </p>
          )}
          {variants.length > 0 && (
            <ul className="mt-4 space-y-2">
              {variants.map((v, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => {
                      setText(v);
                      toast.success("Varijanta je u uređivaču");
                    }}
                    className="w-full border border-border-strong bg-white p-3 text-left text-sm leading-relaxed hover:border-foreground"
                  >
