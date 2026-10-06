"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { analyzePerformanceAction } from "@/lib/recenzije/actions/analytics";
import { Button } from "@/components/recenzije/ui/button";

export function AiInsights() {
  const [pending, start] = useTransition();
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      {text ? (
        <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{text}</div>
      ) : (
        <p className="text-sm text-muted">Claude čita brojke s ove stranice i predlaže što promijeniti: vrijeme slanja, tekst, podsjetnike, nakon kojih poslova pitati.</p>
      )}
      {error && <p className="mt-3 border-l-[3px] border-orange bg-orange-soft px-3 py-2 text-[13px] text-warning">{error}</p>}
      <Button
        className="mt-4"
        size="sm"
        variant="secondary"
        loading={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const r = await analyzePerformanceAction();
            if (r.ok) setText(String(r.data?.text ?? ""));
            else setError(r.error ?? "AI zahtjev nije uspio");
          })
        }
      >
        {!pending && <Sparkles />} {text ? "Analiziraj ponovno" : "AI preporuke"}
      </Button>
    </div>
  );
}
