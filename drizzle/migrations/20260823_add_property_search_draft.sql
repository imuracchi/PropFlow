ALTER TABLE `property_search_requests`
  MODIFY COLUMN `status` enum('draft','active','negotiating','closed') NOT NULL DEFAULT 'active';
