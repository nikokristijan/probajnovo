import webpush from "web-push";
import {
  listPushSubscriptionsForAdmins,
  listAdminIdsForNotification,
  listAllPushSubscriptions,
  deletePushSubscription,
} from "@/lib/db/queries";

/**
 * Web Push (VAPID, besplatno, bez posrednika kao Firebase) — slanje
 * obavijesti adminima. Tri okidača (vidi lib/actions.ts
 * createInquiryAction/createReservationAction i
 * app/api/cron/reservation-reminders): novi upit, nova rezervacija (od
 * DRUGOG admina — vidi excludeAdminId), podsjetnik gost sutra stiže.
 *
 * VAPID ključevi se postavljaju preko env varijabli (vidi .env.example /
 * upute dostavljene korisniku uz SQL migraciju) — ako nisu postavljene,
 * slanje se tiho preskače (npr. lokalni dev bez konfiguracije) umjesto da
 * padne cijela akcija (rezervacija/upit se svakako mora spremiti).
 */
function vapidReady(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.VAPID_SUBJECT
  );
}

let configured = false;
function ensureConfigured() {
  if (configured) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
  configured = true;
}

type PushPayload = {
  title: string;
  body: string;
  /** Relativni URL na koji notificationclick (public/admin-sw.js) vodi. */
  url: string;
};

type Subscription = { endpoint: string; p256dh: string; auth: string };

/** Zajednička petlja slanja — koristi je i sendPushToAdmins (best-effort, bez
    povratne vrijednosti) i sendPushToAllDevices (broadcast, vraća brojeve za
    povratnu informaciju adminu koji šalje). Nikad ne baca grešku van po
    pojedinom uređaju — jedan mrtav uređaj ne smije prekinuti slanje ostalima. */
async function sendToSubscriptions(
  subs: Subscription[],
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  const body = JSON.stringify(payload);
  let sent = 0;
  let failed = 0;
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body
        );
        sent++;
      } catch (err) {
        failed++;
        // 404/410 = pretplata više ne postoji (npr. korisnik izbrisao
        // aplikaciju/podatke preglednika) — počisti da se ne pokušava
        // iznova svaki put; ostale greške samo tiho ignoriramo.
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await deletePushSubscription(sub.endpoint);
        }
      }
    })
  );
  return { sent, failed };
}

/**
 * Pošalji push obavijest svim adminima s pristupom zadanoj vikendici/firmi
 * (vidi listAdminIdsForNotification), na SVIM njihovim pretplaćenim
 * uređajima. `excludeAdminId` izostavlja admina koji je sam napravio akciju
 * (npr. drugi admin unio rezervaciju — ne treba obavijestiti samog sebe o
 * vlastitoj akciji, vidi zahtjev "Nova rezervacija (od drugog admina)").
 * Nikad ne baca grešku van — obavijest je "best effort" popratna radnja,
 * ne smije srušiti glavnu akciju (spremanje rezervacije/upita).
 */
export async function sendPushToAdmins(
  target: { propertyId?: number; companyId?: number },
  payload: PushPayload,
  options?: { excludeAdminId?: number }
): Promise<void> {
  if (!vapidReady()) return;
  try {
    ensureConfigured();
    const adminIds = (await listAdminIdsForNotification(target)).filter(
      (id) => id !== options?.excludeAdminId
    );
    if (adminIds.length === 0) return;
    const subs = await listPushSubscriptionsForAdmins(adminIds);
    if (subs.length === 0) return;
    await sendToSubscriptions(subs, payload);
  } catch {
    // Obavijest nikad ne smije srušiti glavnu akciju.
  }
}

/**
 * Broadcast — pošalji ručno sastavljenu obavijest BAŠ SVAKOM pretplaćenom
 * uređaju, svih admina (uključujući vlasnike koji su uključili obavijesti u
 * svojim postavkama), bez obzira na dodijeljene vikendice/firme. Za razliku
 * od sendPushToAdmins ovo NIJE tiho "best effort" — poziva ga
 * sendBroadcastPushAction (lib/actions.ts), koji admin koji šalje treba
 * vidjeti je li stvarno stiglo (vidi BroadcastPushForm), pa vraća brojeve i
 * pušta grešku dalje ako VAPID nije konfiguriran (jasna poruka umjesto
 * tihog "ništa se nije dogodilo").
 */
export async function sendPushToAllDevices(
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  if (!vapidReady()) {
    throw new Error("Obavijesti nisu konfigurirane na serveru (nedostaju VAPID env varijable).");
  }
  ensureConfigured();
  const subs = await listAllPushSubscriptions();
  if (subs.length === 0) return { sent: 0, failed: 0 };
  return sendToSubscriptions(subs, payload);
}
