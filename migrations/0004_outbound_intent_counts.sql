CREATE TABLE `outbound_intent_counts` (
	`utc_day` text NOT NULL,
	`retailer_slug` text NOT NULL,
	`listing_key` text NOT NULL,
	`placement_code` text NOT NULL,
	`affiliate_link` integer NOT NULL,
	`count` integer NOT NULL,
	CONSTRAINT "outbound_intent_counts_day_check" CHECK("outbound_intent_counts"."utc_day" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
	CONSTRAINT "outbound_intent_counts_affiliate_link_check" CHECK("outbound_intent_counts"."affiliate_link" IN (0, 1)),
	CONSTRAINT "outbound_intent_counts_count_check" CHECK("outbound_intent_counts"."count" > 0)
) STRICT;
--> statement-breakpoint
CREATE UNIQUE INDEX `outbound_intent_counts_identity_unique` ON `outbound_intent_counts` (`utc_day`,`retailer_slug`,`listing_key`,`placement_code`,`affiliate_link`);