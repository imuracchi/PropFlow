ALTER TABLE `users`
  ADD COLUMN `notifyPropertySearch` int NOT NULL DEFAULT 1 AFTER `notifyNewProperty`;

CREATE TABLE IF NOT EXISTS `property_search_digest_deliveries` (
  `digestDate` varchar(10) NOT NULL PRIMARY KEY,
  `requestCount` int NOT NULL DEFAULT 0,
  `recipientCount` int NOT NULL DEFAULT 0,
  `sentCount` int NOT NULL DEFAULT 0,
  `status` varchar(20) NOT NULL DEFAULT 'sending',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `completedAt` timestamp NULL
);
