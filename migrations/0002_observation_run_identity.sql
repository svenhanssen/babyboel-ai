DROP INDEX `source_observations_natural_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `source_observations_natural_unique`
ON `source_observations` (
  `retailer_source_id`,
  `retailer_run_id`,
  `source_listing_key`,
  `source_offer_key`,
  `response_integrity_hash`,
  `outcome`
);
