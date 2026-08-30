CREATE TABLE `system_checks` (
	`check_key` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`checked_at` integer NOT NULL,
	`safe_detail_code` text,
	`last_alert_reason` text,
	`last_alert_at` integer,
	CONSTRAINT "system_checks_status_check" CHECK("system_checks"."status" IN ('ok', 'warning', 'failed')),
	CONSTRAINT "system_checks_alert_pair_check" CHECK(("system_checks"."last_alert_reason" IS NULL) = ("system_checks"."last_alert_at" IS NULL))
) STRICT;
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_retailers` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`lifecycle` text NOT NULL,
	`latest_run_status` text,
	`latest_run_at` integer,
	`latest_successful_run_at` integer,
	`latest_error_code` text,
	`last_alert_reason` text,
	`last_alert_at` integer,
	`lease_token` text,
	`lease_expires_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "retailers_id_uuidv7_check" CHECK(length("__new_retailers"."id") = 36 AND "__new_retailers"."id" = lower("__new_retailers"."id") AND "__new_retailers"."id" GLOB '????????-????-7???-[89ab]???-????????????' AND replace("__new_retailers"."id", '-', '') NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT "retailers_lifecycle_check" CHECK("__new_retailers"."lifecycle" IN ('inactive', 'active', 'paused')),
	CONSTRAINT "retailers_latest_run_status_check" CHECK("__new_retailers"."latest_run_status" IS NULL OR "__new_retailers"."latest_run_status" IN ('running', 'complete', 'failed', 'skipped')),
	CONSTRAINT "retailers_lease_pair_check" CHECK(("__new_retailers"."lease_token" IS NULL) = ("__new_retailers"."lease_expires_at" IS NULL)),
	CONSTRAINT "retailers_alert_pair_check" CHECK(("__new_retailers"."last_alert_reason" IS NULL) = ("__new_retailers"."last_alert_at" IS NULL))
) STRICT;
--> statement-breakpoint
INSERT INTO `__new_retailers`("id", "slug", "name", "lifecycle", "latest_run_status", "latest_run_at", "latest_successful_run_at", "latest_error_code", "last_alert_reason", "last_alert_at", "lease_token", "lease_expires_at", "created_at", "updated_at") SELECT "id", "slug", "name", "lifecycle", "latest_run_status", "latest_run_at", "latest_successful_run_at", "latest_error_code", NULL, NULL, "lease_token", "lease_expires_at", "created_at", "updated_at" FROM `retailers`;--> statement-breakpoint
DROP TABLE `retailers`;--> statement-breakpoint
ALTER TABLE `__new_retailers` RENAME TO `retailers`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `retailers_slug_unique` ON `retailers` (`slug`);--> statement-breakpoint
CREATE INDEX `retailers_lifecycle_name_idx` ON `retailers` (`lifecycle`,`name`);
