ALTER TABLE `chat_exits` MODIFY COLUMN `propertyId` int;--> statement-breakpoint
ALTER TABLE `chat_exits` ADD `dmPartnerId` int;--> statement-breakpoint
ALTER TABLE `chat_exits` ADD `dmPropertyId` int;