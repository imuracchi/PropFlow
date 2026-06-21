ALTER TABLE `users` MODIFY COLUMN `email` varchar(320) NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `passwordHash` varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `company` text;--> statement-breakpoint
ALTER TABLE `users` ADD `phone` varchar(32);--> statement-breakpoint
ALTER TABLE `users` ADD `license` varchar(128);--> statement-breakpoint
ALTER TABLE `users` ADD `status` enum('pending','active','suspended') DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_email_unique` UNIQUE(`email`);