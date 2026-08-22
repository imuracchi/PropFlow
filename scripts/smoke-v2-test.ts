const baseUrl = process.env.V2_TEST_BASE_URL ?? "http://127.0.0.1:3000";
const password = process.env.V2_TEST_PASSWORD ?? "PropFlow-Test-2026!";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`PASS: ${message}`);
}

async function login(email: string) {
  const response = await fetch(`${baseUrl}/api/trpc/auth.login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ json: { email, password } }),
  });
  assert(response.ok, `${email} login HTTP`);
  const body: any = await response.json();
  assert(body.result?.data?.json?.success === true, `${email} login result`);
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  assert(cookie, `${email} session cookie`);
  return cookie;
}

async function query(path: string, cookie: string, value: unknown = null) {
  const input = encodeURIComponent(JSON.stringify({ json: value }));
  const response = await fetch(`${baseUrl}/api/trpc/${path}?input=${input}`, { headers: { cookie } });
  assert(response.ok, `${path} HTTP`);
  const body: any = await response.json();
  return body.result?.data?.json;
}

async function mutate(path: string, cookie: string, value: unknown) {
  const response = await fetch(`${baseUrl}/api/trpc/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ json: value }),
  });
  const body: any = await response.json();
  return { ok: response.ok, data: body.result?.data?.json, error: body.error };
}

function errorCode(result: { error: any }) {
  return result.error?.json?.data?.code ?? result.error?.data?.code;
}

const sellerCookie = await login("seller@propflow.test");
const buyerCookie = await login("buyer@propflow.test");
const adminCookie = await login("admin@propflow.test");

const seller = await query("auth.me", sellerCookie);
const buyer = await query("auth.me", buyerCookie);
const admin = await query("auth.me", adminCookie);
assert(seller.role === "user" && buyer.role === "user", "seller and buyer roles");
assert(admin.role === "admin", "admin role");

const properties = await query("property.list", sellerCookie);
assert(properties.some((property: any) => property.name === "V2テスト 代沢レジデンス"), "seed property visible");
const property = properties.find((item: any) => item.name === "V2テスト 代沢レジデンス");

let favoriteIds = await query("favorite.ids", buyerCookie);
if (!favoriteIds.includes(property.id)) {
  const favoriteAdded = await mutate("favorite.toggle", buyerCookie, { propertyId: property.id });
  assert(favoriteAdded.ok && favoriteAdded.data?.favorited === true, "buyer favorite prepared");
  favoriteIds = await query("favorite.ids", buyerCookie);
}
assert(favoriteIds.includes(property.id), "buyer favorite persisted");

const buyerThreads = await query("dm.threads", buyerCookie);
const buyerThread = buyerThreads.find((thread: any) => thread.propertyId === property.id);
assert(buyerThread?.initiatedByMe === true, "buyer sees こちらから商談");

let sellerThreads = await query("dm.threads", sellerCookie);
let sellerThread = sellerThreads.find((thread: any) => thread.propertyId === property.id);
assert(sellerThread?.initiatedByMe === false, "seller sees 相手から商談");
if (!sellerThread?.flagged) {
  const flagSet = await mutate("dm.setFlag", sellerCookie, { partnerId: buyer.id, propertyId: property.id, flagged: true });
  assert(flagSet.ok && flagSet.data?.success === true, "seller 要返信 prepared");
  sellerThreads = await query("dm.threads", sellerCookie);
  sellerThread = sellerThreads.find((thread: any) => thread.propertyId === property.id);
}
assert(sellerThread?.flagged === true, "seller 要返信 persisted");

const interested = await query("mypage.interestedUsers", sellerCookie);
const interestedBuyer = interested.find((entry: any) => entry.propertyId === property.id && entry.userId === buyer.id);
assert(interestedBuyer?.types.includes("favorite"), "interested list favorite status");
assert(interestedBuyer?.types.includes("dm"), "interested list 商談中 status");
assert(typeof interestedBuyer?.verified === "number", "interested list verification status returned");

const auditDocumentTitle = `閲覧制限監査 ${Date.now()}`;
const auditDocumentSaved = await mutate("document.save", buyerCookie, {
  propertyId: property.id,
  title: auditDocumentTitle,
  htmlContent: "<p>permission audit</p>",
  attachmentIds: [],
});
assert(auditDocumentSaved.ok && auditDocumentSaved.data?.success === true, "saved document prepared for restriction audit");
const documentsBeforeRestriction = await query("document.list", buyerCookie);
const auditDocument = documentsBeforeRestriction.find((item: any) => item.title === auditDocumentTitle);
assert(auditDocument, "saved document persisted before restriction");

