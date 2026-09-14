ALTER TABLE `public_property_document_accesses`
  ADD COLUMN `source` varchar(32) NOT NULL DEFAULT 'unknown' AFTER `email`,
  ADD COLUMN `viewedAt` timestamp NULL AFTER `expiresAt`,
  ADD COLUMN `viewCount` int NOT NULL DEFAULT 0 AFTER `viewedAt`;

CREATE TABLE IF NOT EXISTS `public_property_document_events` (
  `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `accessId` int NOT NULL,
  `eventType` varchar(16) NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_public_property_document_events_created_type` (`createdAt`, `eventType`),
  KEY `idx_public_property_document_events_access` (`accessId`)
);
