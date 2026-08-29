CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`actor` text NOT NULL,
	`occurred_at` integer NOT NULL,
	`action` text NOT NULL,
	`reason` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`before_json` text,
	`after_json` text,
	`prior_audit_id` text,
	`correlation_id` text NOT NULL,
	FOREIGN KEY (`prior_audit_id`) REFERENCES `audit_log`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "audit_log_id_uuidv7_check" CHECK(length("audit_log"."id") = 36 AND "audit_log"."id" = lower("audit_log"."id") AND "audit_log"."id" GLOB '????????-????-7???-[89ab]???-????????????' AND replace("audit_log"."id", '-', '') NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT "audit_log_change_check" CHECK("audit_log"."before_json" IS NOT NULL OR "audit_log"."after_json" IS NOT NULL),
	CONSTRAINT "audit_log_json_check" CHECK(("audit_log"."before_json" IS NULL OR json_valid("audit_log"."before_json")) AND ("audit_log"."after_json" IS NULL OR json_valid("audit_log"."after_json")))
) STRICT;
--> statement-breakpoint
CREATE INDEX `audit_log_target_time_idx` ON `audit_log` (`target_type`,`target_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `brands` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "brands_id_uuidv7_check" CHECK(length("brands"."id") = 36 AND "brands"."id" = lower("brands"."id") AND "brands"."id" GLOB '????????-????-7???-[89ab]???-????????????' AND replace("brands"."id", '-', '') NOT GLOB '*[^0-9a-f]*')
) STRICT;
--> statement-breakpoint
CREATE UNIQUE INDEX `brands_name_unique` ON `brands` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `brands_slug_unique` ON `brands` (`slug`);--> statement-breakpoint
CREATE TABLE `evidence_artifacts` (
	`id` text PRIMARY KEY NOT NULL,
	`retailer_source_id` text NOT NULL,
	`r2_key` text NOT NULL,
	`content_hash` text NOT NULL,
	`artifact_type` text NOT NULL,
	`access_class` text NOT NULL,
	`stored_at` integer NOT NULL,
	`retention_deadline` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`retailer_source_id`) REFERENCES `retailer_sources`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "evidence_artifacts_id_uuidv7_check" CHECK(length("evidence_artifacts"."id") = 36 AND "evidence_artifacts"."id" = lower("evidence_artifacts"."id") AND "evidence_artifacts"."id" GLOB '????????-????-7???-[89ab]???-????????????' AND replace("evidence_artifacts"."id", '-', '') NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT "evidence_artifacts_retention_check" CHECK("evidence_artifacts"."retention_deadline" >= "evidence_artifacts"."stored_at"),
	CONSTRAINT "evidence_artifacts_type_check" CHECK("evidence_artifacts"."artifact_type" IN ('raw_response', 'sanitized_model_input', 'model_output')),
	CONSTRAINT "evidence_artifacts_access_check" CHECK("evidence_artifacts"."access_class" = 'private')
) STRICT;
--> statement-breakpoint
CREATE UNIQUE INDEX `evidence_artifacts_r2_key_unique` ON `evidence_artifacts` (`r2_key`);--> statement-breakpoint
CREATE INDEX `evidence_artifacts_retention_idx` ON `evidence_artifacts` (`deleted_at`,`retention_deadline`);--> statement-breakpoint
CREATE TABLE `listings` (
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
	`latest_observation_id` text,
	`confirmed_at` integer,
	`miss_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`retailer_id`) REFERENCES `retailers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`package_id`) REFERENCES `packages`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`seller_retailer_id`) REFERENCES `retailers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`latest_observation_id`) REFERENCES `source_observations`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "listings_id_uuidv7_check" CHECK(length("listings"."id") = 36 AND "listings"."id" = lower("listings"."id") AND "listings"."id" GLOB '????????-????-7???-[89ab]???-????????????' AND replace("listings"."id", '-', '') NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT "listings_miss_count_check" CHECK("listings"."miss_count" >= 0),
	CONSTRAINT "listings_availability_check" CHECK("listings"."availability" IN ('available', 'unavailable', 'unknown')),
	CONSTRAINT "listings_channel_check" CHECK("listings"."channel" = 'nationwide_online'),
	CONSTRAINT "listings_seller_check" CHECK("listings"."seller_retailer_id" = "listings"."retailer_id"),
	CONSTRAINT "listings_match_status_check" CHECK("listings"."match_status" IN ('unmatched', 'matched', 'review', 'out_of_scope')),
	CONSTRAINT "listings_match_method_check" CHECK("listings"."match_method" IS NULL OR "listings"."match_method" IN ('approved_sku', 'verified_gtin', 'manual')),
	CONSTRAINT "listings_match_coherence_check" CHECK(("listings"."match_status" = 'matched' AND "listings"."package_id" IS NOT NULL AND "listings"."match_method" IS NOT NULL) OR ("listings"."match_status" <> 'matched' AND "listings"."match_method" IS NULL))
) STRICT;
--> statement-breakpoint
CREATE UNIQUE INDEX `listings_identity_unique` ON `listings` (`retailer_id`,`channel`,`retailer_sku`);--> statement-breakpoint
CREATE INDEX `listings_package_status_idx` ON `listings` (`package_id`,`match_status`,`availability`);--> statement-breakpoint
CREATE TABLE `offers` (
	`id` text PRIMARY KEY NOT NULL,
	`listing_id` text NOT NULL,
	`source_offer_key` text NOT NULL,
	`payable_amount_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`required_package_count` integer NOT NULL,
	`total_units` integer NOT NULL,
	`unit_price_numerator` integer NOT NULL,
	`unit_price_denominator` integer NOT NULL,
	`eligibility` text NOT NULL,
	`condition_text` text,
	`condition_json` text,
	`latest_observation_id` text,
	`confirmed_at` integer NOT NULL,
	`declared_expires_at` integer,
	`availability` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`latest_observation_id`) REFERENCES `source_observations`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "offers_id_uuidv7_check" CHECK(length("offers"."id") = 36 AND "offers"."id" = lower("offers"."id") AND "offers"."id" GLOB '????????-????-7???-[89ab]???-????????????' AND replace("offers"."id", '-', '') NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT "offers_amount_check" CHECK("offers"."payable_amount_minor" > 0),
	CONSTRAINT "offers_quantity_check" CHECK("offers"."required_package_count" > 0 AND "offers"."total_units" > 0),
	CONSTRAINT "offers_unit_price_check" CHECK("offers"."unit_price_numerator" = "offers"."payable_amount_minor" AND "offers"."unit_price_denominator" = "offers"."total_units"),
	CONSTRAINT "offers_currency_check" CHECK("offers"."currency" = 'EUR'),
	CONSTRAINT "offers_eligibility_check" CHECK("offers"."eligibility" IN ('universal', 'restricted')),
	CONSTRAINT "offers_availability_check" CHECK("offers"."availability" IN ('available', 'unavailable', 'unknown')),
	CONSTRAINT "offers_expiry_check" CHECK("offers"."declared_expires_at" IS NULL OR "offers"."declared_expires_at" > "offers"."confirmed_at"),
	CONSTRAINT "offers_restricted_condition_check" CHECK("offers"."eligibility" = 'universal' OR "offers"."condition_text" IS NOT NULL),
	CONSTRAINT "offers_condition_json_check" CHECK("offers"."condition_json" IS NULL OR json_valid("offers"."condition_json"))
) STRICT;
--> statement-breakpoint
CREATE UNIQUE INDEX `offers_lane_unique` ON `offers` (`listing_id`,`source_offer_key`);--> statement-breakpoint
CREATE INDEX `offers_current_ranking_idx` ON `offers` (`eligibility`,`availability`,`confirmed_at`,`payable_amount_minor`);--> statement-breakpoint
CREATE INDEX `offers_listing_current_idx` ON `offers` (`listing_id`,`availability`,`confirmed_at`);--> statement-breakpoint
CREATE TABLE `packages` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`unit_count` integer NOT NULL,
	`inner_pack_count` integer,
	`units_per_inner_pack` integer,
	`gtin` text,
	`lifecycle` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "packages_id_uuidv7_check" CHECK(length("packages"."id") = 36 AND "packages"."id" = lower("packages"."id") AND "packages"."id" GLOB '????????-????-7???-[89ab]???-????????????' AND replace("packages"."id", '-', '') NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT "packages_unit_count_check" CHECK("packages"."unit_count" > 0),
	CONSTRAINT "packages_lifecycle_check" CHECK("packages"."lifecycle" IN ('active', 'inactive')),
	CONSTRAINT "packages_inner_composition_check" CHECK(("packages"."inner_pack_count" IS NULL AND "packages"."units_per_inner_pack" IS NULL) OR ("packages"."inner_pack_count" > 0 AND "packages"."units_per_inner_pack" > 0 AND "packages"."inner_pack_count" * "packages"."units_per_inner_pack" = "packages"."unit_count"))
) STRICT;
--> statement-breakpoint
CREATE UNIQUE INDEX `packages_gtin_unique` ON `packages` (`gtin`);--> statement-breakpoint
CREATE INDEX `packages_product_idx` ON `packages` (`product_id`,`lifecycle`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`brand_id` text NOT NULL,
	`category_code` text NOT NULL,
	`line` text,
	`variant` text,
	`normalized_size_code` text,
	`identity_key` text NOT NULL,
	`slug` text NOT NULL,
	`lifecycle` text NOT NULL,
	`successor_product_id` text,
	`merged_into_product_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`brand_id`) REFERENCES `brands`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`successor_product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`merged_into_product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "products_id_uuidv7_check" CHECK(length("products"."id") = 36 AND "products"."id" = lower("products"."id") AND "products"."id" GLOB '????????-????-7???-[89ab]???-????????????' AND replace("products"."id", '-', '') NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT "products_size_applicability_check" CHECK(("products"."category_code" = 'wipes' AND "products"."normalized_size_code" IS NULL) OR ("products"."category_code" <> 'wipes' AND "products"."normalized_size_code" IS NOT NULL)),
	CONSTRAINT "products_category_check" CHECK("products"."category_code" IN ('disposable_diaper', 'diaper_pants', 'wipes')),
	CONSTRAINT "products_normalized_size_check" CHECK("products"."normalized_size_code" IS NULL OR "products"."normalized_size_code" IN ('0', '1', '2', '3', '4', '4+', '5', '5+', '6', '7', '8')),
	CONSTRAINT "products_lifecycle_check" CHECK("products"."lifecycle" IN ('active', 'inactive')),
	CONSTRAINT "products_successor_not_self_check" CHECK("products"."successor_product_id" IS NULL OR "products"."successor_product_id" <> "products"."id"),
	CONSTRAINT "products_merge_not_self_check" CHECK("products"."merged_into_product_id" IS NULL OR "products"."merged_into_product_id" <> "products"."id")
) STRICT;
--> statement-breakpoint
CREATE UNIQUE INDEX `products_identity_unique` ON `products` (`identity_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `products_slug_unique` ON `products` (`slug`);--> statement-breakpoint
CREATE INDEX `products_browse_idx` ON `products` (`category_code`,`normalized_size_code`,`lifecycle`,`brand_id`);--> statement-breakpoint
CREATE TABLE `retailer_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`retailer_id` text NOT NULL,
	`origin` text NOT NULL,
	`started_at` integer NOT NULL,
	`finished_at` integer,
	`status` text NOT NULL,
	`fetched_count` integer DEFAULT 0 NOT NULL,
	`accepted_count` integer DEFAULT 0 NOT NULL,
	`rejected_count` integer DEFAULT 0 NOT NULL,
	`confirmed_count` integer DEFAULT 0 NOT NULL,
	`error_code` text,
	`error_message` text,
	`full_traversal` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`retailer_id`) REFERENCES `retailers`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "retailer_runs_id_uuidv7_check" CHECK(length("retailer_runs"."id") = 36 AND "retailer_runs"."id" = lower("retailer_runs"."id") AND "retailer_runs"."id" GLOB '????????-????-7???-[89ab]???-????????????' AND replace("retailer_runs"."id", '-', '') NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT "retailer_runs_counts_check" CHECK("retailer_runs"."fetched_count" >= 0 AND "retailer_runs"."accepted_count" >= 0 AND "retailer_runs"."rejected_count" >= 0 AND "retailer_runs"."confirmed_count" >= 0),
	CONSTRAINT "retailer_runs_origin_check" CHECK("retailer_runs"."origin" IN ('scheduled', 'manual')),
	CONSTRAINT "retailer_runs_status_check" CHECK("retailer_runs"."status" IN ('running', 'complete', 'failed', 'skipped')),
	CONSTRAINT "retailer_runs_full_traversal_check" CHECK("retailer_runs"."full_traversal" IN (0, 1)),
	CONSTRAINT "retailer_runs_completion_check" CHECK(("retailer_runs"."status" = 'running' AND "retailer_runs"."finished_at" IS NULL) OR ("retailer_runs"."status" <> 'running' AND "retailer_runs"."finished_at" IS NOT NULL)),
	CONSTRAINT "retailer_runs_traversal_check" CHECK("retailer_runs"."full_traversal" = 0 OR "retailer_runs"."status" = 'complete')
) STRICT;
--> statement-breakpoint
CREATE INDEX `retailer_runs_retailer_started_idx` ON `retailer_runs` (`retailer_id`,`started_at`);--> statement-breakpoint
CREATE TABLE `retailer_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`retailer_id` text NOT NULL,
	`source_key` text NOT NULL,
	`acquisition_method` text NOT NULL,
	`authorization_status` text NOT NULL,
	`reviewed_at` integer,
	`expires_at` integer,
	`retention_rule_reference` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`retailer_id`) REFERENCES `retailers`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "retailer_sources_id_uuidv7_check" CHECK(length("retailer_sources"."id") = 36 AND "retailer_sources"."id" = lower("retailer_sources"."id") AND "retailer_sources"."id" GLOB '????????-????-7???-[89ab]???-????????????' AND replace("retailer_sources"."id", '-', '') NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT "retailer_sources_method_check" CHECK("retailer_sources"."acquisition_method" IN ('api', 'feed', 'export')),
	CONSTRAINT "retailer_sources_authorization_check" CHECK("retailer_sources"."authorization_status" IN ('pending', 'authorized', 'review_required', 'revoked', 'expired'))
) STRICT;
--> statement-breakpoint
CREATE UNIQUE INDEX `retailer_sources_identity_unique` ON `retailer_sources` (`retailer_id`,`source_key`);--> statement-breakpoint
CREATE INDEX `retailer_sources_authorization_idx` ON `retailer_sources` (`authorization_status`,`expires_at`);--> statement-breakpoint
CREATE TABLE `retailers` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`lifecycle` text NOT NULL,
	`latest_run_status` text,
	`latest_run_at` integer,
	`latest_successful_run_at` integer,
	`latest_error_code` text,
	`lease_token` text,
	`lease_expires_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "retailers_id_uuidv7_check" CHECK(length("retailers"."id") = 36 AND "retailers"."id" = lower("retailers"."id") AND "retailers"."id" GLOB '????????-????-7???-[89ab]???-????????????' AND replace("retailers"."id", '-', '') NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT "retailers_lifecycle_check" CHECK("retailers"."lifecycle" IN ('inactive', 'active', 'paused')),
	CONSTRAINT "retailers_latest_run_status_check" CHECK("retailers"."latest_run_status" IS NULL OR "retailers"."latest_run_status" IN ('running', 'complete', 'failed', 'skipped')),
	CONSTRAINT "retailers_lease_pair_check" CHECK(("retailers"."lease_token" IS NULL) = ("retailers"."lease_expires_at" IS NULL))
) STRICT;
--> statement-breakpoint
CREATE UNIQUE INDEX `retailers_slug_unique` ON `retailers` (`slug`);--> statement-breakpoint
CREATE INDEX `retailers_lifecycle_name_idx` ON `retailers` (`lifecycle`,`name`);--> statement-breakpoint
CREATE TABLE `review_cases` (
	`id` text PRIMARY KEY NOT NULL,
	`retailer_id` text NOT NULL,
	`listing_id` text NOT NULL,
	`latest_observation_id` text,
	`uncertainty_type` text NOT NULL,
	`status` text NOT NULL,
	`blocks_publication` integer NOT NULL,
	`case_version` integer NOT NULL,
	`occurrence_count` integer NOT NULL,
	`notes` text,
	`closure_outcome` text,
	`opened_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`closed_at` integer,
	FOREIGN KEY (`retailer_id`) REFERENCES `retailers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`latest_observation_id`) REFERENCES `source_observations`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "review_cases_id_uuidv7_check" CHECK(length("review_cases"."id") = 36 AND "review_cases"."id" = lower("review_cases"."id") AND "review_cases"."id" GLOB '????????-????-7???-[89ab]???-????????????' AND replace("review_cases"."id", '-', '') NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT "review_cases_counts_check" CHECK("review_cases"."case_version" > 0 AND "review_cases"."occurrence_count" > 0),
	CONSTRAINT "review_cases_status_check" CHECK("review_cases"."status" IN ('open', 'closed')),
	CONSTRAINT "review_cases_blocks_publication_check" CHECK("review_cases"."blocks_publication" IN (0, 1)),
	CONSTRAINT "review_cases_closure_check" CHECK(("review_cases"."status" = 'open' AND "review_cases"."closed_at" IS NULL AND "review_cases"."closure_outcome" IS NULL) OR ("review_cases"."status" = 'closed' AND "review_cases"."closed_at" IS NOT NULL AND "review_cases"."closure_outcome" IS NOT NULL))
) STRICT;
--> statement-breakpoint
CREATE INDEX `review_cases_queue_idx` ON `review_cases` (`status`,`blocks_publication`,`opened_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `review_cases_logical_unique` ON `review_cases` (`retailer_id`,`listing_id`,`uncertainty_type`);--> statement-breakpoint
CREATE TABLE `source_aliases` (
	`id` text PRIMARY KEY NOT NULL,
	`retailer_source_id` text NOT NULL,
	`field` text NOT NULL,
	`raw_value` text NOT NULL,
	`category_code` text,
	`normalized_size_code` text,
	`active` integer NOT NULL,
	`evidence_note` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`retailer_source_id`) REFERENCES `retailer_sources`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "source_aliases_id_uuidv7_check" CHECK(length("source_aliases"."id") = 36 AND "source_aliases"."id" = lower("source_aliases"."id") AND "source_aliases"."id" GLOB '????????-????-7???-[89ab]???-????????????' AND replace("source_aliases"."id", '-', '') NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT "source_aliases_value_check" CHECK(("source_aliases"."field" = 'category' AND "source_aliases"."category_code" IS NOT NULL AND "source_aliases"."normalized_size_code" IS NULL) OR ("source_aliases"."field" = 'size' AND "source_aliases"."category_code" IS NULL AND "source_aliases"."normalized_size_code" IS NOT NULL)),
	CONSTRAINT "source_aliases_field_check" CHECK("source_aliases"."field" IN ('category', 'size')),
	CONSTRAINT "source_aliases_category_check" CHECK("source_aliases"."category_code" IS NULL OR "source_aliases"."category_code" IN ('disposable_diaper', 'diaper_pants', 'wipes')),
	CONSTRAINT "source_aliases_size_check" CHECK("source_aliases"."normalized_size_code" IS NULL OR "source_aliases"."normalized_size_code" IN ('0', '1', '2', '3', '4', '4+', '5', '5+', '6', '7', '8')),
	CONSTRAINT "source_aliases_active_check" CHECK("source_aliases"."active" IN (0, 1))
) STRICT;
--> statement-breakpoint
CREATE UNIQUE INDEX `source_aliases_identity_unique` ON `source_aliases` (`retailer_source_id`,`field`,`raw_value`);--> statement-breakpoint
CREATE TABLE `source_observations` (
	`id` text PRIMARY KEY NOT NULL,
	`retailer_source_id` text NOT NULL,
	`retailer_run_id` text NOT NULL,
	`listing_id` text,
	`offer_id` text,
	`evidence_artifact_id` text,
	`source_listing_key` text NOT NULL,
	`source_offer_key` text DEFAULT 'default' NOT NULL,
	`observed_at` integer NOT NULL,
	`retrieved_at` integer NOT NULL,
	`source_url` text NOT NULL,
	`raw_facts_json` text NOT NULL,
	`normalized_facts_json` text NOT NULL,
	`extraction_method` text NOT NULL,
	`sanitized_excerpt` text,
	`issue_codes_json` text NOT NULL,
	`affected_fields_json` text NOT NULL,
	`outcome` text NOT NULL,
	`response_integrity_hash` text NOT NULL,
	`sanitized_content_hash` text,
	`observation_format` integer NOT NULL,
	`adapter_identifier` text NOT NULL,
	FOREIGN KEY (`retailer_source_id`) REFERENCES `retailer_sources`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`retailer_run_id`) REFERENCES `retailer_runs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`offer_id`) REFERENCES `offers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`evidence_artifact_id`) REFERENCES `evidence_artifacts`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "source_observations_id_uuidv7_check" CHECK(length("source_observations"."id") = 36 AND "source_observations"."id" = lower("source_observations"."id") AND "source_observations"."id" GLOB '????????-????-7???-[89ab]???-????????????' AND replace("source_observations"."id", '-', '') NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT "source_observations_time_check" CHECK("source_observations"."retrieved_at" >= "source_observations"."observed_at"),
	CONSTRAINT "source_observations_format_check" CHECK("source_observations"."observation_format" > 0),
	CONSTRAINT "source_observations_method_check" CHECK("source_observations"."extraction_method" IN ('api', 'json_ld', 'metadata', 'selector', 'llm')),
	CONSTRAINT "source_observations_outcome_check" CHECK("source_observations"."outcome" IN ('success', 'incomplete', 'invalid', 'fetch_failed')),
	CONSTRAINT "source_observations_json_check" CHECK(json_valid("source_observations"."raw_facts_json") AND json_valid("source_observations"."normalized_facts_json") AND json_valid("source_observations"."issue_codes_json") AND json_valid("source_observations"."affected_fields_json"))
) STRICT;
--> statement-breakpoint
CREATE UNIQUE INDEX `source_observations_natural_unique` ON `source_observations` (`retailer_source_id`,`source_listing_key`,`source_offer_key`,`response_integrity_hash`,`outcome`);--> statement-breakpoint
CREATE INDEX `source_observations_listing_time_idx` ON `source_observations` (`listing_id`,`observed_at`);--> statement-breakpoint
CREATE INDEX `source_observations_offer_time_idx` ON `source_observations` (`offer_id`,`observed_at`);
--> statement-breakpoint
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
END;
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TRIGGER `source_observations_reject_update`
BEFORE UPDATE ON `source_observations`
BEGIN
	SELECT RAISE(ABORT, 'source observations are append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `source_observations_reject_delete`
BEFORE DELETE ON `source_observations`
BEGIN
	SELECT RAISE(ABORT, 'source observations are append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `audit_log_reject_update`
BEFORE UPDATE ON `audit_log`
BEGIN
	SELECT RAISE(ABORT, 'audit log is append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `audit_log_reject_delete`
BEFORE DELETE ON `audit_log`
BEGIN
	SELECT RAISE(ABORT, 'audit log is append-only');
END;