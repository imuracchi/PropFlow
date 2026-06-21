CREATE TABLE `property_memos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`propertyId` int NOT NULL,
	`content` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `property_memos_id` PRIMARY KEY(`id`)
);
