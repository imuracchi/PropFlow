ALTER TABLE `users`
  ADD COLUMN `lastActiveAt` timestamp NULL AFTER `lastSignedIn`;
