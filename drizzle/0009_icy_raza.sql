CREATE TABLE `property_files` (
	`id` int AUTO_INCREMENT NOT NULL,
	`propertyId` int NOT NULL,
	`name` varchar(500) NOT NULL,
	`size` int NOT NULL,
	`contentBase64` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `property_files_id` PRIMARY KEY(`id`)
);
