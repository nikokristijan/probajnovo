"use client";

import { useActionState, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import {
  createTeamChannelMessageInlineAction,
  toggleTeamMessageReactionAction,
  toggleTeamMessagePinAction,
  type ActionState,
} from "@/lib/actions";
import { colorFor, initialsFor, labelForEmail, formatMsgTime, type PortalMember } from "@/components/admin/portalUtils";
import { SendIcon, PinIcon, SmilePlusIcon } from "@/components/admin/Icons";

type ChannelMessageReaction = { emoji: string; count: number; mine: boolean };
type ChannelMessage = {
  id: number;
  adminEmail: string;
  body: string;
  createdAt: string;
  pinnedAt: string | null;
  pinnedByEmail: string | null;
  reactions: ChannelMessageReaction[];
};

const POLL_MS = 4_000;

/** Brzi izbor emojija za reakcije (Portal Faza 5) — namjerno mala, fiksna
    paleta umjesto punog emoji-pickera (isti "jednostavno umjesto
    razrađenog" duh kao brzi polling umjesto websocketa) — pokriva
    najčešće Slack/Teams reakcije. */
const QUICK_EMOJIS = ["👍", "❤️", "😂", "🎉", "👀", "🔥", "🙌", "✅"];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * @spominjanja (Portal Faza 5) — NAMJERNO bez posebnog stupca/tablice:
 * otkriva se pri renderiranju tako da se u tekstu poruke traži "@" + puna
 * oznaka nekog člana tima (labelForEmail — nadimak ili dio emaila prije @),
 * poredano po duljini oznake (duže prvo) da npr. "@Ana" ne "pojede" dio
 * teksta "@Ana Marić" ako oboje postoji u timu. `\p{L}`/`\p{N}` (umjesto
   \w) da granica riječi ispravno radi i s hrvatskim dijakritičkim znakovima
   (č/ć/š/ž/đ u imenima). */
function renderMessageBody(body: string, roster: PortalMember[], currentEmail: string): { nodes: ReactNode[]; mentionsMe: boolean } {
  const tokens = roster
    .map((m) => ({ email: m.email, label: labelForEmail(m.email, roster) }))
    .filter((t) => t.label.trim().length > 0)
    .sort((a, b) => b.label.length - a.label.length);

  if (tokens.length === 0) return { nodes: [body], mentionsMe: false };

  const pattern = new RegExp(`@(${tokens.map((t) => escapeRegExp(t.label)).join("|")})(?![\\p{L}\\p{N}])`, "gu");
  const nodes: ReactNode[] = [];
  let mentionsMe = false;
  let lastIndex = 0;
  let key = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(body)) !== null) {
    if (match.index > lastIndex) nodes.push(body.slice(lastIndex, match.index));
    const label = match[1];
    const token = tokens.find((t) => t.label === label);
    if (token && token.email === currentEmail) mentionsMe = true;
    nodes.push(
      <span key={`mention-${key++}`} className={`portal-mention${token?.email === currentEmail ? " is-me" : ""}`}>
        @{label}
      </span>
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < body.length) nodes.push(body.slice(lastIndex));
  return { nodes, mentionsMe };
}

