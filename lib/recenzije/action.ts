import type { z } from "zod";

/** Shape every server action returns to forms (used with useActionState). */
export type ActionState = {
  ok?: boolean;
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
  data?: Record<string, unknown>;
  /** Submitted values echoed back on error, so React's form reset doesn't wipe what the user typed. */
  values?: Record<string, string>;
};

export const initialState: ActionState = {};

export function zodErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export function formObject(fd: FormData) {
  const o: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string") o[k] = v;
  return o;
}

/** Form values safe to echo back (never passwords or tokens). */
export function echoValues(fd: FormData) {
  const o: Record<string, string> = {};
  for (const [k, v] of fd.entries()) {
    if (typeof v === "string" && !/password|confirm|token/i.test(k)) o[k] = v;
  }
  return o;
}
