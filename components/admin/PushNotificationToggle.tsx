"use client";

import { useEffect, useState } from "react";

/**
 * Prekidač za push obavijesti na /admin/settings — treći "sloj" uz PWA
 * instalabilnost (manifest/PwaRegister) i service worker (admin-sw.js push
 * handler): ovdje se traži dozvola preglednika i sprema pretplata na server
 * (vidi app/api/admin/push/subscribe, lib/push.ts sendPushToAdmins).
 *
 * `initialSubscribed` dolazi sa servera (hasPushSubscription) kao početno
 * nagađanje — pravo stanje ("je li OVAJ preglednik pretplaćen") provjeravamo
 * tek na klijentu jer server ne zna po pregledniku, samo po adminu (isti
 * admin može biti prijavljen na više uređaja).
 */
export default function PushNotificationToggle({
  initialSubscribed,
}: {
  initialSubscribed: boolean;
}) {
  const [supported, setSupported] = useState(true);
  const [subscribed, setSubscribed] = useState(initialSubscribed);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (
        typeof window === "undefined" ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window)
      ) {
        setSupported(false);
        return;
      }
      try {
        const reg = await navigator.serviceWorker.getRegistration("/admin");
        const sub = await reg?.pushManager.getSubscription();
        if (!cancelled) setSubscribed(Boolean(sub));
      } catch {
        // ostaje initialSubscribed nagađanje sa servera
      } finally {
        if (!cancelled) setChecked(true);
      }
    }
    check();
    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    setBusy(true);
    setError(null);
    try {
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) {
        setError("Obavijesti nisu konfigurirane na serveru.");
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setError("Dozvola za obavijesti nije odobrena.");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
      const res = await fetch("/api/admin/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) throw new Error();
      setSubscribed(true);
    } catch {
      setError("Nije uspjelo uključivanje obavijesti. Pokušaj ponovno.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setError(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/admin/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } catch {
      setError("Nije uspjelo isključivanje obavijesti.");
    } finally {
      setBusy(false);
    }
  }

  if (!supported) {
    return (
      <p className="text-sm text-black/50 max-w-sm">
        Ovaj preglednik/uređaj ne podržava push obavijesti. Na iPhoneu treba iOS 16.4+ i aplikacija
        dodana na početni zaslon.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-black/60 max-w-sm">
        Obavijesti izravno na uređaj za novi upit, novu rezervaciju (unesenu od drugog admina) i
        podsjetnik dan prije dolaska gosta.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {subscribed ? (
        <button
          type="button"
          onClick={disable}
          disabled={busy || !checked}
          className="self-start rounded-full border border-red-600 text-red-600 text-sm font-semibold px-5 py-2.5 disabled:opacity-50"
        >
          {busy ? "Isključivanje…" : "Isključi obavijesti"}
        </button>
      ) : (
        <button
          type="button"
          onClick={enable}
          disabled={busy || !checked}
          className="self-start rounded-full bg-black text-white text-sm font-semibold px-5 py-2.5 disabled:opacity-50"
        >
          {busy ? "Uključivanje…" : "Uključi obavijesti"}
        </button>
      )}
    </div>
  );
}

/** VAPID javni ključ dolazi kao URL-safe base64 string — Push API traži
    Uint8Array, standardna konverzija preporučena u web-push dokumentaciji. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
