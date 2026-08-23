const baseUrl = process.env.V2_TEST_BASE_URL || "http://127.0.0.1:3004";
const password = "PropFlow-Test-2026!";

async function login(email: string) {
  const response = await fetch(`${baseUrl}/api/trpc/auth.login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ json: { email, password } }),
  });
  if (!response.ok) throw new Error(`login failed: ${email}`);
  return response.headers.getSetCookie().map(v => v.split(";")[0]).join("; ");
}

async function query(path: string, cookie: string, input?: unknown) {
  const suffix = input
    ? `?input=${encodeURIComponent(JSON.stringify({ json: input }))}`
    : "";
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

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

const admin = await login("admin@propflow.test");
const seller = await login("seller@propflow.test");
const buyer = await login("buyer@propflow.test");
const request = await mutate("propertySearch.create", admin, {
  title: "限定公開テスト募集",
  areas: ["東京都"],
  propertyTypes: ["土地"],
  anonymous: true,
  status: "active",
});
let limitedDraftBlocked = false;
try {
  await mutate("property.create", seller, {
    name: "作成されない限定下書き",
    address: "東京都千代田区テスト1-1",
    type: "土地",
    price: 100000000,
    published: false,
    proposalRequestId: request.id,
    proposalOnly: true,
  });
} catch {
  limitedDraftBlocked = true;
}
assert(limitedDraftBlocked, "proposal-only draft was not blocked");
const property = await mutate("property.create", seller, {
  name: "提案先限定公開テスト物件",
  address: "東京都千代田区テスト1-1",
  type: "土地",
  price: 100000000,
  published: true,
  proposalRequestId: request.id,
  proposalOnly: true,
});
assert(property?.id, "limited property was not created");
const [sellerList, adminList, buyerList, buyerDirect] = await Promise.all([
  query("property.list", seller),
  query("property.list", admin),
  query("property.list", buyer),
  query("property.getById", buyer, { id: property.id }),
]);
assert(sellerList.some((p: any) => p.id === property.id), "owner cannot see");
assert(adminList.some((p: any) => p.id === property.id), "target cannot see");
assert(!buyerList.some((p: any) => p.id === property.id), "third party list leak");
assert(buyerDirect === null, "third party direct URL leak");
const proposal = await mutate("propertySearch.propose", seller, {
  requestId: request.id,
  propertyId: property.id,
  message: "限定公開物件の提案です。",
});
assert(proposal.success, "limited property proposal failed");
console.log(JSON.stringify({ ok: true, requestId: request.id, propertyId: property.id }));
