import type { StepInput } from "./types";

export type AutomationTemplate = {
  key: string;
  name: string;
  description: string;
  trigger: "SERVICE_COMPLETED" | "CLIENT_CREATED" | "MANUAL";
  steps: StepInput[];
};

/*
 * Predlošci su namjerno BEZ dijakritika: SMS s č/ć/š/ž/đ prelazi u Unicode i
 * stane samo 70 znakova po poruci (umjesto 160), pa se plaća 2-3 puta više. Jedina iznimka je fraza za odjavu
 * "napišite": sastavljač je sam piše bez kvačica kad je ostatak poruke GSM-7 (vidi dolje).
 *
 * Odjava se u predlošku ne mora pisati: sastavljač (composeSms, lib/recenzije/sms-format.ts) svakoj poruci stavlja
 * TOČNO JEDNU uputu kao zadnji redak, ovisno o pružatelju. Gdje odgovori rade (Android mobitel, TextBee s webhookom)
 * to je "Za odjavu napišite STOP." (bez kvačica kad je ostatak poruke GSM-7), a gdje ne rade (Twilio u Hrvatskoj,
 * TextBee bez webhooka) "Odjava: <poveznica>". Ako predložak ima vlastitu frazu "Za odjavu napišite STOP." (ili stariji
 * oblik "odgovorite STOP"), ona se normalizira ili zamijeni poveznicom, pa u poruci nikad nisu dvije upute.
 * Jedina ključna riječ koju klijent vidi je STOP.
 */
export const DEFAULT_REQUEST =
  "Bok {first_name}! Hvala sto ste odabrali {business_name}. Ako imate minutu, kratka Google recenzija bi nam puno znacila: {review_link}";
export const DEFAULT_FOLLOW_UP =
  "Bok {first_name}, samo kratki podsjetnik od {business_name}: ako ste bili zadovoljni, podijelite iskustvo u par rijeci {review_link} Za odjavu napišite STOP.";

export const AUTOMATION_TEMPLATES: AutomationTemplate[] = [
  {
    key: "post_service_review",
    name: "Zahtjev za recenziju nakon usluge",
    description: "10 minuta nakon završenog posla pošalje zahtjev, a ako klijent ne klikne, jedan podsjetnik dan kasnije.",
    trigger: "SERVICE_COMPLETED",
    steps: [
      { type: "wait", minutes: 10 },
      { type: "send_review_request", template: DEFAULT_REQUEST },
      { type: "wait", minutes: 1440 },
      { type: "condition", check: "clicked", ifTrue: "end", ifFalse: "continue" },
      { type: "send_follow_up", template: DEFAULT_FOLLOW_UP },
    ],
  },
  {
    key: "review_follow_up",
    name: "Podsjetnik za recenziju",
    description: "Dva nenametljiva podsjetnika u razmaku od tri dana klijentima koji još nisu ostavili recenziju.",
    trigger: "MANUAL",
    steps: [
      { type: "condition", check: "reviewed", ifTrue: "end", ifFalse: "continue" },
      { type: "send_follow_up", template: DEFAULT_FOLLOW_UP },
      { type: "wait", minutes: 4320 },
      { type: "condition", check: "clicked", ifTrue: "end", ifFalse: "continue" },
      { type: "send_follow_up", template: "Zadnji podsjetnik od {business_name}, {first_name}: {review_link} Hvala vam!" },
    ],
  },
  {
    key: "appointment_reminder",
    name: "Podsjetnik za termin",
    description: "Pošalje podsjetnik za nadolazeći termin.",
    trigger: "MANUAL",
    steps: [
      {
        type: "send_message",
        template: "Bok {first_name}, podsjetnik: {business_name} dolazi {service_date} ({service}). Ako trebate promijeniti termin, nazovite nas.",
      },
    ],
  },
  {
    key: "thank_you",
    name: "Poruka zahvale",
    description: "Kratko hvala odmah nakon posla, bez traženja recenzije.",
    trigger: "SERVICE_COMPLETED",
    steps: [
      { type: "wait", minutes: 30 },
      { type: "send_message", template: "Hvala {first_name}! Bilo nam je drago raditi s vama danas. {business_name}" },
    ],
  },
  {
    key: "inactive_reengagement",
    name: "Povratak neaktivnih klijenata",
    description: "Javite se klijentima koji vas dugo nisu zvali.",
    trigger: "MANUAL",
    steps: [
      {
        type: "send_message",
        template: "Bok {first_name}, ovdje {business_name}. Proslo je neko vrijeme od zadnjeg servisa ({service}). Zelite li kratki pregled? Nazovite nas i dogovorimo termin.",
      },
    ],
  },
  {
    key: "custom",
    name: "Vlastita automatizacija",
    description: "Krenite od praznog okidača i složite svoje korake.",
    trigger: "SERVICE_COMPLETED",
    steps: [{ type: "send_review_request", template: DEFAULT_REQUEST }],
  },
];
