ALTER TABLE `broadcast_logs`
  ADD COLUMN `audience` varchar(32) NOT NULL DEFAULT 'all' AFTER `imageUrl`;
