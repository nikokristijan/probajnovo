"use client";

import { useState, useTransition } from "react";
import {
  ArrowDown,
  ArrowUp,
  GitBranch,
  MessageSquare,
  Play,
  Plus,
  Save,
  Send,
  Timer,
  Trash2,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { deleteAutomationAction, runAutomationForClientsAction, saveAutomationAction } from "@/lib/recenzije/actions/automations";
import { Button } from "@/components/recenzije/ui/button";
import { Dialog, DialogContent, Menu, MenuContent, MenuItem, MenuTrigger, Switch } from "@/components/recenzije/ui/dialog";
import { Badge, Card, Field, Input, Select, Textarea } from "@/components/recenzije/ui/primitives";
import { DEFAULT_FOLLOW_UP, DEFAULT_REQUEST } from "@/lib/recenzije/automation/templates";
import { STEP_LABELS, formatWait, type AutomationStep, type StepType } from "@/lib/recenzije/automation/types";
import { cn } from "@/lib/recenzije/utils";

type Trigger = "SERVICE_COMPLETED" | "CLIENT_CREATED" | "MANUAL";

const TRIGGERS: Record<Trigger, string> = {
  SERVICE_COMPLETED: "Kad se usluga označi završenom",
  CLIENT_CREATED: "Kad se doda novi klijent",
  MANUAL: "Kad je ručno pokrenete za odabrane klijente",
};

const STEP_META: Record<StepType, { icon: LucideIcon; tone: string }> = {
  wait: { icon: Timer, tone: "text-warning bg-orange-soft border-orange/40" },
  send_review_request: { icon: Send, tone: "text-white bg-foreground border-foreground" },
  send_follow_up: { icon: Send, tone: "text-info bg-info-soft border-info/25" },
  send_message: { icon: MessageSquare, tone: "text-violet bg-violet-soft border-violet/25" },
  condition: { icon: GitBranch, tone: "text-foreground bg-surface-3 border-border-strong" },
};

let counter = 0;
const newId = () => `s${Date.now().toString(36)}${(counter++).toString(36)}`;

function newStep(type: StepType): AutomationStep {
  switch (type) {
    case "wait":
      return { id: newId(), type, minutes: 1440 };
    case "send_review_request":
      return { id: newId(), type, template: DEFAULT_REQUEST };
    case "send_follow_up":
      return { id: newId(), type, template: DEFAULT_FOLLOW_UP };
    case "send_message":
      return { id: newId(), type, template: "Bok {first_name}, " };
    case "condition":
      return { id: newId(), type, check: "clicked", ifTrue: "end", ifFalse: "continue" };
  }
}

function Connector() {
  return <div className="mx-auto h-6 w-px bg-border-strong" aria-hidden />;
}

function WaitEditor({ step, onChange }: { step: Extract<AutomationStep, { type: "wait" }>; onChange: (s: AutomationStep) => void }) {
  const unit = step.minutes % 1440 === 0 ? 1440 : step.minutes % 60 === 0 ? 60 : 1;
  return (
    <div className="flex gap-2">
      <Input
        id={`${step.id}-n`}
        aria-label="Koliko čekati"
        type="number"
        min={1}
        value={step.minutes / unit}
        onChange={(e) => onChange({ ...step, minutes: Math.max(1, Number(e.target.value) || 1) * unit })}
        className="w-24"
      />
      <Select
        id={`${step.id}-u`}
        aria-label="Jedinica"
        value={unit}
        onChange={(e) => onChange({ ...step, minutes: (step.minutes / unit) * Number(e.target.value) })}
        className="w-32"
      >
        <option value={1}>minuta</option>
        <option value={60}>sati</option>
        <option value={1440}>dana</option>
      </Select>
    </div>
  );
}

function StepCard({
  step,
  index,
  total,
  onChange,
  onMove,
  onRemove,
}: {
  step: AutomationStep;
  index: number;
  total: number;
  onChange: (s: AutomationStep) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const meta = STEP_META[step.type];
  const Icon = meta.icon;
  const summary =
    step.type === "wait"
      ? `Čekaj ${formatWait(step.minutes)}`
      : step.type === "condition"
        ? `Ako je klijent ${step.check === "clicked" ? "kliknuo link" : "ostavio recenziju"}: ${step.ifTrue === "end" ? "stani" : "nastavi"}, inače ${step.ifFalse === "end" ? "stani" : "nastavi"}`
        : STEP_LABELS[step.type];
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl border", meta.tone)}>
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="label text-subtle">
            Korak {index + 1} · {STEP_LABELS[step.type]}
          </p>
          <p className="mt-0.5 text-sm font-medium">{summary}</p>
        </div>
        <div className="flex shrink-0 items-center">
          <Button size="icon" variant="ghost" className="size-8" disabled={index === 0} onClick={() => onMove(-1)} aria-label="Pomakni gore">
            <ArrowUp />
          </Button>
          <Button size="icon" variant="ghost" className="size-8" disabled={index === total - 1} onClick={() => onMove(1)} aria-label="Pomakni dolje">
            <ArrowDown />
          </Button>
          <Button size="icon" variant="ghost" className="size-8 hover:text-danger" onClick={onRemove} aria-label="Ukloni korak">
            <Trash2 />
          </Button>
        </div>
      </div>
      <div className="mt-3 pl-0 sm:pl-12">
        {step.type === "wait" && <WaitEditor step={step} onChange={onChange} />}
        {(step.type === "send_review_request" || step.type === "send_follow_up" || step.type === "send_message") && (
          <Textarea
            id={`${step.id}-t`}
            aria-label="Tekst poruke"
            value={step.template}
            onChange={(e) => onChange({ ...step, template: e.target.value })}
            rows={3}
            className="text-[13px]"
          />
        )}
        {step.type === "condition" && (
          <div className="grid gap-2 sm:grid-cols-3">
            <Select id={`${step.id}-c`} aria-label="Uvjet" value={step.check} onChange={(e) => onChange({ ...step, check: e.target.value as "clicked" | "reviewed" })}>
              <option value="clicked">Je li kliknuo link?</option>
              <option value="reviewed">Je li ostavio recenziju?</option>
            </Select>
            <Select id={`${step.id}-y`} aria-label="Ako da" value={step.ifTrue} onChange={(e) => onChange({ ...step, ifTrue: e.target.value as "end" | "continue" })}>
              <option value="end">Da → kraj</option>
              <option value="continue">Da → nastavi</option>
            </Select>
            <Select id={`${step.id}-n2`} aria-label="Ako ne" value={step.ifFalse} onChange={(e) => onChange({ ...step, ifFalse: e.target.value as "end" | "continue" })}>
              <option value="continue">Ne → nastavi</option>
              <option value="end">Ne → kraj</option>
            </Select>
          </div>
        )}
      </div>
    </Card>
  );
}

function AddStep({ onAdd }: { onAdd: (t: StepType) => void }) {
  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          type="button"
          className="label mx-auto flex items-center gap-1.5 rounded-full border border-dashed border-border-strong bg-white px-3 py-1.5 text-muted hover:border-foreground hover:text-foreground"
        >
          <Plus className="size-3.5" /> Dodaj korak
        </button>
      </MenuTrigger>
      <MenuContent align="start">
        {(Object.keys(STEP_LABELS) as StepType[]).map((t) => {
          const Icon = STEP_META[t].icon;
          return (
            <MenuItem key={t} onSelect={() => onAdd(t)}>
              <Icon /> {STEP_LABELS[t]}
            </MenuItem>
          );
        })}
      </MenuContent>
    </Menu>
  );
}

