import webpush from "web-push";
import {
  listPushSubscriptionsForAdmins,
  listAdminIdsForNotification,
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

    const body = JSON.stringify(payload);
    await Promise.all(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            body
          );
        } catch (err) {
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
  } catch {
    // Obavijest nikad ne smije srušiti glavnu akciju.
  }
}
