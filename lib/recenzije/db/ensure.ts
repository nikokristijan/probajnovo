import "server-only";
import { sql } from "drizzle-orm";
import { db } from "./index";

/**
 * Tablice NOVO Recenzija (prefiks nr_) nastaju same pri prvom korištenju,
 * istim obrascem kao ostatak probajnova (CREATE ... IF NOT EXISTS, bez ručne
 * migracije). Svaka naredba je idempotentna, a cijeli blok drži advisory lock
 * da se dva serverless pokretanja ne sudare. Kad se shema promijeni:
 * dodaj ALTER TABLE ... ADD COLUMN IF NOT EXISTS na kraj i povećaj SCHEMA_VERSION.
 */
export const SCHEMA_VERSION = 4;

const DDL = `
CREATE TABLE IF NOT EXISTS "nr_meta" ("key" text PRIMARY KEY NOT NULL, "value" text NOT NULL);
DO $$ BEGIN CREATE TYPE "public"."nr_automation_trigger" AS ENUM('SERVICE_COMPLETED', 'CLIENT_CREATED', 'MANUAL'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "public"."nr_campaign_status" AS ENUM('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "public"."nr_member_role" AS ENUM('OWNER', 'ADMIN', 'MEMBER'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "public"."nr_message_direction" AS ENUM('OUTBOUND', 'INBOUND'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "public"."nr_message_kind" AS ENUM('REVIEW_REQUEST', 'FOLLOW_UP', 'CAMPAIGN', 'MANUAL', 'TEST', 'REPLY'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "public"."nr_message_status" AS ENUM('QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'UNDELIVERED', 'RECEIVED'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "public"."nr_review_match" AS ENUM('NONE', 'NAME_MATCH', 'MANUAL'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "public"."nr_review_source" AS ENUM('GOOGLE', 'MANUAL'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "public"."nr_review_status" AS ENUM('NOT_CONTACTED', 'REQUEST_SENT', 'CLICKED', 'FOLLOW_UP_SCHEDULED', 'REVIEW_RECEIVED', 'COMPLETED'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "public"."nr_run_status" AS ENUM('RUNNING', 'WAITING', 'COMPLETED', 'FAILED', 'CANCELLED'); EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE TABLE IF NOT EXISTS "nr_activity_events" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"client_id" text,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "nr_automation_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"automation_id" text,
	"campaign_id" text,
	"client_id" text NOT NULL,
	"service_id" text,
	"status" "nr_run_status" DEFAULT 'RUNNING' NOT NULL,
	"step_index" integer DEFAULT 0 NOT NULL,
	"next_run_at" timestamp with time zone DEFAULT now() NOT NULL,
	"log" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
CREATE TABLE IF NOT EXISTS "nr_automations" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"trigger" "nr_automation_trigger" DEFAULT 'SERVICE_COMPLETED' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"steps" jsonb NOT NULL,
	"template_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "nr_campaigns" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"status" "nr_campaign_status" DEFAULT 'DRAFT' NOT NULL,
	"trigger" text DEFAULT 'LAUNCH' NOT NULL,
	"audience" jsonb NOT NULL,
	"message_body" text NOT NULL,
	"delay_minutes" integer DEFAULT 0 NOT NULL,
	"follow_up_enabled" boolean DEFAULT true NOT NULL,
	"follow_up_after_hours" integer DEFAULT 48 NOT NULL,
	"follow_up_body" text,
	"launched_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "nr_clients" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text DEFAULT '' NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"notes" text,
	"review_status" "nr_review_status" DEFAULT 'NOT_CONTACTED' NOT NULL,
	"sms_opt_out" boolean DEFAULT false NOT NULL,
	"last_message_at" timestamp with time zone,
	"next_follow_up_at" timestamp with time zone,
	"review_received_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "nr_google_connections" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"google_email" text,
	"access_token_enc" text,
	"refresh_token_enc" text,
	"expires_at" timestamp with time zone,
	"scope" text,
	"account_name" text,
	"location_name" text,
	"location_title" text,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"last_error" text,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "nr_google_connections_organization_id_unique" UNIQUE("organization_id")
);
CREATE TABLE IF NOT EXISTS "nr_invite_codes" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"label" text,
	"max_uses" integer DEFAULT 1 NOT NULL,
	"uses" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_by" text,
	"last_used_by" text,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "nr_invite_codes_code_unique" UNIQUE("code"),
	CONSTRAINT "nr_invite_codes_uses_range" CHECK ("uses" >= 0 AND "uses" <= "max_uses"),
	CONSTRAINT "nr_invite_codes_max_uses_min" CHECK ("max_uses" >= 1)
);
CREATE TABLE IF NOT EXISTS "nr_link_clicks" (
	"id" text PRIMARY KEY NOT NULL,
	"link_id" text NOT NULL,
	"user_agent" text,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "nr_message_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"kind" "nr_message_kind" DEFAULT 'REVIEW_REQUEST' NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "nr_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"client_id" text,
	"direction" "nr_message_direction" DEFAULT 'OUTBOUND' NOT NULL,
	"kind" "nr_message_kind" DEFAULT 'MANUAL' NOT NULL,
	"to_number" text NOT NULL,
	"from_number" text,
	"body" text NOT NULL,
	"status" "nr_message_status" DEFAULT 'QUEUED' NOT NULL,
	"provider_sid" text,
	"error_message" text,
	"campaign_id" text,
	"automation_run_id" text,
	"tracking_link_id" text,
	"sent_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "nr_messages_provider_sid_unique" UNIQUE("provider_sid")
);
CREATE TABLE IF NOT EXISTS "nr_organization_members" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" "nr_member_role" DEFAULT 'MEMBER' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "nr_organizations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"industry" text,
	"timezone" text DEFAULT 'Europe/Zagreb' NOT NULL,
	"phone" text,
	"is_demo" boolean DEFAULT false NOT NULL,
	"google_review_url" text,
	"google_place_id" text,
	"google_rating" double precision,
	"google_review_count" integer,
	"google_synced_at" timestamp with time zone,
	"sms_gateway_user" text,
	"sms_gateway_pass_enc" text,
	"sms_gateway_signing_key_enc" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "nr_organizations_slug_unique" UNIQUE("slug")
);
CREATE TABLE IF NOT EXISTS "nr_password_reset_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "nr_password_reset_tokens_token_hash_unique" UNIQUE("token_hash")
);
CREATE TABLE IF NOT EXISTS "nr_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price_monthly_cents" integer NOT NULL,
	"currency" text DEFAULT 'eur' NOT NULL,
	"stripe_price_id" text,
	"sms_monthly_limit" integer NOT NULL,
	"location_limit" integer DEFAULT 1 NOT NULL,
	"features" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "nr_plans_key_unique" UNIQUE("key")
);
CREATE TABLE IF NOT EXISTS "nr_reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"source" "nr_review_source" DEFAULT 'GOOGLE' NOT NULL,
	"external_id" text,
	"reviewer_name" text NOT NULL,
	"rating" integer NOT NULL,
	"comment" text,
	"reviewed_at" timestamp with time zone NOT NULL,
	"reply_text" text,
	"replied_at" timestamp with time zone,
	"client_id" text,
	"match" "nr_review_match" DEFAULT 'NONE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "nr_services" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"client_id" text NOT NULL,
	"name" text NOT NULL,
	"technician" text,
	"service_date" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "nr_subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"plan_key" text DEFAULT 'trial' NOT NULL,
	"status" text DEFAULT 'trialing' NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"trial_ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "nr_subscriptions_organization_id_unique" UNIQUE("organization_id"),
	CONSTRAINT "nr_subscriptions_stripe_customer_id_unique" UNIQUE("stripe_customer_id"),
	CONSTRAINT "nr_subscriptions_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);
CREATE TABLE IF NOT EXISTS "nr_tracking_links" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"client_id" text NOT NULL,
	"token" text NOT NULL,
	"destination_url" text NOT NULL,
	"click_count" integer DEFAULT 0 NOT NULL,
	"first_clicked_at" timestamp with time zone,
	"last_clicked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "nr_tracking_links_token_unique" UNIQUE("token")
);
CREATE TABLE IF NOT EXISTS "nr_users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"email_verified" timestamp with time zone,
	"image" text,
	"password_hash" text,
	"google_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "nr_users_email_unique" UNIQUE("email"),
	CONSTRAINT "nr_users_google_id_unique" UNIQUE("google_id")
);
DO $$ BEGIN ALTER TABLE "nr_activity_events" ADD CONSTRAINT "nr_activity_events_organization_id_nr_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."nr_organizations"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "nr_activity_events" ADD CONSTRAINT "nr_activity_events_client_id_nr_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."nr_clients"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "nr_automation_runs" ADD CONSTRAINT "nr_automation_runs_organization_id_nr_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."nr_organizations"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "nr_automation_runs" ADD CONSTRAINT "nr_automation_runs_automation_id_nr_automations_id_fk" FOREIGN KEY ("automation_id") REFERENCES "public"."nr_automations"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "nr_automation_runs" ADD CONSTRAINT "nr_automation_runs_campaign_id_nr_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."nr_campaigns"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "nr_automation_runs" ADD CONSTRAINT "nr_automation_runs_client_id_nr_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."nr_clients"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "nr_automation_runs" ADD CONSTRAINT "nr_automation_runs_service_id_nr_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."nr_services"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "nr_automations" ADD CONSTRAINT "nr_automations_organization_id_nr_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."nr_organizations"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "nr_campaigns" ADD CONSTRAINT "nr_campaigns_organization_id_nr_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."nr_organizations"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "nr_clients" ADD CONSTRAINT "nr_clients_organization_id_nr_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."nr_organizations"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "nr_google_connections" ADD CONSTRAINT "nr_google_connections_organization_id_nr_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."nr_organizations"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "nr_link_clicks" ADD CONSTRAINT "nr_link_clicks_link_id_nr_tracking_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."nr_tracking_links"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "nr_message_templates" ADD CONSTRAINT "nr_message_templates_organization_id_nr_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."nr_organizations"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "nr_messages" ADD CONSTRAINT "nr_messages_organization_id_nr_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."nr_organizations"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "nr_messages" ADD CONSTRAINT "nr_messages_client_id_nr_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."nr_clients"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "nr_messages" ADD CONSTRAINT "nr_messages_campaign_id_nr_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."nr_campaigns"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "nr_organization_members" ADD CONSTRAINT "nr_organization_members_organization_id_nr_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."nr_organizations"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "nr_organization_members" ADD CONSTRAINT "nr_organization_members_user_id_nr_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."nr_users"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "nr_password_reset_tokens" ADD CONSTRAINT "nr_password_reset_tokens_user_id_nr_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."nr_users"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "nr_reviews" ADD CONSTRAINT "nr_reviews_organization_id_nr_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."nr_organizations"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "nr_reviews" ADD CONSTRAINT "nr_reviews_client_id_nr_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."nr_clients"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "nr_services" ADD CONSTRAINT "nr_services_organization_id_nr_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."nr_organizations"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "nr_services" ADD CONSTRAINT "nr_services_client_id_nr_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."nr_clients"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "nr_subscriptions" ADD CONSTRAINT "nr_subscriptions_organization_id_nr_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."nr_organizations"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "nr_tracking_links" ADD CONSTRAINT "nr_tracking_links_organization_id_nr_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."nr_organizations"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "nr_tracking_links" ADD CONSTRAINT "nr_tracking_links_client_id_nr_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."nr_clients"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS "nr_activity_org_created" ON "nr_activity_events" USING btree ("organization_id","created_at");
CREATE INDEX IF NOT EXISTS "nr_activity_client" ON "nr_activity_events" USING btree ("client_id");
CREATE INDEX IF NOT EXISTS "nr_run_due" ON "nr_automation_runs" USING btree ("status","next_run_at");
CREATE INDEX IF NOT EXISTS "nr_run_org_started" ON "nr_automation_runs" USING btree ("organization_id","started_at");
CREATE INDEX IF NOT EXISTS "nr_automation_org_trigger" ON "nr_automations" USING btree ("organization_id","trigger","enabled");
CREATE INDEX IF NOT EXISTS "nr_campaign_org" ON "nr_campaigns" USING btree ("organization_id");
CREATE UNIQUE INDEX IF NOT EXISTS "nr_client_org_phone" ON "nr_clients" USING btree ("organization_id","phone");
CREATE INDEX IF NOT EXISTS "nr_client_org_status" ON "nr_clients" USING btree ("organization_id","review_status");
CREATE INDEX IF NOT EXISTS "nr_client_org_created" ON "nr_clients" USING btree ("organization_id","created_at");
CREATE INDEX IF NOT EXISTS "nr_invite_created" ON "nr_invite_codes" USING btree ("created_at");
CREATE INDEX IF NOT EXISTS "nr_click_link" ON "nr_link_clicks" USING btree ("link_id");
CREATE INDEX IF NOT EXISTS "nr_template_org" ON "nr_message_templates" USING btree ("organization_id");
CREATE INDEX IF NOT EXISTS "nr_message_org_created" ON "nr_messages" USING btree ("organization_id","created_at");
CREATE INDEX IF NOT EXISTS "nr_message_client" ON "nr_messages" USING btree ("client_id");
CREATE UNIQUE INDEX IF NOT EXISTS "nr_org_member_unique" ON "nr_organization_members" USING btree ("organization_id","user_id");
CREATE INDEX IF NOT EXISTS "nr_org_member_user" ON "nr_organization_members" USING btree ("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "nr_review_org_external" ON "nr_reviews" USING btree ("organization_id","external_id");
CREATE INDEX IF NOT EXISTS "nr_review_org_date" ON "nr_reviews" USING btree ("organization_id","reviewed_at");
CREATE INDEX IF NOT EXISTS "nr_service_org_date" ON "nr_services" USING btree ("organization_id","service_date");
CREATE INDEX IF NOT EXISTS "nr_service_client" ON "nr_services" USING btree ("client_id");
CREATE INDEX IF NOT EXISTS "nr_link_org_created" ON "nr_tracking_links" USING btree ("organization_id","created_at");
ALTER TABLE "nr_organizations" ADD COLUMN IF NOT EXISTS "contact_name" text;
ALTER TABLE "nr_organizations" ADD COLUMN IF NOT EXISTS "contact_email" text;
ALTER TABLE "nr_organizations" ADD COLUMN IF NOT EXISTS "contact_phone" text;
ALTER TABLE "nr_organizations" ADD COLUMN IF NOT EXISTS "internal_note" text;
ALTER TABLE "nr_subscriptions" ADD COLUMN IF NOT EXISTS "free_period_ends_at" timestamp with time zone;
ALTER TABLE "nr_organizations" ADD COLUMN IF NOT EXISTS "is_venue" boolean DEFAULT false NOT NULL;
ALTER TABLE "nr_clients" ADD COLUMN IF NOT EXISTS "source" text;
CREATE TABLE IF NOT EXISTS "nr_menus" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"slug" text NOT NULL,
	"title" text DEFAULT 'Jelovnik' NOT NULL,
	"intro" text,
	"intro_en" text,
	"external_url" text,
	"allow_skip" boolean DEFAULT false NOT NULL,
	"delay_minutes" integer DEFAULT 90 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "nr_menus_organization_id_unique" UNIQUE("organization_id"),
	CONSTRAINT "nr_menus_slug_unique" UNIQUE("slug"),
	CONSTRAINT "nr_menus_delay_range" CHECK ("delay_minutes" >= 60 AND "delay_minutes" <= 240)
);
CREATE TABLE IF NOT EXISTS "nr_menu_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"menu_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"name_en" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "nr_menu_items" (
	"id" text PRIMARY KEY NOT NULL,
	"menu_id" text NOT NULL,
	"category_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"name_en" text,
	"description" text,
	"description_en" text,
	"price_cents" integer DEFAULT 0 NOT NULL,
	"allergens" text,
	"available" boolean DEFAULT true NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "nr_menu_items_price_min" CHECK ("price_cents" >= 0)
);
CREATE TABLE IF NOT EXISTS "nr_menu_guests" (
	"id" text PRIMARY KEY NOT NULL,
	"menu_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"client_id" text,
	"phone" text NOT NULL,
	"table_label" text,
	"consent_at" timestamp with time zone NOT NULL,
	"consent_version" text NOT NULL,
	"consent_text" text NOT NULL,
	"ip_hash" text,
	"user_agent" text,
	"outcome" text DEFAULT 'scheduled' NOT NULL,
	"run_id" text,
	"send_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN ALTER TABLE "nr_menus" ADD CONSTRAINT "nr_menus_organization_id_nr_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."nr_organizations"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "nr_menu_categories" ADD CONSTRAINT "nr_menu_categories_menu_id_nr_menus_id_fk" FOREIGN KEY ("menu_id") REFERENCES "public"."nr_menus"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "nr_menu_categories" ADD CONSTRAINT "nr_menu_categories_organization_id_nr_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."nr_organizations"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "nr_menu_items" ADD CONSTRAINT "nr_menu_items_menu_id_nr_menus_id_fk" FOREIGN KEY ("menu_id") REFERENCES "public"."nr_menus"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "nr_menu_items" ADD CONSTRAINT "nr_menu_items_category_id_nr_menu_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."nr_menu_categories"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "nr_menu_items" ADD CONSTRAINT "nr_menu_items_organization_id_nr_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."nr_organizations"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "nr_menu_guests" ADD CONSTRAINT "nr_menu_guests_menu_id_nr_menus_id_fk" FOREIGN KEY ("menu_id") REFERENCES "public"."nr_menus"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "nr_menu_guests" ADD CONSTRAINT "nr_menu_guests_organization_id_nr_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."nr_organizations"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "nr_menu_guests" ADD CONSTRAINT "nr_menu_guests_client_id_nr_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."nr_clients"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "nr_menu_guests" ADD CONSTRAINT "nr_menu_guests_run_id_nr_automation_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."nr_automation_runs"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS "nr_menu_cat_menu_pos" ON "nr_menu_categories" USING btree ("menu_id","position");
CREATE INDEX IF NOT EXISTS "nr_menu_cat_org" ON "nr_menu_categories" USING btree ("organization_id");
CREATE INDEX IF NOT EXISTS "nr_menu_item_cat_pos" ON "nr_menu_items" USING btree ("category_id","position");
CREATE INDEX IF NOT EXISTS "nr_menu_item_menu" ON "nr_menu_items" USING btree ("menu_id");
CREATE INDEX IF NOT EXISTS "nr_menu_item_org" ON "nr_menu_items" USING btree ("organization_id");
CREATE INDEX IF NOT EXISTS "nr_menu_guest_menu_created" ON "nr_menu_guests" USING btree ("menu_id","created_at");
CREATE INDEX IF NOT EXISTS "nr_menu_guest_phone_created" ON "nr_menu_guests" USING btree ("phone","created_at");
CREATE INDEX IF NOT EXISTS "nr_menu_guest_ip_created" ON "nr_menu_guests" USING btree ("ip_hash","created_at");
CREATE INDEX IF NOT EXISTS "nr_menu_guest_created" ON "nr_menu_guests" USING btree ("created_at");
CREATE INDEX IF NOT EXISTS "nr_client_source_created" ON "nr_clients" USING btree ("source","created_at");
`;

let ready: Promise<void> | null = null;

async function run() {
  const current = await db
    .execute<{ value: string }>(sql`select value from nr_meta where key = 'schema_version'`)
    .then((r) => Array.from(r)[0]?.value)
    .catch(() => undefined);
  if (current !== String(SCHEMA_VERSION)) {
    await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(7316230)`);
      await tx.execute(sql.raw(DDL));
      await tx.execute(
        sql`insert into nr_meta (key, value) values ('schema_version', ${String(SCHEMA_VERSION)})
            on conflict (key) do update set value = excluded.value`
      );
    });
  }
  const { seedPlans, seedDemo } = await import("./seed");
  await seedPlans();
  await seedDemo();
}

/** Pozovi prije prvog upita (stranice, akcije, API rute). Jednom po procesu. */
export function ensureReviewsDb(): Promise<void> {
  if (!ready) {
    ready = run().catch((e) => {
      ready = null;
      throw e;
    });
  }
  return ready;
}
