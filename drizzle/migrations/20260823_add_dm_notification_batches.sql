CREATE TABLE IF NOT EXISTS `dm_notification_batches` (
  `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `senderId` int NOT NULL,
  `receiverId` int NOT NULL,
  `propertyKey` int NOT NULL DEFAULT 0,
  `messages` json NOT NULL,
  `dueAt` datetime NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'pending',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_dm_notification_batch` (`senderId`, `receiverId`, `propertyKey`),
  KEY `idx_dm_notification_due` (`status`, `dueAt`)
);
