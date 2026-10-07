"use client";

import { useState, useTransition } from "react";
import { AlertCircle, Check, Info, Lightbulb, Minus, Plug, Sparkles, ThumbsDown, ThumbsUp } from "lucide-react";
import { summarizeReviewsAction } from "@/lib/recenzije/actions/reviews";
import {
  REVIEW_SUMMARY_MAX_REVIEWS,
  SENTIMENT_LABEL,
  SUMMARY_MIN_TEXT_REVIEWS,
  type ReviewSentiment,
  type ReviewSummaryPayload,
} from "@/lib/recenzije/review-summary";
import { timeAgo } from "@/lib/recenzije/status";
import { Button } from "@/components/recenzije/ui/button";
import { Alert, Badge, Skeleton } from "@/components/recenzije/ui/primitives";

const SENTIMENT_TONE = { positive: "green", mixed: "amber", negative: "red" } as const satisfies Record<ReviewSentiment, "green" | "amber" | "red">;

type Failure = { message: string; code?: string };

function isPayload(d: unknown): d is ReviewSummaryPayload {
  const p = d as Partial<ReviewSummaryPayload> | null | undefined;
  return !!p && Array.isArray(p.praises) && Array.isArray(p.complaints) && typeof p.suggestion === "string" && typeof p.sentiment === "string";
}

/**
 * Kartica "Sažmi recenzije s AI-jem". `aiConfigured` i `reviewCount` stižu sa servera
 * kako bi se postavke i prazno stanje vidjeli prije klika; akcija ih svejedno
 * provjerava sama.
 */
export function AiSummaryCard({ aiConfigured, reviewCount }: { aiConfigured: boolean; reviewCount: number }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ReviewSummaryPayload | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);

  const run = () =>
    start(async () => {
      setFailure(null);
      try {
        const r = await summarizeReviewsAction();
        if (r.ok && isPayload(r.data)) {
          setResult(r.data);
        } else {
          setFailure({ message: r.error ?? "AI zahtjev nije uspio. Pokušajte ponovno.", code: typeof r.data?.code === "string" ? r.data.code : undefined });
        }
      } catch {
        setFailure({ message: "Veza s poslužiteljem je prekinuta. Pokušajte ponovno." });
      }
    });

  if (!aiConfigured) {
    return (
      <div className="space-y-4">
        <Alert tone="amber" icon={Plug} title="AI nije postavljen">
          Dodajte <code className="font-mono text-[12px]">ANTHROPIC_API_KEY</code> u Vercel env varijable i ponovno objavite aplikaciju. Dok ključa nema, sažetak se ne može napraviti i ovdje se ništa ne prikazuje umjesto njega.
        </Alert>
        <Button size="sm" variant="secondary" disabled>
          <Sparkles /> Sažmi recenzije s AI-jem
        </Button>
      </div>
    );
  }

  if (reviewCount === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted">Još nema recenzija. Kad se pojave, ovdje ih možete sažeti jednim klikom.</p>
        <Button size="sm" variant="secondary" disabled>
          <Sparkles /> Sažmi recenzije s AI-jem
        </Button>
      </div>
    );
  }

  return (
    <div aria-live="polite">
      {pending ? (
        <div role="status" aria-busy="true" className="space-y-3">
          <p className="flex items-center gap-2 text-sm text-muted">
            <Sparkles className="size-4 animate-pulse text-orange" /> Claude čita vaše recenzije…
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-2/3" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          </div>
          <Skeleton className="h-14 w-full" />
        </div>
      ) : result ? (
        <SummaryView data={result} />
      ) : (
        <p className="text-sm text-muted">
          Što klijenti hvale, na što se žale i jedan konkretan prijedlog, napisano isključivo iz vaših zadnjih recenzija (najviše {REVIEW_SUMMARY_MAX_REVIEWS}).
        </p>
      )}

      {failure && !pending && (
        <div
          role="alert"
          className={
            failure.code === "NO_REVIEWS" || failure.code === "NO_TEXT"
              ? "mt-4 flex items-start gap-2 border-l-[3px] border-accent bg-accent-soft px-3 py-2 text-[13px] text-foreground/80"
              : "mt-4 flex items-start gap-2 border-l-[3px] border-orange bg-orange-soft px-3 py-2 text-[13px] text-warning"
          }
        >
          {failure.code === "NO_REVIEWS" || failure.code === "NO_TEXT" ? <Info className="mt-0.5 size-4 shrink-0" /> : <AlertCircle className="mt-0.5 size-4 shrink-0" />}
          <span>{failure.message}</span>
        </div>
      )}

      <Button className="mt-4" size="sm" variant="secondary" loading={pending} onClick={run}>
        {!pending && <Sparkles />} {result ? "Sažmi ponovno" : "Sažmi recenzije s AI-jem"}
      </Button>
    </div>
  );
}

