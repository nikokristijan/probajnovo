"use client";

import { useEffect, useRef } from "react";

/**
 * Polling koji staje kad kartica nije vidljiva (plan #60). Ranije je svaka
 * otvorena kartica Portala slala ~68 upita u minuti i kad je bila u
 * pozadini. Kad se kartica vrati u prvi plan, odmah se osvježi jednom.
 */
export function useVisiblePolling(poll: () => void | Promise<void>, intervalMs: number) {
  const pollRef = useRef(poll);
  useEffect(() => {
    pollRef.current = poll;
  });

  useEffect(() => {
    let id: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (id === null) id = setInterval(() => void pollRef.current(), intervalMs);
    };
    const stop = () => {
      if (id !== null) {
        clearInterval(id);
        id = null;
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void pollRef.current();
        start();
      } else {
        stop();
      }
    };
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [intervalMs]);
}
