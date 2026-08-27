CREATE TABLE IF NOT EXISTS `property_publish_scheduler_probes` (
  `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `adminUserId` int NOT NULL,
  `taskUid` varchar(65) NOT NULL UNIQUE,
  `scheduledAt` datetime NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'pending',
  `executedAt` datetime NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
