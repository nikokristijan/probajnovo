import "server-only";
import { eq } from "drizzle-orm";
import { db } from "./index";
import * as s from "./schema";
import { AUTOMATION_TEMPLATES, DEFAULT_FOLLOW_UP, DEFAULT_REQUEST } from "@/lib/recenzije/automation/templates";
import { createId, createToken } from "@/lib/recenzije/id";
import { env } from "@/lib/recenzije/env";

/**
 * Paketi i demo radni prostor "Donald's Cooling". Pokreće se automatski iz
 * ensureReviewsDb(): paketi se ubacuju samo ako ne postoje (ručne izmjene
 * cijena u bazi ostaju), demo se kreira samo jednom.
 *
 * Demo je označen is_demo: sučelje ga prikazuje kao primjer, sve izmjene su
 * zaključane i nikakav SMS se iz njega ne šalje.
 */
const PLANS = [
  {
    key: "starter",
    name: "Starter",
    description: "Za obrt ili jednu ekipu koja kreće skupljati recenzije.",
    priceMonthlyCents: 4900,
    smsMonthlyLimit: 300,
    locationLimit: 1,
    position: 1,
    features: ["300 SMS-ova mjesečno", "Automatski zahtjev nakon posla", "Podsjetnik ako klijent ne klikne", "Praćenje klikova i recenzija", "Podrška emailom"],
  },
  {
    key: "growth",
    name: "Growth",
    description: "Za tvrtke s puno poslova kojima je svaka recenzija bitna.",
    priceMonthlyCents: 9900,
    smsMonthlyLimit: 1000,
    locationLimit: 3,
    position: 2,
    features: ["1.000 SMS-ova mjesečno", "Neograničene automatizacije i kampanje", "AI pisanje poruka", "Google recenzije i odgovori", "Analitika po serviseru i usluzi"],
  },
  {
    key: "agency",
    name: "Agency",
    description: "Za agencije i lance s više lokacija.",
    priceMonthlyCents: 19900,
    smsMonthlyLimit: 3000,
    locationLimit: 10,
    position: 3,
    features: ["3.000 SMS-ova mjesečno", "Do 10 lokacija", "Više radnih prostora", "AI izvještaji o rezultatima", "Prioritetna podrška"],
  },
];

export async function seedPlans() {
  await db.insert(s.plans).values(PLANS).onConflictDoNothing({ target: s.plans.key });
}

export const DEMO_SLUG = "donalds-cooling-demo";
export const DEMO_EMAIL = "demo@recenzije.probajnovo.com";

const H = 3_600_000;
const D = 24 * H;

type DemoClient = {
  first: string;
  last: string;
  phone: string;
  email?: string;
  service: string;
  tech: string;
  daysAgo: number;
  status: s.ReviewStatus;
  rating?: number;
  comment?: string;
  failed?: boolean;
  followUp?: boolean;
  notes?: string;
};

