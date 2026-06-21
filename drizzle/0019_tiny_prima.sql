ALTER TABLE `properties` MODIFY COLUMN `price` bigint;--> statement-breakpoint
ALTER TABLE `properties` ADD `priceNegotiable` int DEFAULT 0 NOT NULL;