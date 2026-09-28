export type DuplicatePropertyCandidate = {
  id?: number | null;
  name: string;
  address: string;
  lotNumber?: string | null;
  type: string;
  landArea?: number | null;
  buildingArea?: number | null;
};

function normalizeText(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\u3000]/g, "")
    .replace(/[‐‑‒–—―ー−ｰ]/g, "-")
    .replace(/[()（）・,，.。]/g, "");
}

function sameArea(left?: number | null, right?: number | null) {
  if (left == null || right == null) return false;
  return Math.abs(left - right) <= 0.05;
}

function hasDetailedAddress(value: string) {
  return (
    /\d+丁目(?:\d+(?:-\d+)+|\d+番|\d+番地)/.test(value) ||
    /\d+(?:番地|番)\d*(?:号)?/.test(value) ||
    /\d+-\d+(?:-\d+)?$/.test(value)
  );
}

/**
 * 公開を止めるための判定なので、名称だけでは一致させない。
 * 所在地を必須条件にし、番地まで一致する場合、または名称・地番・面積にも
 * 一致がある場合だけ「明らかに同じ」と判定する。
 */
export function isDuplicateProperty(
  candidate: DuplicatePropertyCandidate,
  existing: DuplicatePropertyCandidate
) {
  const candidateAddress = normalizeText(candidate.address);
  const existingAddress = normalizeText(existing.address);
  if (!candidateAddress || candidateAddress !== existingAddress) return false;

  const candidateLot = normalizeText(candidate.lotNumber);
  const existingLot = normalizeText(existing.lotNumber);
  if (candidateLot && existingLot && candidateLot !== existingLot) return false;

  if (hasDetailedAddress(candidateAddress)) return true;

  const sameName =
    normalizeText(candidate.name).length > 0 &&
    normalizeText(candidate.name) === normalizeText(existing.name);
  const sameLot = Boolean(candidateLot && existingLot && candidateLot === existingLot);
  const sameTypeAndArea =
    normalizeText(candidate.type) === normalizeText(existing.type) &&
    (sameArea(candidate.landArea, existing.landArea) ||
      sameArea(candidate.buildingArea, existing.buildingArea));

  return sameName || sameLot || sameTypeAndArea;
}
