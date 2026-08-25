ALTER TABLE `properties`
  ADD COLUMN `externalListingConsent` int NOT NULL DEFAULT 0,
  ADD COLUMN `externalListingConsentedAt` timestamp NULL,
  ADD COLUMN `externalListingConsentVersion` varchar(20) NULL;
