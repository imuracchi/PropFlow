CREATE TABLE IF NOT EXISTS `external_file_shares` (
  `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `propertyId` int NOT NULL,
  `fileId` int NOT NULL,
  `fileIdsJson` text NOT NULL,
  `ownerId` int NOT NULL,
  `recipientEmail` varchar(320) NULL,
  `tokenHash` varchar(64) NOT NULL,
  `expiresAt` timestamp NOT NULL,
  `revokedAt` timestamp NULL,
  `viewCount` int NOT NULL DEFAULT 0,
  `lastViewedAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_external_file_shares_token` (`tokenHash`),
  KEY `idx_external_file_shares_owner_property` (`ownerId`, `propertyId`),
  KEY `idx_external_file_shares_file` (`fileId`)
);

CREATE TABLE IF NOT EXISTS `external_file_share_accesses` (
  `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `shareId` int NOT NULL,
  `email` varchar(320) NOT NULL,
  `accessTokenHash` varchar(64) NOT NULL,
  `expiresAt` timestamp NOT NULL,
  `acceptedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `lastAccessedAt` timestamp NULL,
  `accessCount` int NOT NULL DEFAULT 0,
  UNIQUE KEY `uq_external_file_share_access_token` (`accessTokenHash`),
  KEY `idx_external_file_share_access_share` (`shareId`)
);
