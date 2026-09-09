export type ExternalFileShareState = {
  revokedAt: Date | null;
  expiresAt: Date;
  propertyDeleted: number;
  propertyStatus: string;
  fileCategory: string;
};

export function isExternalFileShareAvailable(
  share: ExternalFileShareState,
  now = new Date()
) {
  return (
    !share.revokedAt &&
    new Date(share.expiresAt).getTime() > now.getTime() &&
    share.propertyDeleted !== 1 &&
    share.propertyStatus !== "sold" &&
    share.fileCategory === "document"
  );
}

export function doesExternalShareRecipientMatch(
  restrictedEmail: string | null,
  submittedEmail: string
) {
  return !restrictedEmail || restrictedEmail.trim().toLowerCase() === submittedEmail.trim().toLowerCase();
}
