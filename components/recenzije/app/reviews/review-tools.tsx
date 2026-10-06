"use client";

import { useState, useTransition } from "react";
import { Link2, RefreshCw, Reply, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  linkReviewAction,
  postReplyAction,
  suggestReplyAction,
  summarizeReviewsAction,
  syncReviewsAction,
} from "@/lib/recenzije/actions/reviews";
import { Button } from "@/components/recenzije/ui/button";
import { Select, Textarea } from "@/components/recenzije/ui/primitives";

export function SyncReviewsButton({ disabled }: { disabled?: boolean }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="secondary"
      loading={pending}
      disabled={disabled}
      onClick={() =>
        start(async () => {
          const r = await syncReviewsAction();
          if (r.ok) toast.success(r.message);
          else toast.error(r.error);
        })
      }
    >
      {!pending && <RefreshCw />} Preuzmi s Googlea
    </Button>
  );
}

export function AiSummary() {
  const [pending, start] = useTransition();
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      {text ? (
        <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{text}</div>
      ) : (
        <p className="text-sm text-muted">
          Kratki sažetak onoga što klijenti hvale i što treba poboljšati, napisan iz vaših najnovijih recenzija.
        </p>
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
            const r = await summarizeReviewsAction();
            if (r.ok) setText(String(r.data?.text ?? ""));
            else setError(r.error ?? "AI zahtjev nije uspio");
          })
        }
      >
        {!pending && <Sparkles />} {text ? "Ponovno" : "Sažmi pomoću AI"}
      </Button>
    </div>
  );
}

export function LinkClientSelect({
  reviewId,
  clientId,
  clients,
}: {
  reviewId: string;
  clientId: string | null;
  clients: { id: string; name: string }[];
}) {
  const [pending, start] = useTransition();
  const [value, setValue] = useState(clientId ?? "");
  return (
    <div className="flex items-center gap-2">
      <Link2 className="size-3.5 shrink-0 text-subtle" />
      <Select
        id={`link-${reviewId}`}
        aria-label="Povezani klijent"
        value={value}
        disabled={pending}
        className="h-8 max-w-56 text-[13px]"
        onChange={(e) => {
          const v = e.target.value;
          setValue(v);
          start(async () => {
            const r = await linkReviewAction(reviewId, v);
            if (r.ok) toast.success(r.message);
            else {
              toast.error(r.error);
              setValue(clientId ?? "");
            }
          });
        }}
      >
        <option value="">Nije povezano s klijentom</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>
    </div>
  );
}

export function ReplyBox({ reviewId, canPost, existing }: { reviewId: string; canPost: boolean; existing: string | null }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(existing ?? "");
  const [suggesting, startSuggest] = useTransition();
  const [posting, startPost] = useTransition();
  if (!open) {
    return (
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        <Reply /> {existing ? "Uredi odgovor" : "Odgovori"}
      </Button>
    );
  }
  return (
    <div className="mt-3 w-full space-y-2">
      <Textarea
        id={`reply-${reviewId}`}
        aria-label="Tekst odgovora"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="Napišite javni odgovor…"
      />
      {!canPost && (
        <p className="text-xs text-muted">
          Objava odgovora zahtijeva Google Business Profile vezu i radi samo za recenzije preuzete s Googlea.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          loading={suggesting}
          onClick={() =>
            startSuggest(async () => {
              const r = await suggestReplyAction(reviewId);
              if (r.ok) setText(String(r.data?.text ?? ""));
              else toast.error(r.error);
            })
          }
        >
          {!suggesting && <Sparkles />} Predloži pomoću AI
        </Button>
        <Button
          size="sm"
          disabled={!canPost}
          loading={posting}
          onClick={() =>
            startPost(async () => {
              const r = await postReplyAction(reviewId, text);
              if (r.ok) {
                toast.success(r.message);
                setOpen(false);
              } else toast.error(r.error);
            })
          }
        >
          Objavi odgovor
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Odustani
        </Button>
      </div>
    </div>
  );
}
