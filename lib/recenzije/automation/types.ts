/**
 * Automation steps are an ordered list. The engine (services/automation-engine.ts)
 * executes them one by one; `wait` pauses the run until `nextRunAt`, and
 * `condition` can end the run early (e.g. the client already clicked).
 */
export type AutomationStep =
  | { id: string; type: "wait"; minutes: number }
  | { id: string; type: "send_review_request"; template: string }
  | { id: string; type: "send_follow_up"; template: string }
  | { id: string; type: "send_message"; template: string }
  | { id: string; type: "condition"; check: "clicked" | "reviewed"; ifTrue: "end" | "continue"; ifFalse: "end" | "continue" };

export type StepType = AutomationStep["type"];

/** A step without its id (templates, new steps in the builder). */
export type StepInput = AutomationStep extends infer S ? (S extends AutomationStep ? Omit<S, "id"> : never) : never;

export const STEP_LABELS: Record<StepType, string> = {
  wait: "Čekaj",
  send_review_request: "Pošalji zahtjev za recenziju",
  send_follow_up: "Pošalji podsjetnik",
  send_message: "Pošalji poruku",
  condition: "Uvjet",
};

export const TEMPLATE_VARIABLES = [
  { key: "{first_name}", label: "Ime" },
  { key: "{last_name}", label: "Prezime" },
  { key: "{business_name}", label: "Tvrtka" },
  { key: "{service}", label: "Usluga" },
  { key: "{technician}", label: "Serviser" },
  { key: "{service_date}", label: "Datum usluge" },
  { key: "{review_link}", label: "Link za recenziju" },
] as const;

/** Hrvatski oblik: 1 dan / 2 dana / 5 dana, 1 sat / 2 sata / 5 sati, 1 minuta / 2 minute / 5 minuta. */
export function plural(n: number, one: string, few: string, many: string) {
  const d = n % 10;
  const dd = n % 100;
  if (d === 1 && dd !== 11) return one;
  if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return few;
  return many;
}

export function formatWait(minutes: number) {
  if (minutes % 1440 === 0) {
    const n = minutes / 1440;
    return `${n} ${plural(n, "dan", "dana", "dana")}`;
  }
  if (minutes % 60 === 0) {
    const n = minutes / 60;
    return `${n} ${plural(n, "sat", "sata", "sati")}`;
  }
  return `${minutes} ${plural(minutes, "minuta", "minute", "minuta")}`;
}
