CREATE TABLE `registration_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`token` varchar(128) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`used` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `registration_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `registration_tokens_token_unique` UNIQUE(`token`)
);
