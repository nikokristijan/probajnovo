/**
 * NOVO Reviews — multi-tenant database schema (Drizzle ORM, PostgreSQL).
 *
 * Tenancy: every business-owned table carries `organizationId`. Application
 * code never queries these tables without an organization filter; see
 * lib/recenzije/session.ts (requireOrg) and the repositories in services/.
 */
import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createId } from "@/lib/recenzije/id";

const id = () => text("id").primaryKey().$defaultFn(createId);
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());
const orgRef = () =>
  text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" });

// --- Enums ---

export const memberRole = pgEnum("nr_member_role", ["OWNER", "ADMIN", "MEMBER"]);
export const reviewStatus = pgEnum("nr_review_status", [
  "NOT_CONTACTED",
  "REQUEST_SENT",
  "CLICKED",
  "FOLLOW_UP_SCHEDULED",
  "REVIEW_RECEIVED",
  "COMPLETED",
]);
export const messageDirection = pgEnum("nr_message_direction", ["OUTBOUND", "INBOUND"]);
export const messageStatus = pgEnum("nr_message_status", [
  "QUEUED",
  "SENT",
  "DELIVERED",
  "FAILED",
  "UNDELIVERED",
  "RECEIVED",
]);
export const messageKind = pgEnum("nr_message_kind", [
  "REVIEW_REQUEST",
  "FOLLOW_UP",
  "CAMPAIGN",
  "MANUAL",
  "TEST",
  "REPLY",
]);
export const reviewSource = pgEnum("nr_review_source", ["GOOGLE", "MANUAL"]);
/** Google never says who wrote a review, so attribution is explicit about how it was made. */
export const reviewMatch = pgEnum("nr_review_match", ["NONE", "NAME_MATCH", "MANUAL"]);
export const campaignStatus = pgEnum("nr_campaign_status", ["DRAFT", "ACTIVE", "PAUSED", "COMPLETED"]);
export const automationTrigger = pgEnum("nr_automation_trigger", [
  "SERVICE_COMPLETED",
  "CLIENT_CREATED",
  "MANUAL",
]);
export const runStatus = pgEnum("nr_run_status", ["RUNNING", "WAITING", "COMPLETED", "FAILED", "CANCELLED"]);

// --- Auth ---