const exclusionAdded = await mutate("property.addExclusion", sellerCookie, { propertyId: property.id, userId: buyer.id });
assert(exclusionAdded.ok && exclusionAdded.data?.success === true, "seller can add viewing exclusion");
try {
  const exclusions = await query("property.getExclusions", sellerCookie, { propertyId: property.id });
  assert(exclusions.some((entry: any) => entry.userId === buyer.id), "viewing exclusion is persisted");

  const restrictedList = await query("property.list", buyerCookie);
  assert(!restrictedList.some((item: any) => item.id === property.id), "excluded property is absent from buyer list");
  const restrictedDetail = await query("property.getById", buyerCookie, { id: property.id });
  assert(restrictedDetail === null, "excluded property cannot be opened by direct URL");
  const restrictedFiles = await mutate("property.markRead", buyerCookie, { propertyId: property.id });
  const restrictedErrorCode = restrictedFiles.error?.json?.data?.code ?? restrictedFiles.error?.data?.code;
  assert(!restrictedFiles.ok && restrictedErrorCode === "NOT_FOUND", "excluded property related APIs are blocked");
  const restrictedFavoriteIds = await query("favorite.ids", buyerCookie);
  assert(!restrictedFavoriteIds.includes(property.id), "excluded property is absent from saved favorites");
  const restrictedThreads = await query("dm.threads", buyerCookie);
  const restrictedThread = restrictedThreads.find((item: any) => item.propertyId === property.id && item.partnerId === seller.id);
  assert(restrictedThread?.propertyRestricted === true, "existing negotiation is marked read-only while restricted");
  const historicalMessages = await query("dm.messages", buyerCookie, { partnerId: seller.id, propertyId: property.id });
  assert(historicalMessages.length > 0, "past negotiation messages remain readable while restricted");
  const restrictedSend = await mutate("dm.send", buyerCookie, { receiverId: seller.id, propertyId: property.id, content: "should not be sent" });
  assert(!restrictedSend.ok && errorCode(restrictedSend) === "NOT_FOUND", "new message is blocked while restricted");
  const ownHistoricalMessage = historicalMessages.find((message: any) => message.senderId === buyer.id);
  if (ownHistoricalMessage) {
    const restrictedDelete = await mutate("dm.deleteOwnMessage", buyerCookie, { messageId: ownHistoricalMessage.id });
    assert(!restrictedDelete.ok && errorCode(restrictedDelete) === "NOT_FOUND", "historical message deletion is blocked while restricted");
  }
  const restrictedDocuments = await query("document.list", buyerCookie);
  assert(!restrictedDocuments.some((item: any) => item.id === auditDocument.id), "saved introduction document is hidden while restricted");
  const restrictedDocumentHtml = await query("document.getHtml", buyerCookie, { id: auditDocument.id });
  assert(restrictedDocumentHtml === null, "saved introduction document cannot be opened directly while restricted");
} finally {
  const exclusionRemoved = await mutate("property.removeExclusion", sellerCookie, { propertyId: property.id, userId: buyer.id });
  assert(exclusionRemoved.ok && exclusionRemoved.data?.success === true, "seller can remove viewing exclusion");
}

const restoredDetail = await query("property.getById", buyerCookie, { id: property.id });
assert(restoredDetail?.id === property.id, "property becomes visible again after exclusion removal");
const restoredDocuments = await query("document.list", buyerCookie);
assert(restoredDocuments.some((item: any) => item.id === auditDocument.id), "saved introduction document returns after restriction removal");
const documentCleanup = await mutate("document.delete", buyerCookie, { id: auditDocument.id });
assert(documentCleanup.ok && documentCleanup.data?.success === true, "restriction audit document cleaned up");

const originalName = restoredDetail.name;
const unauthorizedUpdate = await mutate("property.update", buyerCookie, { id: property.id, name: "UNAUTHORIZED-UPDATE" });
assert(!unauthorizedUpdate.ok && errorCode(unauthorizedUpdate) === "FORBIDDEN", "non-owner cannot edit property via API");
const detailAfterUpdateAttempt = await query("property.getById", sellerCookie, { id: property.id });
assert(detailAfterUpdateAttempt.name === originalName, "unauthorized edit did not change property data");

const unauthorizedPublish = await mutate("property.setPublished", buyerCookie, { propertyId: property.id, published: false });
assert(unauthorizedPublish.ok && unauthorizedPublish.data?.success === false, "non-owner cannot change publish state via API");
const detailAfterPublishAttempt = await query("property.getById", sellerCookie, { id: property.id });
assert(detailAfterPublishAttempt.published === restoredDetail.published, "unauthorized publish change did not alter state");

const unauthorizedSold = await mutate("property.markSold", buyerCookie, { id: property.id, dealPrice: null, announcePublic: false });
assert(!unauthorizedSold.ok && errorCode(unauthorizedSold) === "FORBIDDEN", "non-owner cannot report closing via API");

const unauthorizedDelete = await mutate("property.delete", buyerCookie, { id: property.id });
assert(unauthorizedDelete.ok && unauthorizedDelete.data?.success === false, "non-owner cannot delete property via API");
const unauthorizedOwnerDelete = await mutate("property.deleteOwn", buyerCookie, { propertyId: property.id });
assert(!unauthorizedOwnerDelete.ok && errorCode(unauthorizedOwnerDelete) === "FORBIDDEN", "non-owner cannot permanently delete property via API");