/**
 * Opći tim kanal ("# tim", Portal Faza 3, proširen Fazom 5 — @spominjanja,
 * emoji reakcije, prikvačivanje) — Teams/Slack-stil nit (avatar + ime +
 * vrijeme + tekst, grupirano po pošiljatelju), BEZ redirecta na svaki unos
 * (za razliku od stare app/admin/poruke forme) — šalje preko useActionState,
 * osvježava se pollingom svake ~4s (korisnikov izričit izbor "brzi polling"
 * umjesto pravog websocketa/Pusher integracije). Reakcije/prikvačivanje
 * NISU useActionState forme (previše gumba po poruci) — direktan poziv
 * server akcije preko startTransition (isti obrazac kao
 * OwnerThemeToggle.tsx), pa odmah ponovno pollaju da vide stvaran rezultat.
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
  const [, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastCountRef = useRef(initialMessages.length);

  // @spominjanje padajući izbornik — mentionStart = indeks "@" znaka u
  // vrijednosti textarea, mentionQuery = tekst upisan poslije njega (null =
  // izbornik zatvoren). textarea ostaje "neupravljana" (bez React value
  // propa) da se ne kosi s FormData čitanjem na submit — čita/piše se
  // izravno preko textareaRef, isti duh kao formRef.current?.reset() niže.
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState(-1);
  const [highlightIndex, setHighlightIndex] = useState(0);

  // Otvoreni emoji picker ("+reakcija") — jedan po cijeloj niti (ne po
  // poruci) da klik izvan njega zna sve zatvoriti bez posebnog stanja za
  // svaku poruku.
  const [openPickerFor, setOpenPickerFor] = useState<number | null>(null);
  const [pinnedOpen, setPinnedOpen] = useState(true);
  const pickerWrapRef = useRef<HTMLDivElement>(null);

  async function refetchMessages() {
    try {
      const res = await fetch("/api/admin/portal/messages", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.messages)) setMessages(data.messages);
    } catch {
      // Tiho ignoriraj — jedan neuspjeli pokušaj ne treba prekinuti nit.
    }
  }

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      if (cancelled) return;
      await refetchMessages();
    };
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // Nakon uspješnog slanja odmah očisti formu i pokreni jedan izvanredni poll
  // (ne čekaj do 4s) da pošiljatelj smjesta vidi vlastitu poruku u niti).
  // Fetch inlined (umjesto poziva refetchMessages helpera) — isti oblik kao
  // prije Faze 5, jer eslint-plugin-react-hooks prijavljuje grešku na
  // direktan sinkroni poziv imenovane funkcije koja poziva setState unutar
  // efekta (react-hooks/set-state-in-effect), čak i kad je ta funkcija sama
  // async — inlined .then() lanac izbjegava tu (lažno pozitivnu) prijavu.
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

  // Zatvori otvoren emoji picker klikom bilo gdje izvan njega.
  useEffect(() => {
    if (openPickerFor === null) return;
    function onDocClick(e: MouseEvent) {
      if (pickerWrapRef.current && !pickerWrapRef.current.contains(e.target as Node)) {
        setOpenPickerFor(null);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [openPickerFor]);

  const mentionMatches =
    mentionQuery === null
      ? []
      : roster
          .filter((m) => {
            const label = labelForEmail(m.email, roster).toLowerCase();
            const q = mentionQuery.toLowerCase();
            return label.startsWith(q) || m.email.toLowerCase().startsWith(q);
          })
          .slice(0, 6);

  function handleInput() {
    const ta = textareaRef.current;
    if (!ta) return;
    const value = ta.value;
    const cursor = ta.selectionStart ?? value.length;
    const uptoCursor = value.slice(0, cursor);
    const at = uptoCursor.lastIndexOf("@");
    if (at === -1) {
      setMentionQuery(null);
      return;
    }
    const before = uptoCursor[at - 1];
    // "@" mora biti na početku retka/riječi (ne dio npr. "netko@nesto.hr").
    if (before !== undefined && !/\s/.test(before)) {
      setMentionQuery(null);
      return;
    }
    const query = uptoCursor.slice(at + 1);
    if (query.includes("\n") || query.length > 40) {
      setMentionQuery(null);
      return;
    }
    setMentionStart(at);
    setMentionQuery(query);
    setHighlightIndex(0);
  }

  function selectMention(member: PortalMember) {
    const ta = textareaRef.current;
    if (!ta || mentionStart < 0) return;
    const label = labelForEmail(member.email, roster);
    const value = ta.value;
    const cursor = ta.selectionStart ?? value.length;
    const newValue = value.slice(0, mentionStart) + "@" + label + " " + value.slice(cursor);
    ta.value = newValue;
    const newCursor = mentionStart + label.length + 2;
    ta.setSelectionRange(newCursor, newCursor);
    ta.focus();
    setMentionQuery(null);
    setMentionStart(-1);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (mentionQuery !== null && mentionMatches.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightIndex((i) => (i + 1) % mentionMatches.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightIndex((i) => (i - 1 + mentionMatches.length) % mentionMatches.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        selectMention(mentionMatches[highlightIndex]);
        return;
      }
      if (e.key === "Escape") {
        setMentionQuery(null);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  }

  function handleToggleReaction(messageId: number, emoji: string) {
    setOpenPickerFor(null);
    startTransition(() => {
      toggleTeamMessageReactionAction(messageId, emoji)
        .then(refetchMessages)
        .catch(() => {});
    });
  }

  function handleTogglePin(messageId: number) {
    startTransition(() => {
      toggleTeamMessagePinAction(messageId)
        .then(refetchMessages)
        .catch(() => {});
    });
  }

  const grouped: { email: string; items: ChannelMessage[] }[] = [];
  for (const m of messages) {
    const last = grouped[grouped.length - 1];
    if (last && last.email === m.adminEmail) last.items.push(m);
    else grouped.push({ email: m.adminEmail, items: [m] });
  }

  const pinnedMessages = messages
    .filter((m) => m.pinnedAt)
    .sort((a, b) => (a.pinnedAt! < b.pinnedAt! ? 1 : -1));

  return (
    <div className="portal-thread">
      {pinnedMessages.length > 0 && (
        <div className="portal-pinned-panel">
          <button type="button" className="portal-pinned-toggle" onClick={() => setPinnedOpen((v) => !v)}>
            <PinIcon />
            <span>
              Prikvačeno ({pinnedMessages.length}){" "}
            </span>
            <span className="portal-pinned-chevron">{pinnedOpen ? "▲" : "▼"}</span>
          </button>
          {pinnedOpen && (
            <div className="portal-pinned-list">
              {pinnedMessages.map((m) => (
                <div key={m.id} className="portal-pinned-item">
                  <span className="portal-pinned-author" style={{ color: colorFor(m.adminEmail) }}>
                    {labelForEmail(m.adminEmail, roster)}
                  </span>
                  <span className="portal-pinned-text">{m.body}</span>
                  <button
                    type="button"
                    className="portal-pinned-unpin"
                    onClick={() => handleTogglePin(m.id)}
                    title="Otkvači"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
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
                  {g.items.map((m) => {
                    const { nodes, mentionsMe } = renderMessageBody(m.body, roster, currentEmail);
                    return (
                      <div key={m.id} className={`portal-msg-row${mentionsMe ? " mentions-me" : ""}`}>
                        <p className="portal-msg-text">{nodes}</p>
                        <div className="portal-msg-actions">
                          {m.reactions.map((r) => (
                            <button
                              key={r.emoji}
                              type="button"
                              className={`portal-reaction-pill${r.mine ? " is-mine" : ""}`}
                              onClick={() => handleToggleReaction(m.id, r.emoji)}
                              title={r.mine ? "Ukloni reakciju" : "Dodaj reakciju"}
                            >
                              <span>{r.emoji}</span>
                              <span className="portal-reaction-count">{r.count}</span>
                            </button>
                          ))}
                          <div className="portal-reaction-add-wrap" ref={openPickerFor === m.id ? pickerWrapRef : undefined}>
                            <button
                              type="button"
                              className="portal-msg-action-btn"
                              onClick={() => setOpenPickerFor((cur) => (cur === m.id ? null : m.id))}
                              aria-label="Dodaj reakciju"
                              title="Dodaj reakciju"
                            >
                              <SmilePlusIcon />
                            </button>
                            {openPickerFor === m.id && (
                              <div className="portal-reaction-picker">
                                {QUICK_EMOJIS.map((e) => (
                                  <button key={e} type="button" onClick={() => handleToggleReaction(m.id, e)}>
                                    {e}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            className={`portal-msg-action-btn${m.pinnedAt ? " is-pinned" : ""}`}
                            onClick={() => handleTogglePin(m.id)}
                            aria-label={m.pinnedAt ? "Otkvači poruku" : "Prikvači poruku"}
                            title={m.pinnedAt ? "Otkvači poruku" : "Prikvači poruku"}
                          >
                            <PinIcon />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
      <form ref={formRef} action={formAction} className="portal-thread-form">
        <div className="portal-thread-input-wrap">
          {mentionQuery !== null && mentionMatches.length > 0 && (
            <div className="portal-mention-dropdown">
              {mentionMatches.map((m, i) => {
                const mLabel = labelForEmail(m.email, roster);
                return (
                  <button
                    key={m.email}
                    type="button"
                    className={`portal-mention-option${i === highlightIndex ? " is-active" : ""}`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selectMention(m);
                    }}
                  >
                    <span className="portal-mention-avatar" style={{ background: colorFor(m.email) }}>
                      {initialsFor(mLabel)}
                    </span>
                    {mLabel}
                  </button>
                );
              })}
            </div>
          )}
          <textarea
            ref={textareaRef}
            name="body"
            required
            rows={1}
            maxLength={4000}
            placeholder="Napiši poruku timu… (@ za spomenuti, Enter za slanje)"
            className="neu-input portal-thread-textarea"
            onInput={handleInput}
            onKeyDown={handleKeyDown}
          />
        </div>
        <button type="submit" disabled={pending} className="neu-btn px-4 py-2 text-sm font-semibold shrink-0 disabled:opacity-50">
          <SendIcon />
        </button>
      </form>
      {state?.error && <p className="text-xs text-red-600 px-3 pb-2">{state.error}</p>}
    </div>
  );
}