export const users = pgTable("nr_users", {
  id: id(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { mode: "date", withTimezone: true }),
  image: text("image"),
  passwordHash: text("password_hash"),
  googleId: text("google_id").unique(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const passwordResetTokens = pgTable("nr_password_reset_tokens", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: createdAt(),
});

/**
 * ZASTARJELO: pozivni kodovi za registraciju. NOVO Recenzije su usluga koju vodi
 * NOVO tim (klijenti nemaju registraciju), pa se kodovi više ne koriste ni ne
 * prikazuju. Tablica ostaje u shemi i DDL-u (bez destruktivnih migracija) da se
 * postojeći redovi ne gube.
 */
export const inviteCodes = pgTable(
  "nr_invite_codes",
  {
    id: id(),
    /** Kanonski oblik NOVO-XXXX-XXXX (velika slova, bez dvosmislenih znakova). */
    code: text("code").notNull().unique(),
    /** Interna bilješka za kome je kod namijenjen. */
    label: text("label"),
    maxUses: integer("max_uses").notNull().default(1),
    uses: integer("uses").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    /** Email admina koji je kod napravio. */
    createdBy: text("created_by"),
    /** Tko je zadnji iskoristio kod (email iz registracije). */
    lastUsedBy: text("last_used_by"),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    check("nr_invite_codes_uses_range", sql`${t.uses} >= 0 and ${t.uses} <= ${t.maxUses}`),
    check("nr_invite_codes_max_uses_min", sql`${t.maxUses} >= 1`),
    index("nr_invite_created").on(t.createdAt),
  ]
);

// --- Tenancy ---

export const organizations = pgTable("nr_organizations", {
  id: id(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  industry: text("industry"),
  timezone: text("timezone").notNull().default("Europe/Zagreb"),
  phone: text("phone"),
  /**
   * Kontakt klijenta kojeg NOVO vodi kao uslugu (klijent nema prijavu). Tjedni izvještaj
   * ide na contactEmail; internalNote vidi samo NOVO tim u /admin/recenzije.
   */
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  internalNote: text("internal_note"),
  isDemo: boolean("is_demo").notNull().default(false),
  /** Where tracking links redirect. Set manually or from the Google connection. */
  googleReviewUrl: text("google_review_url"),
  googlePlaceId: text("google_place_id"),
  googleRating: doublePrecision("google_rating"),
  googleReviewCount: integer("google_review_count"),
  googleSyncedAt: timestamp("google_synced_at", { withTimezone: true }),
  /** SMS Gateway for Android (vlastiti mobitel tvrtke) — vjerodajnice su šifrirane (lib/recenzije/crypto). */
  smsGatewayUser: text("sms_gateway_user"),
  smsGatewayPassEnc: text("sms_gateway_pass_enc"),
  smsGatewaySigningKeyEnc: text("sms_gateway_signing_key_enc"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const organizationMembers = pgTable(
  "nr_organization_members",
  {
    id: id(),
    organizationId: orgRef(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: memberRole("role").notNull().default("MEMBER"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("nr_org_member_unique").on(t.organizationId, t.userId), index("nr_org_member_user").on(t.userId)]
);

/** Google Business Profile OAuth connection. Tokens are AES-256-GCM encrypted (lib/crypto.ts). */
export const googleConnections = pgTable("nr_google_connections", {
  id: id(),
  organizationId: orgRef().unique(),
  googleEmail: text("google_email"),
  accessTokenEnc: text("access_token_enc"),
  refreshTokenEnc: text("refresh_token_enc"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  scope: text("scope"),
  accountName: text("account_name"),
  locationName: text("location_name"),
  locationTitle: text("location_title"),
  status: text("status").notNull().default("PENDING"),
  lastError: text("last_error"),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// --- Clients ---

export const clients = pgTable(
  "nr_clients",
  {
    id: id(),
    organizationId: orgRef(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull().default(""),
    phone: text("phone").notNull(),
    email: text("email"),
    notes: text("notes"),
    reviewStatus: reviewStatus("review_status").notNull().default("NOT_CONTACTED"),
    smsOptOut: boolean("sms_opt_out").notNull().default(false),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    nextFollowUpAt: timestamp("next_follow_up_at", { withTimezone: true }),
    reviewReceivedAt: timestamp("review_received_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("nr_client_org_phone").on(t.organizationId, t.phone),
    index("nr_client_org_status").on(t.organizationId, t.reviewStatus),
    index("nr_client_org_created").on(t.organizationId, t.createdAt),
  ]
);

export const services = pgTable(
  "nr_services",
  {
    id: id(),
    organizationId: orgRef(),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    technician: text("technician"),
    serviceDate: timestamp("service_date", { withTimezone: true }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    notes: text("notes"),
    createdAt: createdAt(),
  },
  (t) => [index("nr_service_org_date").on(t.organizationId, t.serviceDate), index("nr_service_client").on(t.clientId)]
);

// --- Messaging ---

export const campaigns = pgTable(
  "nr_campaigns",
  {
    id: id(),
    organizationId: orgRef(),
    name: text("name").notNull(),
    status: campaignStatus("status").notNull().default("DRAFT"),
    /** LAUNCH: one-time send to the audience. SERVICE_COMPLETED: also enrolls every new completed job that matches. */
    trigger: text("trigger").$type<"LAUNCH" | "SERVICE_COMPLETED">().notNull().default("LAUNCH"),
    /** { serviceWithinDays: number; statuses: ReviewStatus[]; service?: string } */
    audience: jsonb("audience").$type<CampaignAudience>().notNull(),
    messageBody: text("message_body").notNull(),
    delayMinutes: integer("delay_minutes").notNull().default(0),
    followUpEnabled: boolean("follow_up_enabled").notNull().default(true),
    followUpAfterHours: integer("follow_up_after_hours").notNull().default(48),
    followUpBody: text("follow_up_body"),
    launchedAt: timestamp("launched_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("nr_campaign_org").on(t.organizationId)]
);

export const messages = pgTable(
  "nr_messages",
  {
    id: id(),
    organizationId: orgRef(),
    clientId: text("client_id").references(() => clients.id, { onDelete: "set null" }),
    direction: messageDirection("direction").notNull().default("OUTBOUND"),
    kind: messageKind("kind").notNull().default("MANUAL"),
    toNumber: text("to_number").notNull(),
    fromNumber: text("from_number"),
    body: text("body").notNull(),
    status: messageStatus("status").notNull().default("QUEUED"),
    providerSid: text("provider_sid").unique(),
    errorMessage: text("error_message"),
    campaignId: text("campaign_id").references(() => campaigns.id, { onDelete: "set null" }),
    automationRunId: text("automation_run_id"),
    trackingLinkId: text("tracking_link_id"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("nr_message_org_created").on(t.organizationId, t.createdAt), index("nr_message_client").on(t.clientId)]
);

export const messageTemplates = pgTable(
  "nr_message_templates",
  {
    id: id(),
    organizationId: orgRef(),
    name: text("name").notNull(),
    kind: messageKind("kind").notNull().default("REVIEW_REQUEST"),
    body: text("body").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("nr_template_org").on(t.organizationId)]
);

/** `/r/{token}` → records the click → redirects to the organization's Google review URL. */
export const trackingLinks = pgTable(
  "nr_tracking_links",
  {
    id: id(),
    organizationId: orgRef(),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    destinationUrl: text("destination_url").notNull(),
    clickCount: integer("click_count").notNull().default(0),
    firstClickedAt: timestamp("first_clicked_at", { withTimezone: true }),
    lastClickedAt: timestamp("last_clicked_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("nr_link_org_created").on(t.organizationId, t.createdAt)]
);

export const linkClicks = pgTable(
  "nr_link_clicks",
  {
    id: id(),
    linkId: text("link_id")
      .notNull()
      .references(() => trackingLinks.id, { onDelete: "cascade" }),
    userAgent: text("user_agent"),
    ipHash: text("ip_hash"),
    createdAt: createdAt(),
  },
  (t) => [index("nr_click_link").on(t.linkId)]
);

// --- Reviews ---

export const reviews = pgTable(
  "nr_reviews",
  {
    id: id(),
    organizationId: orgRef(),
    source: reviewSource("source").notNull().default("GOOGLE"),
    externalId: text("external_id"),
    reviewerName: text("reviewer_name").notNull(),
    rating: integer("rating").notNull(),
    comment: text("comment"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }).notNull(),
    replyText: text("reply_text"),
    repliedAt: timestamp("replied_at", { withTimezone: true }),
    clientId: text("client_id").references(() => clients.id, { onDelete: "set null" }),
    match: reviewMatch("match").notNull().default("NONE"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("nr_review_org_external").on(t.organizationId, t.externalId),
    index("nr_review_org_date").on(t.organizationId, t.reviewedAt),
  ]
);

// --- Automations ---

export const automations = pgTable(
  "nr_automations",
  {
    id: id(),
    organizationId: orgRef(),
    name: text("name").notNull(),
    description: text("description"),
    trigger: automationTrigger("trigger").notNull().default("SERVICE_COMPLETED"),
    enabled: boolean("enabled").notNull().default(true),
    steps: jsonb("steps").$type<import("@/lib/recenzije/automation/types").AutomationStep[]>().notNull(),
    templateKey: text("template_key"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("nr_automation_org_trigger").on(t.organizationId, t.trigger, t.enabled)]
);

export const automationRuns = pgTable(
  "nr_automation_runs",
  {
    id: id(),
    organizationId: orgRef(),
    automationId: text("automation_id").references(() => automations.id, { onDelete: "cascade" }),
    campaignId: text("campaign_id").references(() => campaigns.id, { onDelete: "cascade" }),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    serviceId: text("service_id").references(() => services.id, { onDelete: "set null" }),
    status: runStatus("status").notNull().default("RUNNING"),
    stepIndex: integer("step_index").notNull().default(0),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }).notNull().defaultNow(),
    log: jsonb("log").$type<RunLogEntry[]>().notNull().default(sql`'[]'::jsonb`),
    error: text("error"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [index("nr_run_due").on(t.status, t.nextRunAt), index("nr_run_org_started").on(t.organizationId, t.startedAt)]
);

export const activityEvents = pgTable(
  "nr_activity_events",
  {
    id: id(),
    organizationId: orgRef(),
    clientId: text("client_id").references(() => clients.id, { onDelete: "cascade" }),
    type: text("type").$type<ActivityType>().notNull(),
    title: text("title").notNull(),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [index("nr_activity_org_created").on(t.organizationId, t.createdAt), index("nr_activity_client").on(t.clientId)]
);

// --- Billing ---

/** Plans live in the database (seeded), so prices/limits change without a deploy. */
export const plans = pgTable("nr_plans", {
  id: id(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  priceMonthlyCents: integer("price_monthly_cents").notNull(),
  currency: text("currency").notNull().default("eur"),
  stripePriceId: text("stripe_price_id"),
  smsMonthlyLimit: integer("sms_monthly_limit").notNull(),
  locationLimit: integer("location_limit").notNull().default(1),
  features: jsonb("features").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  position: integer("position").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const subscriptions = pgTable("nr_subscriptions", {
  id: id(),
  organizationId: orgRef().unique(),
  planKey: text("plan_key").notNull().default("trial"),
  status: text("status").notNull().default("trialing"),
  stripeCustomerId: text("stripe_customer_id").unique(),
  stripeSubscriptionId: text("stripe_subscription_id").unique(),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
  /**
   * Besplatno razdoblje koje je NOVO tim odobrio iz admina. Kad je postavljeno, pretplata je
   * "active" na odabranom paketu do ove točke (isto kao currentPeriodEnd), a slanje je
   * ograničeno SMS limitom tog paketa. Plaćena aktivacija ga briše (null).
   */
  freePeriodEndsAt: timestamp("free_period_ends_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// --- Types ---

export type ReviewStatus = (typeof reviewStatus.enumValues)[number];
export type MessageKind = (typeof messageKind.enumValues)[number];
export type MessageStatus = (typeof messageStatus.enumValues)[number];
export type CampaignAudience = { serviceWithinDays: number; statuses: ReviewStatus[]; service?: string };
export type RunLogEntry = { at: string; stepIndex: number; type: string; message: string };
export type ActivityType =
  | "client_created"
  | "service_completed"
  | "request_sent"
  | "link_clicked"
  | "review_received"
  | "follow_up_scheduled"
  | "follow_up_sent"
  | "message_failed"
  | "reply_received"
  | "opt_out"
  | "automation_completed"
  | "weekly_report_sent";

export type User = typeof users.$inferSelect;
export type InviteCode = typeof inviteCodes.$inferSelect;
export type Organization = typeof organizations.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type Service = typeof services.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type Campaign = typeof campaigns.$inferSelect;
export type Automation = typeof automations.$inferSelect;
export type AutomationRun = typeof automationRuns.$inferSelect;
export type ActivityEvent = typeof activityEvents.$inferSelect;
export type Plan = typeof plans.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type MessageTemplate = typeof messageTemplates.$inferSelect;

// --- Relations ---

export const clientRelations = relations(clients, ({ many, one }) => ({
  organization: one(organizations, { fields: [clients.organizationId], references: [organizations.id] }),
  services: many(services),
  messages: many(messages),
}));
export const serviceRelations = relations(services, ({ one }) => ({
  client: one(clients, { fields: [services.clientId], references: [clients.id] }),
}));
export const messageRelations = relations(messages, ({ one }) => ({
  client: one(clients, { fields: [messages.clientId], references: [clients.id] }),
}));
