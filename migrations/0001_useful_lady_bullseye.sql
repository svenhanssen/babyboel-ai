DROP TRIGGER `offers_validate_total_units_insert`;--> statement-breakpoint
DROP TRIGGER `offers_validate_total_units_update`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_listings` (
	`id` text PRIMARY KEY NOT NULL,
	`retailer_id` text NOT NULL,
	`package_id` text,
	`retailer_sku` text NOT NULL,
	`channel` text NOT NULL,
	`seller_retailer_id` text NOT NULL,
	`source_title` text NOT NULL,
	`outbound_destination` text NOT NULL,
	`availability` text NOT NULL,
	`match_status` text NOT NULL,
	`match_method` text,
	`match_fingerprint` text,
	`automatic_reuse_blocked` integer DEFAULT false NOT NULL,
	`last_match_decision_at` integer,
	`latest_observation_id` text,
	`confirmed_at` integer,
	`miss_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`retailer_id`) REFERENCES `retailers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`package_id`) REFERENCES `packages`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`seller_retailer_id`) REFERENCES `retailers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`latest_observation_id`) REFERENCES `source_observations`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "listings_id_uuidv7_check" CHECK(length("__new_listings"."id") = 36 AND "__new_listings"."id" = lower("__new_listings"."id") AND "__new_listings"."id" GLOB '????????-????-7???-[89ab]???-????????????' AND replace("__new_listings"."id", '-', '') NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT "listings_miss_count_check" CHECK("__new_listings"."miss_count" >= 0),
	CONSTRAINT "listings_availability_check" CHECK("__new_listings"."availability" IN ('available', 'unavailable', 'unknown')),
	CONSTRAINT "listings_channel_check" CHECK("__new_listings"."channel" = 'nationwide_online'),
	CONSTRAINT "listings_seller_check" CHECK("__new_listings"."seller_retailer_id" = "__new_listings"."retailer_id"),
	CONSTRAINT "listings_match_status_check" CHECK("__new_listings"."match_status" IN ('unmatched', 'matched', 'review', 'out_of_scope')),
	CONSTRAINT "listings_match_method_check" CHECK("__new_listings"."match_method" IS NULL OR "__new_listings"."match_method" IN ('approved_listing', 'verified_gtin', 'manual')),
	CONSTRAINT "listings_automatic_reuse_blocked_check" CHECK("__new_listings"."automatic_reuse_blocked" IN (0, 1)),
	CONSTRAINT "listings_match_coherence_check" CHECK(("__new_listings"."match_status" = 'matched' AND "__new_listings"."package_id" IS NOT NULL AND "__new_listings"."match_method" IS NOT NULL AND "__new_listings"."last_match_decision_at" IS NOT NULL) OR ("__new_listings"."match_status" <> 'matched' AND "__new_listings"."match_method" IS NULL))
) STRICT;
--> statement-breakpoint
INSERT INTO `__new_listings`("id", "retailer_id", "package_id", "retailer_sku", "channel", "seller_retailer_id", "source_title", "outbound_destination", "availability", "match_status", "match_method", "match_fingerprint", "automatic_reuse_blocked", "last_match_decision_at", "latest_observation_id", "confirmed_at", "miss_count", "created_at", "updated_at")
SELECT "id", "retailer_id", "package_id", "retailer_sku", "channel", "seller_retailer_id", "source_title", "outbound_destination", "availability", "match_status", CASE WHEN "match_method" = 'approved_sku' THEN 'approved_listing' ELSE "match_method" END, NULL, false, CASE WHEN "match_status" = 'matched' THEN coalesce("confirmed_at", "updated_at") ELSE NULL END, "latest_observation_id", "confirmed_at", "miss_count", "created_at", "updated_at" FROM `listings`;--> statement-breakpoint
DROP TABLE `listings`;--> statement-breakpoint
ALTER TABLE `__new_listings` RENAME TO `listings`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `listings_identity_unique` ON `listings` (`retailer_id`,`channel`,`retailer_sku`);--> statement-breakpoint
CREATE INDEX `listings_package_status_idx` ON `listings` (`package_id`,`match_status`,`availability`);--> statement-breakpoint
CREATE TRIGGER `offers_validate_total_units_insert`
BEFORE INSERT ON `offers`
WHEN (
	SELECT `listings`.`package_id`
	FROM `listings`
	WHERE `listings`.`id` = NEW.`listing_id`
) IS NULL OR NEW.`total_units` <> NEW.`required_package_count` * (
	SELECT `packages`.`unit_count`
	FROM `listings`
	JOIN `packages` ON `packages`.`id` = `listings`.`package_id`
	WHERE `listings`.`id` = NEW.`listing_id`
)
BEGIN
	SELECT RAISE(ABORT, 'offer total units do not match its Package quantity');
END;--> statement-breakpoint
CREATE TRIGGER `offers_validate_total_units_update`
BEFORE UPDATE OF `listing_id`, `required_package_count`, `total_units` ON `offers`
WHEN (
	SELECT `listings`.`package_id`
	FROM `listings`
	WHERE `listings`.`id` = NEW.`listing_id`
) IS NULL OR NEW.`total_units` <> NEW.`required_package_count` * (
	SELECT `packages`.`unit_count`
	FROM `listings`
	JOIN `packages` ON `packages`.`id` = `listings`.`package_id`
	WHERE `listings`.`id` = NEW.`listing_id`
)
BEGIN
	SELECT RAISE(ABORT, 'offer total units do not match its Package quantity');
END;