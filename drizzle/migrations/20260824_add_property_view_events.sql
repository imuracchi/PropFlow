CREATE TABLE IF NOT EXISTS `property_view_events` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `propertyId` int NOT NULL,
  `viewedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_property_view_events_property_viewed` (`propertyId`, `viewedAt`),
  KEY `idx_property_view_events_user_viewed` (`userId`, `viewedAt`)
);
