-- PropFlow V2: 公開日表示用カラム（オンライン適用可能）
ALTER TABLE `properties`
  ADD COLUMN `publishedAt` timestamp NULL AFTER `published`;

-- 既存の公開物件は登録日を初回公開日として補完する。
UPDATE `properties`
SET `publishedAt` = `createdAt`
WHERE `published` = 1
  AND `publishedAt` IS NULL;
