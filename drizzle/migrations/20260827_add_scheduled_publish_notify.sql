ALTER TABLE `properties`
  ADD COLUMN `scheduledPublishNotify` int NOT NULL DEFAULT 1 AFTER `scheduleCronTaskUid`;