// Pet klijenata iz specifikacije + realna mješavina ostalih poslova.
const CLIENTS: DemoClient[] = [
  { first: "John", last: "Smith", phone: "+385911110101", email: "john.smith@example.com", service: "Ugradnja klime", tech: "Ivan Marić", daysAgo: 12, status: "REVIEW_RECEIVED", rating: 5, comment: "Ivan je ugradio novu klimu u jedno popodne i sve počistio za sobom. Konačno je hladno u stanu. Preporuka!" },
  { first: "Mike", last: "Johnson", phone: "+385911110102", email: "mike.j@example.com", service: "Popravak klime", tech: "Luka Babić", daysAgo: 9, status: "REVIEW_RECEIVED", rating: 5, comment: "Popravak isti dan, poštena cijena i objasnili su što je bio problem." },
  { first: "Sarah", last: "Williams", phone: "+385911110103", email: "sarah.w@example.com", service: "Servis klima uređaja", tech: "Marko Perić", daysAgo: 7, status: "REVIEW_RECEIVED", rating: 4, comment: "Temeljit servis. Stigli su malo kasnije nego dogovoreno, ali posao je odličan." },
  { first: "David", last: "Brown", phone: "+385911110104", service: "Hitna intervencija", tech: "Ivan Marić", daysAgo: 5, status: "REVIEW_RECEIVED", rating: 5, comment: "Klima nam se pokvarila u 21 h usred toplinskog vala, do 23 h je radila. Spasili su nas.", followUp: true },
  { first: "James", last: "Wilson", phone: "+385911110105", email: "jwilson@example.com", service: "Ugradnja klime", tech: "Luka Babić", daysAgo: 3, status: "REVIEW_RECEIVED", rating: 5, comment: "Profesionalna ekipa, ponuda je bila točno kao konačni račun." },
  { first: "Ivana", last: "Horvat", phone: "+385911110106", service: "Servis klima uređaja", tech: "Marko Perić", daysAgo: 2, status: "CLICKED" },
  { first: "Marko", last: "Kovačević", phone: "+385911110107", service: "Popravak klime", tech: "Ivan Marić", daysAgo: 1, status: "FOLLOW_UP_SCHEDULED" },
  { first: "Ana", last: "Jurić", phone: "+385911110108", email: "ana.juric@example.com", service: "Popravak klime", tech: "Luka Babić", daysAgo: 1, status: "REQUEST_SENT" },
  { first: "Petar", last: "Novak", phone: "+385911110109", service: "Hitna intervencija", tech: "Marko Perić", daysAgo: 6, status: "CLICKED", followUp: true },
  { first: "Maja", last: "Knežević", phone: "+385911110110", service: "Servis klima uređaja", tech: "Ivan Marić", daysAgo: 1, status: "FOLLOW_UP_SCHEDULED" },
  { first: "Tomislav", last: "Vuković", phone: "+38591111011", service: "Ugradnja klime", tech: "Luka Babić", daysAgo: 8, status: "NOT_CONTACTED", failed: true, notes: "Broj na radnom nalogu izgleda nepotpuno, provjeriti s klijentom." },
  { first: "Katarina", last: "Marković", phone: "+385911110112", service: "Popravak klime", tech: "Marko Perić", daysAgo: 0, status: "NOT_CONTACTED" },
  { first: "Josip", last: "Pavić", phone: "+385911110113", service: "Servis klima uređaja", tech: "Ivan Marić", daysAgo: 0, status: "NOT_CONTACTED" },
  { first: "Lucija", last: "Tomić", phone: "+385911110114", service: "Ugradnja klime", tech: "Marko Perić", daysAgo: 15, status: "COMPLETED", rating: 5, comment: "Druga ugradnja s njima, ista kvaliteta." },
];

// Starije recenzije, prije nego što je tvrtka počela s automatskim zahtjevima.
const HISTORY: { name: string; rating: number; days: number; comment?: string }[] = [
  { name: "Kristina V.", rating: 5, days: 170, comment: "Brzo i ljubazno." },
  { name: "Stjepan P.", rating: 4, days: 158 },
  { name: "Andrea R.", rating: 5, days: 141, comment: "Brzo su popravili dizalicu topline." },
  { name: "Boris K.", rating: 3, days: 133, comment: "Dobar posao, ali termin se dugo čekao." },
  { name: "Marija L.", rating: 5, days: 118 },
  { name: "Goran H.", rating: 5, days: 101, comment: "Poštene cijene." },
  { name: "Ola S.", rating: 4, days: 86 },
  { name: "Kristijan D.", rating: 5, days: 74, comment: "Sve su jasno objasnili." },
  { name: "Pavao M.", rating: 5, days: 61 },
  { name: "Renata T.", rating: 5, days: 48, comment: "Najbolji servis klima u gradu." },
  { name: "Krešimir B.", rating: 4, days: 37 },
  { name: "Lana N.", rating: 5, days: 26, comment: "Točni i uredni." },
  { name: "Mladen F.", rating: 5, days: 19 },
];

