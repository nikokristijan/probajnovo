"use client";

import { useVisiblePolling } from "@/components/admin/useVisiblePolling";
import { Fragment, useActionState, useEffect, useRef, useState } from "react";
import { createDirectMessageAction, type ActionState } from "@/lib/actions";
import {
  colorFor,
  initialsFor,
  labelForEmail,
  formatMsgClock,
  formatMsgDayLabel,
  groupMessagesByDay,
  type PortalMember,
} from "@/components/admin/portalUtils";
import { SendIcon } from "@/components/admin/Icons";

type DirectMsg = {
  id: number;
  fromEmail: string;
  toEmail: string;
  body: string;
  createdAt: string;
  readAt?: string | null;
};

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
  const lastIdRef = useRef(initialMessages[initialMessages.length - 1]?.id ?? 0);

  useVisiblePolling(async () => {
    try {
      const res = await fetch(`/api/admin/portal/dm?with=${encodeURIComponent(otherEmail)}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.messages)) {
        const next = JSON.stringify(data.messages);
        setMessages((cur) => (JSON.stringify(cur) === next ? cur : data.messages));
      }
    } catch {
      // Tiho ignoriraj.
    }
  }, POLL_MS);

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
    const lastId = messages[messages.length - 1]?.id ?? 0;
    if (lastId !== lastIdRef.current) {
      lastIdRef.current = lastId;
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages]);

  const otherLabel = labelForEmail(otherEmail, roster);
  const lastMsg = messages[messages.length - 1];
  const lastOwn = lastMsg && lastMsg.fromEmail === currentEmail ? lastMsg : null;

  return (
    <div className="portal-thread">
      <div className="portal-thread-messages" ref={scrollRef}>
        {messages.length === 0 ? (
          <p className="portal-thread-empty">Još nema poruka s {otherLabel} — napiši prvu!</p>
        ) : (
          groupMessagesByDay(messages, (m) => m.fromEmail).map((g, gi) => {
            const isOwn = g.sender === currentEmail;
            const label = labelForEmail(g.sender, roster);
            return (
              <Fragment key={gi}>
                {g.showDay && (
                  <div className="portal-day-sep" role="separator">
                    <span>{formatMsgDayLabel(g.items[0].createdAt)}</span>
                  </div>
                )}
                <div className={`portal-msg-group ${isOwn ? "is-own" : ""}`}>
                  <div className="portal-msg-avatar" style={{ background: colorFor(g.sender) }}>
                    {initialsFor(label)}
                  </div>
                  <div className="portal-msg-body">
                    <div className="portal-msg-head">
                      <span className="portal-msg-name">{label}</span>
                      <time className="portal-msg-time" dateTime={g.items[0].createdAt}>
                        {formatMsgClock(g.items[0].createdAt)}
                      </time>
                    </div>
                    {g.items.map((m) => (
                      <div key={m.id} className="portal-msg-row">
                        <time className="portal-msg-row-time" dateTime={m.createdAt} aria-hidden="true">
                          {formatMsgClock(m.createdAt)}
                        </time>
                        <p className="portal-msg-text">{m.body}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </Fragment>
            );
          })
        )}
        {/* Plan #72: "Pročitano" ispod zadnje poslane poruke. */}
        {lastOwn && (
          <p className="portal-read-receipt">
            {lastOwn.readAt ? `Pročitano ${formatMsgClock(lastOwn.readAt)}` : "Poslano"}
          </p>
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
