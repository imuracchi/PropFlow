CREATE TABLE IF NOT EXISTS `dm_message_reactions` (
  `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `messageId` int NOT NULL,
  `userId` int NOT NULL,
  `reaction` enum('request','handle','thanks') NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_dm_message_reactions_message_user` (`messageId`, `userId`),
  KEY `idx_dm_message_reactions_user` (`userId`)
);