const unauthorizedNotify = await mutate("property.notifyLine", buyerCookie, { propertyId: property.id });
assert(!unauthorizedNotify.ok && errorCode(unauthorizedNotify) === "FORBIDDEN", "non-owner cannot send property notifications via API");

const auditFileName = `permission-audit-${Date.now()}.pdf`;
const ownerUpload = await mutate("property.uploadFile", sellerCookie, {
  propertyId: property.id,
  name: auditFileName,
  size: 4,
  contentBase64: "dGVzdA==",
  category: "document",
  visible: true,
});
assert(ownerUpload.ok && ownerUpload.data?.success === true, "owner test file prepared");
const ownerFiles = await query("property.listFiles", sellerCookie, { propertyId: property.id });
const auditFile = ownerFiles.find((file: any) => file.name === auditFileName);
assert(auditFile, "owner test file persisted");
try {
  const visibleRawFile = await fetch(`${baseUrl}/api/files/raw/${auditFile.id}`, { headers: { cookie: buyerCookie } });
  assert(visibleRawFile.ok, "authorized user can preview raw PDF endpoint");
  const rawExclusionAdded = await mutate("property.addExclusion", sellerCookie, { propertyId: property.id, userId: buyer.id });
  assert(rawExclusionAdded.ok && rawExclusionAdded.data?.success === true, "raw PDF restriction prepared");
  try {
    const restrictedRawFile = await fetch(`${baseUrl}/api/files/raw/${auditFile.id}`, { headers: { cookie: buyerCookie } });
    assert(restrictedRawFile.status === 404, "excluded user cannot bypass restriction through raw PDF endpoint");
  } finally {
    await mutate("property.removeExclusion", sellerCookie, { propertyId: property.id, userId: buyer.id });
  }

  const unauthorizedUpload = await mutate("property.uploadFile", buyerCookie, {
    propertyId: property.id,
    name: "unauthorized.pdf",
    size: 4,
    contentBase64: "dGVzdA==",
    category: "document",
    visible: true,
  });
  assert(!unauthorizedUpload.ok && errorCode(unauthorizedUpload) === "FORBIDDEN", "non-owner cannot add photos or documents via API");

  const unauthorizedVisibility = await mutate("property.setFileVisibility", buyerCookie, { fileId: auditFile.id, visible: false });
  assert(unauthorizedVisibility.ok && unauthorizedVisibility.data?.success === false, "non-owner cannot change document visibility via API");

  const unauthorizedFileDelete = await mutate("property.deleteFile", buyerCookie, { fileId: auditFile.id });
  assert(!unauthorizedFileDelete.ok && errorCode(unauthorizedFileDelete) === "FORBIDDEN", "non-owner cannot delete photos or documents via API");
  const filesAfterAttempts = await query("property.listFiles", sellerCookie, { propertyId: property.id });
  assert(filesAfterAttempts.some((file: any) => file.id === auditFile.id && file.visible !== 0), "unauthorized file operations did not change data");
} finally {
  const ownerCleanup = await mutate("property.deleteFile", sellerCookie, { fileId: auditFile.id });
  assert(ownerCleanup.ok && ownerCleanup.data?.success === true, "owner test file cleaned up");
}

const draftCreated = await mutate("property.create", sellerCookie, {
  name: `権限監査下書き ${Date.now()}`,
  address: "東京都テスト区1-1-1",
  type: "土地",
  published: false,
});
assert(draftCreated.ok && draftCreated.data?.id, "draft property prepared");
try {
  const ownerDraft = await query("property.getById", sellerCookie, { id: draftCreated.data.id });
  assert(ownerDraft?.published === 0, "property registrant can open own draft");
  const buyerDraft = await query("property.getById", buyerCookie, { id: draftCreated.data.id });
  assert(buyerDraft === null, "non-owner cannot open draft by direct URL");
} finally {
  const draftCleanup = await mutate("property.deleteOwn", sellerCookie, { propertyId: draftCreated.data.id });
  assert(draftCleanup.ok && draftCleanup.data?.success === true, "owner deletion accepted");
  const deletedProperties = await query("mypage.deletedProperties", sellerCookie);
  const deletedDraft = deletedProperties.find((item: any) => item.id === draftCreated.data.id);
  assert(!!deletedDraft?.ownerDeletedAt, "owner-deleted property remains recoverable with deletion date");
  const restoredDraft = await mutate("mypage.restoreProperty", sellerCookie, {
    id: draftCreated.data.id,
    notifyPartners: false,
  });
  assert(restoredDraft.ok && restoredDraft.data?.success === true, "owner can restore deleted property without notifying partners");
  const restoredDraftDetail = await query("property.getById", sellerCookie, { id: draftCreated.data.id });
  assert(restoredDraftDetail?.deleted === 0, "restored property returns to active state");
  await mutate("property.deleteOwn", sellerCookie, { propertyId: draftCreated.data.id });
  const permanentCleanup = await mutate("admin.hardDeleteProperty", adminCookie, { id: draftCreated.data.id });
  assert(permanentCleanup.ok && permanentCleanup.data?.success === true, "draft audit property permanently cleaned up by admin");
}

console.log("V2 API smoke test completed successfully.");
