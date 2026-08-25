CREATE INDEX `idx_property_view_events_attention`
  ON `property_view_events` (`viewedAt`, `propertyId`, `userId`);

CREATE INDEX `idx_favorites_attention`
  ON `favorites` (`createdAt`, `propertyId`, `userId`);

CREATE INDEX `idx_direct_messages_attention`
  ON `direct_messages` (`createdAt`, `propertyId`, `senderId`);
