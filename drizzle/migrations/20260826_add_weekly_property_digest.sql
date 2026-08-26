CREATE TABLE IF NOT EXISTS `weekly_property_digests` (
  `weekStart` varchar(10) NOT NULL PRIMARY KEY,
  `payload` json NOT NULL,
  `propertyCount` int NOT NULL DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `weekly_property_digest_deliveries` (
  `weekStart` varchar(10) NOT NULL,
  `userId` int NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'sending',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `sentAt` timestamp NULL,
  PRIMARY KEY (`weekStart`, `userId`),
  KEY `idx_weekly_property_digest_status` (`weekStart`, `status`)
);
