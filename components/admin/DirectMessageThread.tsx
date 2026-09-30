"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createDirectMessageAction, type ActionState } from "@/lib/actions";
import { colorFor, initialsFor, labelForEmail, formatMsgTime, type PortalMember } from "@/components/admin/portalUtils";
import { SendIcon } from "@/components/admin/Icons";

type DirectMsg = { id: number; fromEmail: string; toEmail: string; body: string; createdAt: string };

const POLL_MS = 4_000;

/**
 * 1:1 razgovor (Portal Faza 3, "Nek bude i direktno dopisivanje") — ista
 * Teams-stil nit kao TeamChannelThread, samo vezana uz jednog sugovornika
 * (otherEmail) preko app/admin/portal/dm/[email]/page.tsx. createDirectMessageAction
 * je već bez redirecta (vidi lib/actions.ts) — građen upravo za ovu
 * komponentu.
 */
export default function DirectMessageThread({
  currentEmail,
  otherEmail,
  initialMessages,
  roster,
}: {
  currentEmail: string;
  otherEmail: string;
  initialMessages: DirectMsg[];
  roster: PortalMember[];
}) {
  const [messages, setMessages] = useState(initialMessages);
  const boundAction = createDirectMessageAction.bind(null, otherEmail);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(boundAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastCountRef = useRef(initialMessages.length);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/admin/portal/dm?with=${encodeURIComponent(otherEmail)}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data.messages)) setMessages(data.messages);
      } catch {
        // Tiho ignoriraj.
      }
    };
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [otherEmail]);

  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset();
      fetch(`/api/admin/portal/dm?with=${encodeURIComponent(otherEmail)}`, { cache: "no-store" })
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data.messages)) setMessages(data.messages);
        })
        .catch(() => {});
    }
  }, [state, otherEmail]);

  // Pri prvom prikazu skoči na dno niti (najnovije poruke), isto kao tim chat.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    if (messages.length !== lastCountRef.current) {
      lastCountRef.current = messages.length;
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages]);

  const otherLabel = labelForEmail(otherEmail, roster);

  return (
    <div className="portal-thread">
      <div className="portal-thread-messages" ref={scrollRef}>
        {messages.length === 0 ? (
          <p className="portal-thread-empty">Još nema poruka s {otherLabel} — napiši prvu!</p>
        ) : (
          messages.map((m) => {
            const isOwn = m.fromEmail === currentEmail;
            const label = labelForEmail(m.fromEmail, roster);
            return (
              <div key={m.id} className={`portal-msg-group ${isOwn ? "is-own" : ""}`}>
                <div className="portal-msg-avatar" style={{ background: colorFor(m.fromEmail) }}>
                  {initialsFor(label)}
                </div>
                <div className="portal-msg-body">
                  <div className="portal-msg-head">
                    <span className="portal-msg-name">{label}</span>
                    <span className="portal-msg-time">{formatMsgTime(m.createdAt)}</span>
                  </div>
                  <p className="portal-msg-text">{m.body}</p>
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
          placeholder={`Poruka za ${otherLabel}…`}
          className="na-input portal-thread-textarea"
        />
        <button type="submit" disabled={pending} className="na-btn portal-send-btn disabled:opacity-50" aria-label="Pošalji poruku">
          <SendIcon size={17} />
        </button>
      </form>
      {state?.error && <p className="text-xs text-red-600 px-3 pb-2">{state.error}</p>}
    </div>
  );
}