function SummaryView({ data }: { data: ReviewSummaryPayload }) {
  const sentiment = data.sentiment in SENTIMENT_LABEL ? data.sentiment : "mixed";
  const lowSample = data.withTextCount < SUMMARY_MIN_TEXT_REVIEWS;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <Badge tone={SENTIMENT_TONE[sentiment]} dot>
          {SENTIMENT_LABEL[sentiment]}
        </Badge>
        <span className="text-xs text-muted">
          Prosjek ocjena {data.averageRating.toFixed(1).replace(".", ",")} · obuhvaćeno recenzija: {data.reviewCount}
        </span>
      </div>

      {lowSample && (
        <p className="border-l-[3px] border-orange bg-orange-soft px-3 py-2 text-[13px] text-warning">
          Samo {data.withTextCount} {data.withTextCount === 1 ? "recenzija ima" : "recenzije imaju"} napisan tekst, pa je ovaj sažetak slabo potkrijepljen. Uzmite ga s rezervom.
        </p>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <Points title="Što klijenti hvale" icon={ThumbsUp} tone="good" items={data.praises} empty="U ovim recenzijama nema izdvojenih pohvala." />
        <Points title="Na što se žale" icon={ThumbsDown} tone="bad" items={data.complaints} empty="U ovim recenzijama nema izdvojenih pritužbi." />
      </div>

      <div className="border-l-[3px] border-orange bg-surface-2 px-4 py-3">
        <p className="label flex items-center gap-2 text-foreground">
          <Lightbulb className="size-3.5 text-orange" /> Jedan konkretan prijedlog
        </p>
        <p className="mt-1.5 break-words text-sm leading-relaxed text-foreground/90">{data.suggestion}</p>
      </div>

      <p className="text-xs text-subtle">
        Obuhvaćeno recenzija: {data.reviewCount} (s tekstom: {data.withTextCount}). Napravljeno {timeAgo(data.generatedAt)}. AI može pogriješiti, pa važnije tvrdnje provjerite u popisu ispod.
      </p>
    </div>
  );
}

function Points({
  title,
  icon: Icon,
  tone,
  items,
  empty,
}: {
  title: string;
  icon: typeof ThumbsUp;
  tone: "good" | "bad";
  items: string[];
  empty: string;
}) {
  return (
    <div>
      <p className="label flex items-center gap-2 text-foreground">
        <Icon className="size-3.5 text-muted" /> {title}
      </p>
      {items.length === 0 ? (
        <p className="mt-2 text-sm italic text-subtle">{empty}</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {items.map((it, i) => (
            <li key={`${i}-${it}`} className="flex items-start gap-2 text-sm leading-snug">
              <span
                className={
                  tone === "good"
                    ? "mt-0.5 grid size-4 shrink-0 place-items-center bg-success-soft text-success"
                    : "mt-0.5 grid size-4 shrink-0 place-items-center bg-danger-soft text-danger"
                }
                aria-hidden
              >
                {tone === "good" ? <Check className="size-3" /> : <Minus className="size-3" />}
              </span>
              <span className="min-w-0 break-words">{it}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
