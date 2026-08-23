ALTER TABLE `properties`
  ADD COLUMN `visibilityScope` varchar(20) NOT NULL DEFAULT 'public',
  ADD COLUMN `proposalTargetUserId` int NULL,
  ADD COLUMN `proposalRequestId` int NULL;
