CREATE TABLE IF NOT EXISTS `dm_attachments` (
  `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `messageId` int NOT NULL,
  `uploaderId` int NOT NULL,
  `objectKey` varchar(500) NOT NULL,
  `fileName` varchar(255) NOT NULL,
  `mimeType` varchar(64) NOT NULL,
  `size` int NOT NULL,
  `expiresAt` timestamp NOT NULL,
  `deletedAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_dm_attachments_message` (`messageId`),
  KEY `idx_dm_attachments_expiry` (`deletedAt`, `expiresAt`),
  KEY `idx_dm_attachments_uploader_created` (`uploaderId`, `createdAt`)
);
