CREATE TABLE IF NOT EXISTS `property_search_need_logs` (
  `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `userId` int NOT NULL,
  `areas` json NOT NULL,
  `propertyTypes` json NOT NULL,
  `minPrice` bigint NULL,
  `maxPrice` bigint NULL,
  `minArea` double NULL,
  `maxArea` double NULL,
  `resultCount` int NOT NULL DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_property_search_need_logs_created` (`createdAt`),
  KEY `idx_property_search_need_logs_user` (`userId`)
);
