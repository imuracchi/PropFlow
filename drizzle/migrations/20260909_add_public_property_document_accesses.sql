CREATE TABLE IF NOT EXISTS `public_property_document_accesses` (
  `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `propertyId` int NOT NULL,
  `email` varchar(320) NOT NULL,
  `accessTokenHash` varchar(64) NOT NULL,
  `expiresAt` timestamp NOT NULL,
  `downloadedAt` timestamp NULL,
  `downloadCount` int NOT NULL DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_public_property_document_access_token` (`accessTokenHash`),
  KEY `idx_public_property_document_property_created` (`propertyId`, `createdAt`)
);