export async function seedDemo() {
  const [existing] = await db.select({ id: s.organizations.id }).from(s.organizations).where(eq(s.organizations.slug, DEMO_SLUG)).limit(1);
  if (existing) return;

  const now = Date.now();
  const at = (daysAgo: number, hour = 10, minute = 0) => {
    const d = new Date(now - daysAgo * D);
    d.setUTCHours(hour - 2, minute, 0, 0);
    while (d.getTime() > now - 30 * 60_000) d.setTime(d.getTime() - 3 * H);
    return d;
  };
  const base = env.appUrl;

  let [user] = await db.select().from(s.users).where(eq(s.users.email, DEMO_EMAIL));
  if (!user) {
    // Bez lozinke: u demo se ulazi samo gumbom "Isprobaj demo".
    [user] = await db.insert(s.users).values({ email: DEMO_EMAIL, name: "Donald Parker" }).returning();
  }

  const [org] = await db
    .insert(s.organizations)
    .values({
      name: "Donald's Cooling",
      slug: DEMO_SLUG,
      industry: "Klimatizacija i grijanje",
      timezone: "Europe/Zagreb",
      phone: "+385911110100",
      isDemo: true,
      googleReviewUrl: "https://www.google.com/search?q=Donald%27s+Cooling+recenzije",
    })
    .returning();
  await db.insert(s.organizationMembers).values({ organizationId: org.id, userId: user.id, role: "OWNER" });
  await db.insert(s.subscriptions).values({ organizationId: org.id, planKey: "growth", status: "active", currentPeriodEnd: new Date(now + 20 * D) });

  const tpl = (key: string) => AUTOMATION_TEMPLATES.find((t) => t.key === key)!;
  const auto = (key: string, enabled: boolean) => {
    const t = tpl(key);
    return {
      organizationId: org.id,
      name: t.name,
      description: t.description,
      trigger: t.trigger,
      templateKey: t.key,
      enabled,
      steps: t.steps.map((x) => ({ ...x, id: createId() })) as s.Automation["steps"],
    };
  };
  const [postAuto] = await db
    .insert(s.automations)
    .values([auto("post_service_review", true), auto("review_follow_up", true), auto("thank_you", false)])
    .returning();

  const [campaign] = await db
    .insert(s.campaigns)
    .values({
      organizationId: org.id,
      name: "Ljetna akcija recenzija",
      status: "ACTIVE",
      audience: { serviceWithinDays: 30, statuses: ["NOT_CONTACTED"] },
      messageBody: "Bok {first_name}, hvala sto ste ovog ljeta odabrali {business_name}! Biste li podijelili kratku Google recenziju? {review_link}",
      followUpEnabled: true,
      followUpAfterHours: 48,
      followUpBody: DEFAULT_FOLLOW_UP,
      launchedAt: at(14, 9),
    })
    .returning();
  await db.insert(s.campaigns).values({
    organizationId: org.id,
    name: "Jesenski servis",
    status: "DRAFT",
    audience: { serviceWithinDays: 180, statuses: ["REVIEW_RECEIVED", "COMPLETED"], service: "Servis klima uređaja" },
    messageBody: "Bok {first_name}, ovdje {business_name}. Jesen je idealna za servis klime. Odgovorite DA i nazvat cemo vas za termin.",
    followUpEnabled: false,
    followUpAfterHours: 48,
  });

  await db.insert(s.messageTemplates).values([
    { organizationId: org.id, name: "Ljubazni zahtjev", kind: "REVIEW_REQUEST", body: DEFAULT_REQUEST },
    { organizationId: org.id, name: "Nenametljivi podsjetnik", kind: "FOLLOW_UP", body: DEFAULT_FOLLOW_UP },
    {
      organizationId: org.id,
      name: "Hvala nakon hitne intervencije",
      kind: "REVIEW_REQUEST",
      body: "Bok {first_name}, hvala sto ste nazvali {business_name} za hitnu intervenciju. {technician} je rado pomogao. Ako smo zasluzili, kratka recenzija pomaze susjedima da nas pronadju: {review_link}",
    },
  ]);

  const activity: (typeof s.activityEvents.$inferInsert)[] = [];
  const requestBody = (first: string, link: string) =>
    `Bok ${first}! Hvala sto ste odabrali Donald's Cooling. Ako imate minutu, kratka Google recenzija bi nam puno znacila: ${link}`;

  for (const [i, c] of CLIENTS.entries()) {
    const serviceAt = at(c.daysAgo, 9 + (i % 6), (i * 7) % 60);
    const [client] = await db
      .insert(s.clients)
      .values({
        organizationId: org.id,
        firstName: c.first,
        lastName: c.last,
        phone: c.phone,
        email: c.email ?? null,
        notes: c.notes ?? null,
        reviewStatus: c.status,
        createdAt: new Date(serviceAt.getTime() - 2 * H),
      })
      .returning();
    const name = `${c.first} ${c.last}`;
    const [service] = await db
      .insert(s.services)
      .values({ organizationId: org.id, clientId: client.id, name: c.service, technician: c.tech, serviceDate: serviceAt, completedAt: serviceAt })
