const baseUrl = process.env.V2_TEST_BASE_URL || "http://127.0.0.1:3002";
const password = "PropFlow-Test-2026!";

async function login(email: string) {
  const response = await fetch(`${baseUrl}/api/trpc/auth.login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ json: { email, password } }),
  });
  if (!response.ok)
    throw new Error(`login failed: ${email} ${response.status}`);
  return response.headers
    .getSetCookie()
    .map(value => value.split(";")[0])
    .join("; ");
}

async function query(path: string, cookie: string, input?: unknown) {
  const suffix =
    input === undefined
      ? ""
      : `?input=${encodeURIComponent(JSON.stringify({ json: input }))}`;
  const response = await fetch(`${baseUrl}/api/trpc/${path}${suffix}`, {
    headers: { cookie },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`${path}: ${JSON.stringify(body)}`);
  return body.result.data.json;
}

async function mutate(path: string, cookie: string, input: unknown) {
  const response = await fetch(`${baseUrl}/api/trpc/${path}`, {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({ json: input }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`${path}: ${JSON.stringify(body)}`);
  return body.result.data.json;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const buyer = await login("buyer@propflow.test");
const seller = await login("seller@propflow.test");
const admin = await login("admin@propflow.test");
const created = await mutate("propertySearch.create", buyer, {
  title: "【自動テスト】終了処理確認用の募集",
  areas: ["東京都足立区"],
  propertyTypes: ["土地"],
  minPrice: null,
  maxPrice: 600000000,
  minArea: 500,
  maxArea: null,
  purpose: "開発用地",
  purchaseTiming: "年内",
  notes: "自動テスト",
  anonymous: true,
  conditions: {
    landCondition: "古家あり可",
    minFloorAreaRatio: 200,
    surveyPreference: "売主側で確定測量を希望",
    priorityConditions: "容積率は必須、引渡し時期は相談可",
  },
});
assert(created.id, "request was not created");

const sellerList = await query("propertySearch.list", seller);
const sellerView = sellerList.find((row: any) => row.id === created.id);
assert(
  sellerView &&
    sellerView.requesterName === null &&
    sellerView.requesterCompany === null,
  "anonymous identity leaked"
);

const buyerList = await query("propertySearch.list", buyer);
const buyerView = buyerList.find((row: any) => row.id === created.id);
assert(buyerView?.requesterName, "owner cannot see own identity");
assert(
  buyerView?.conditions?.minFloorAreaRatio === 200,
  "structured conditions were not persisted"
);
const adminList = await query("propertySearch.list", admin);
const adminView = adminList.find((row: any) => row.id === created.id);
assert(
  adminView?.requesterName && adminView?.requesterCompany,
  "operator cannot identify anonymous requester"
);
if (process.env.KEEP_ACTIVE === "true") {
  console.log(
    JSON.stringify({ ok: true, requestId: created.id, keptActive: true })
  );
  process.exit(0);
}

const unreadBeforeProposal = await query(
  "propertySearch.unreadProposalCount",
  buyer
);
const proposed = await mutate("propertySearch.propose", seller, {
  requestId: created.id,
  propertyId: null,
  message: "条件に近い未掲載物件があります。",
});
assert(proposed.success, "proposal failed");
const sellerProposal = await query("propertySearch.myProposal", seller, {
  requestId: created.id,
});
assert(
  sellerProposal?.status === "proposed" &&
    sellerProposal.message === "条件に近い未掲載物件があります。",
  "proposer cannot confirm the sent proposal"
);
const unreadAfterProposal = await query(
  "propertySearch.unreadProposalCount",
  buyer
);
assert(
  unreadAfterProposal === unreadBeforeProposal + 1,
  "new proposal badge count was not added"
);
const buyerListWithUnread = await query("propertySearch.list", buyer);
assert(
  buyerListWithUnread.find((row: any) => row.id === created.id)
    ?.unreadProposalCount === 1,
  "request row does not show the new proposal"
);
const markedViewed = await mutate(
  "propertySearch.markProposalsViewed",
  buyer,
  { requestId: created.id }
);
assert(markedViewed.success, "proposal could not be marked viewed");
assert(
  (await query("propertySearch.list", buyer)).find(
    (row: any) => row.id === created.id
  )?.unreadProposalCount === 0,
  "request new proposal badge did not clear after viewing"
);
let duplicateBlocked = false;
try {
  await mutate("propertySearch.propose", seller, {
    requestId: created.id,
    propertyId: null,
    message: "重複提案です。",
  });
} catch {
  duplicateBlocked = true;
}
assert(duplicateBlocked, "duplicate proposal was not blocked");
const secondProposal = await mutate("propertySearch.propose", admin, {
  requestId: created.id,
  propertyId: null,
  message: "別条件の候補物件をご説明できます。",
});
assert(secondProposal.success, "second proposal failed");
const proposals = await query("propertySearch.proposals", buyer, {
  requestId: created.id,
});
assert(
  proposals.length === 2 && proposals[0].userName,
  "proposal identity missing"
);

let forbiddenClose = false;
try {
  await mutate("propertySearch.close", seller, {
    id: created.id,
    message: "",
  });
} catch {
  forbiddenClose = true;
}
assert(forbiddenClose, "non-owner could close request");

const accepted = await mutate("propertySearch.acceptProposal", buyer, {
  proposalId: sellerProposal.id,
});
assert(accepted.success && accepted.partnerId, "proposal accept failed");
const acceptedSellerProposal = await query(
  "propertySearch.myProposal",
  seller,
  { requestId: created.id }
);
assert(
  acceptedSellerProposal?.status === "accepted",
  "proposer cannot confirm negotiation status"
);
const negotiationMessages = await query("dm.messages", buyer, {
  partnerId: accepted.partnerId,
  propertyId: accepted.propertyId || null,
});
const openingProposal = negotiationMessages.find((message: any) =>
  message.content.includes("への提案をしました。")
);
assert(openingProposal, "proposal opening message was not created");
assert(
  openingProposal.senderId === accepted.partnerId,
  "proposal opening message direction is reversed"
);
const acceptanceReply = negotiationMessages.find(
  (message: any) =>
    message.content === "提案ありがとうございます。内容を確認しました。"
);
assert(acceptanceReply, "proposal acceptance reply was not created");
assert(
  acceptanceReply.senderId !== accepted.partnerId,
  "proposal acceptance reply direction is reversed"
);
const afterAccept = await query("propertySearch.list", buyer);
assert(
  afterAccept.find((row: any) => row.id === created.id)?.status ===
    "negotiating",
  "request did not become negotiating"
);
const proposalsAfterAccept = await query("propertySearch.proposals", buyer, {
  requestId: created.id,
});
assert(
  proposalsAfterAccept.some((row: any) => row.status === "proposed"),
  "other proposals were incorrectly declined"
);

await mutate("propertySearch.close", buyer, {
  id: created.id,
  message: "募集を終了します。",
});
const proposalsAfterClose = await query("propertySearch.proposals", buyer, {
  requestId: created.id,
});
assert(
  proposalsAfterClose.some((row: any) => row.status === "declined"),
  "pending proposals were not declined"
);
console.log(
  JSON.stringify({
    ok: true,
    requestId: created.id,
    proposalId: sellerProposal.id,
    dmPartnerId: accepted.partnerId,
  })
);
