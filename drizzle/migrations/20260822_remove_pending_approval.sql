ALTER TABLE `users` MODIFY COLUMN `status` ENUM('pending','active','suspended') NOT NULL DEFAULT 'active';
UPDATE `users` SET `status` = 'active' WHERE `status` = 'pending';
