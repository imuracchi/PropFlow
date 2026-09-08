CREATE TABLE IF NOT EXISTS `public_page_events` (
  `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `visitorHash` varchar(64) NOT NULL,
  `eventType` varchar(32) NOT NULL,
  `propertyId` int NULL,
  `searchKeyword` varchar(200) NULL,
  `resultCount` int NULL,
  `referrerDomain` varchar(255) NULL,
  `deviceType` varchar(10) NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_public_page_events_created_type` (`createdAt`, `eventType`),
  KEY `idx_public_page_events_property_created` (`propertyId`, `createdAt`),
  KEY `idx_public_page_events_visitor_created` (`visitorHash`, `createdAt`)
);