export function AutomationBuilder({
  automation,
  clients,
  stats,
}: {
  automation: { id: string; name: string; description: string | null; trigger: Trigger; enabled: boolean; steps: AutomationStep[] };
  clients: { id: string; name: string }[];
  stats: { active: number; completed: number; failed: number };
}) {
  const [name, setName] = useState(automation.name);
  const [description, setDescription] = useState(automation.description ?? "");
  const [trigger, setTrigger] = useState<Trigger>(automation.trigger);
  const [enabled, setEnabled] = useState(automation.enabled);
  const [steps, setSteps] = useState<AutomationStep[]>(automation.steps);
  const [saving, startSave] = useTransition();
  const [runOpen, setRunOpen] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [running, startRun] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const insertAt = (i: number, t: StepType) => setSteps((s) => [...s.slice(0, i), newStep(t), ...s.slice(i)]);
  const save = () =>
    startSave(async () => {
      const r = await saveAutomationAction({ id: automation.id, name, description, trigger, enabled, steps });
      if (r.ok) toast.success(r.message);
      else toast.error(r.error);
    });

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="mx-auto w-full max-w-2xl">
        {/* Trigger */}
        <Card className="border-foreground p-4">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center bg-orange text-black">
              <Zap className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="label text-subtle">Okidač</p>
              <Select id="trigger" aria-label="Okidač" value={trigger} onChange={(e) => setTrigger(e.target.value as Trigger)} className="mt-1.5">
                {Object.entries(TRIGGERS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </Card>
        <Connector />
        <AddStep onAdd={(t) => insertAt(0, t)} />
        {steps.map((s, i) => (
          <div key={s.id}>
            <Connector />
            <StepCard
              step={s}
              index={i}
              total={steps.length}
              onChange={(ns) => setSteps((all) => all.map((x) => (x.id === s.id ? ns : x)))}
              onMove={(dir) =>
                setSteps((all) => {
                  const n = [...all];
                  const j = i + dir;
                  [n[i], n[j]] = [n[j], n[i]];
                  return n;
                })
              }
              onRemove={() => setSteps((all) => all.filter((x) => x.id !== s.id))}
            />
            <Connector />
            <AddStep onAdd={(t) => insertAt(i + 1, t)} />
          </div>
        ))}
        <Connector />
        <div className="label mx-auto w-fit rounded-full border border-foreground bg-foreground px-4 py-1.5 text-white">Kraj tijeka</div>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <Card className="space-y-4 p-5">
          <Field label="Naziv" htmlFor="a-name">
            <Input id="a-name" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Opis" htmlFor="a-desc">
            <Textarea id="a-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="min-h-16 text-[13px]" />
          </Field>
          <div className="flex items-center justify-between gap-3 rounded-xl bg-surface-2 p-3">
            <div>
              <p className="text-sm font-medium">{enabled ? "Uključeno" : "Isključeno"}</p>
              <p className="text-xs text-muted">{enabled ? "Radi za svaki novi okidač" : "Ništa se ne šalje"}</p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} label="Automatizacija uključena" />
          </div>
          <Button className="w-full" loading={saving} onClick={save}>
            {!saving && <Save />} Spremi automatizaciju
          </Button>
          {trigger === "MANUAL" && (
            <Button className="w-full" variant="secondary" onClick={() => setRunOpen(true)} disabled={!automation.enabled}>
              <Play /> Pokreni za klijente
            </Button>
          )}
          {trigger === "MANUAL" && !automation.enabled && <p className="text-xs text-muted">Uključite i spremite da je pokrenete.</p>}
        </Card>
        <Card className="p-5">
          <p className="label">Pokretanja</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge tone="amber">{stats.active} u tijeku</Badge>
            <Badge tone="green">{stats.completed} gotovo</Badge>
            <Badge tone={stats.failed ? "red" : "neutral"}>{stats.failed} neuspjelo</Badge>
          </div>
          <button type="button" onClick={() => setConfirmDelete(true)} className="mt-5 inline-flex items-center gap-1.5 text-xs text-muted hover:text-danger">
            <Trash2 className="size-3.5" /> Obriši automatizaciju
          </button>
        </Card>
      </aside>

      <Dialog open={runOpen} onOpenChange={setRunOpen}>
        <DialogContent title="Pokreni za klijente" description="Odmah pokreće ovaj tijek za svakog odabranog klijenta.">
          <ul className="max-h-72 divide-y divide-border overflow-y-auto rounded-xl border border-border">
            {clients.map((c) => (
              <li key={c.id}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm hover:bg-surface-2">
                  <input
                    type="checkbox"
                    className="size-4 accent-black"
                    checked={picked.has(c.id)}
                    onChange={() =>
                      setPicked((s) => {
                        const n = new Set(s);
                        if (n.has(c.id)) n.delete(c.id);
                        else n.add(c.id);
                        return n;
                      })
                    }
                  />
                  {c.name}
                </label>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRunOpen(false)}>
              Odustani
            </Button>
            <Button
              loading={running}
              disabled={picked.size === 0}
              onClick={() =>
                startRun(async () => {
                  const r = await runAutomationForClientsAction(automation.id, [...picked]);
                  if (r.ok) {
                    toast.success(r.message);
                    setRunOpen(false);
                    setPicked(new Set());
                  } else toast.error(r.error);
                })
              }
            >
              <Play /> Pokreni ({picked.size})
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent title="Obrisati automatizaciju?" description="Zakazani koraci se otkazuju. Već poslane poruke ostaju u popisu.">
          <form action={deleteAutomationAction.bind(null, automation.id)} className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setConfirmDelete(false)}>
              Odustani
            </Button>
            <Button type="submit" variant="danger">
              Obriši
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
