export type PublicSnsState = {
  deleted: number;
  published: number;
  visibilityScope: string;
  status: string;
  externalListingConsent: number;
};

export function isPublicSnsEligible(property: PublicSnsState) {
  return (
    property.deleted === 0 &&
    property.published === 1 &&
    property.visibilityScope === "public" &&
    property.status !== "sold" &&
    property.externalListingConsent === 1
  );
}
