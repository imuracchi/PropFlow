ALTER TABLE `property_search_requests`
  ADD COLUMN `publishedAt` datetime NULL AFTER `status`;

UPDATE `property_search_requests`
SET `publishedAt` = `createdAt`
WHERE `status` <> 'draft' AND `publishedAt` IS NULL;
