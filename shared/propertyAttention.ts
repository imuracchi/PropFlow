export const PROPERTY_ATTENTION_THRESHOLD = 30;

export type PropertyAttentionSignals = {
  viewCount?: number | null;
  favoriteCount?: number | null;
  inquiryCount?: number | null;
  recentViewCount?: number | null;
  recentFavoriteCount?: number | null;
  recentInquiryCount?: number | null;
};

function nonNegative(value: number | null | undefined) {
  return Number.isFinite(value) ? Math.max(0, value ?? 0) : 0;
}

/**
 * Current aggregate-data score. When dated events are available, these inputs
 * can be changed to rolling seven-day unique counts here.
 */
export function getPropertyAttentionScore({
  viewCount,
  favoriteCount,
  inquiryCount,
  recentViewCount,
  recentFavoriteCount,
  recentInquiryCount,
}: PropertyAttentionSignals) {
  return (
    nonNegative(recentViewCount ?? viewCount) +
    nonNegative(recentFavoriteCount ?? favoriteCount) * 5 +
    nonNegative(recentInquiryCount ?? inquiryCount) * 10
  );
}

export function isPropertyAttentionWorthy(signals: PropertyAttentionSignals) {
  return getPropertyAttentionScore(signals) >= PROPERTY_ATTENTION_THRESHOLD;
}
