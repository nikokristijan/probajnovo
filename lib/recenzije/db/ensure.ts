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
export const SCHEMA_VERSION = 1;

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
