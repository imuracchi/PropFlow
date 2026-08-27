ALTER TABLE `properties`
  ADD COLUMN `scheduledPublishAt` timestamp NULL AFTER `publishedAt`,
  ADD COLUMN `scheduleCronTaskUid` varchar(65) NULL AFTER `scheduledPublishAt`,
  ADD INDEX `idx_properties_schedule_cron_task_uid` (`scheduleCronTaskUid`);
