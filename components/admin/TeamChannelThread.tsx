"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createTeamChannelMessageInlineAction, type ActionState } from "@/lib/actions";
import { colorFor, initialsFor, labelForEmail, formatMsgTime, type PortalMember } from "@/components/admin/portalUtils";
import { SendIcon } from "@/components/admin/Icons";

type ChannelMessage = { id: number; adminEmail: string; body: string; createdAt: string };

const POLL_MS = 4_000;

/**
 * Opći tim kanal ("# tim", Portal Faza 3) — Teams/Slack-stil nit (avatar +
 * ime + vrijeme + tekst, grupirano po pošiljatelju), BEZ redirecta na svaki
 * unos (za razliku od stare app/admin/poruke forme) — šalje preko
 * useActionState, osvježava se pollingom svake ~4s (korisnikov izričit
 * izbor "brzi polling" umjesto pravog websocketa/Pusher integracije).
 */
export default function TeamChannelThread({
  currentEmail,
  initialMessages,
  roster,
}: {
  currentEmail: string;
  initialMessages: ChannelMessage[];
  roster: PortalMember[];
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createTeamChannelMessageInlineAction,
    undefined
  );
  const formRef = useRef<HTMLFormElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastCountRef = useRef(initialMessages.length);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch("/api/admin/portal/messages", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data.messages)) setMessages(data.messages);
      } catch {
        // Tiho ignoriraj — jedna neuspjela otkucaj polinga ne treba prekinuti nit.
      }
    };
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // Nakon uspješnog slanja odmah očisti formu i pokreni jedan izvanredni poll
  // (ne čekaj do 4s) da pošiljatelj smjesta vidi vlastitu poruku u niti.
  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset();
      fetch("/api/admin/portal/messages", { cache: "no-store" })
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data.messages)) setMessages(data.messages);
        })
        .catch(() => {});
    }
  }, [state]);

  useEffect(() => {
    if (messages.length !== lastCountRef.current) {
      lastCountRef.current = messages.length;
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages]);

  const grouped: { email: string; items: ChannelMessage[] }[] = [];
  for (const m of messages) {
    const last = grouped[grouped.length - 1];
    if (last && last.email === m.adminEmail) last.items.push(m);
    else grouped.push({ email: m.adminEmail, items: [m] });
  }

  return (
    <div className="portal-thread">
      <div className="portal-thread-messages" ref={scrollRef}>
        {messages.length === 0 ? (
          <p className="portal-thread-empty">Još nema poruka u timu — napiši prvu!</p>
        ) : (
          grouped.map((g, gi) => {
            const label = labelForEmail(g.email, roster);
            return (
              <div key={gi} className={`portal-msg-group ${g.email === currentEmail ? "is-own" : ""}`}>
                <div className="portal-msg-avatar" style={{ background: colorFor(g.email) }}>
                  {initialsFor(label)}
                </div>
                <div className="portal-msg-body">
                  <div className="portal-msg-head">
                    <span className="portal-msg-name">{label}</span>
                    <span className="portal-msg-time">{formatMsgTime(g.items[0].createdAt)}</span>
                  </div>
                  {g.items.map((m) => (
                    <p key={m.id} className="portal-msg-text">
                      {m.body}
                    </p>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
      <form ref={formRef} action={formAction} className="portal-thread-form">
        <textarea
          name="body"
          required
          rows={1}
          maxLength={4000}
          placeholder="Napiši poruku timu…"
          className="neu-input portal-thread-textarea"
        />
        <button type="submit" disabled={pending} className="neu-btn px-4 py-2 text-sm font-semibold shrink-0 disabled:opacity-50">
          <SendIcon />
        </button>
      </form>
      {state?.error && <p className="text-xs text-red-600 px-3 pb-2">{state.error}</p>}
    </div>
  );
}
