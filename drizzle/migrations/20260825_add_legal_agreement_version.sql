ALTER TABLE `users`
  ADD COLUMN `termsAgreedVersion` varchar(20) NULL AFTER `termsAgreedAt`;

ALTER TABLE `registration_requests`
  ADD COLUMN `termsAgreedAt` timestamp NULL AFTER `businessCardMimeType`,
  ADD COLUMN `termsAgreedVersion` varchar(20) NULL AFTER `termsAgreedAt`;
