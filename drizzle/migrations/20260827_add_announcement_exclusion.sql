ALTER TABLE `users`
  ADD COLUMN `announcementExcluded` int NOT NULL DEFAULT 0,
  ADD COLUMN `announcementExclusionNote` text NULL;
