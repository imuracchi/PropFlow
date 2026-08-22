import puppeteer from "puppeteer";

const baseUrl = process.env.V2_TEST_BASE_URL ?? "http://127.0.0.1:3002";
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
  const cookieHeader = response.headers.get("set-cookie")?.split(";")[0];
  assert(response.ok && cookieHeader, `${email} login`);
  const separator = cookieHeader.indexOf("=");
  return { name: cookieHeader.slice(0, separator), value: cookieHeader.slice(separator + 1), header: cookieHeader };
}

async function query(path: string, cookie: string, value: unknown = null) {
  const input = encodeURIComponent(JSON.stringify({ json: value }));
  const response = await fetch(`${baseUrl}/api/trpc/${path}?input=${input}`, { headers: { cookie } });
  const body: any = await response.json();
  return body.result?.data?.json;
}

async function mutate(path: string, cookie: string, value: unknown) {
  return fetch(`${baseUrl}/api/trpc/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ json: value }),
  });
}

const sellerCookie = await login("seller@propflow.test");
const buyerCookie = await login("buyer@propflow.test");
const seller = await query("auth.me", sellerCookie.header);
const buyer = await query("auth.me", buyerCookie.header);
const properties = await query("property.list", sellerCookie.header);
const property = properties.find((item: any) => item.name === "V2テスト 代沢レジデンス");
assert(property && buyer, "UI test data available");

async function runViewport(label: string, width: number, height: number) {
  await mutate("property.removeExclusion", sellerCookie.header, { propertyId: property.id, userId: buyer.id });
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await page.setCookie({ name: sellerCookie.name, value: sellerCookie.value, url: baseUrl });
    await page.goto(`${baseUrl}/v2/property/${property.id}`, { waitUntil: "networkidle0" });
    await page.waitForFunction(() => document.body.innerText.includes("閲覧制限を設定"));
    assert((await page.evaluate(() => document.body.innerText)).includes("現在 0人"), `${label}: initial count`);

    await page.evaluate(() => {
      const button = [...document.querySelectorAll("button")].find(element => element.textContent?.includes("閲覧制限を設定"));
      (button as HTMLButtonElement | undefined)?.click();
    });
    const input = await page.waitForSelector('input[placeholder="名前・会社名で検索"]');
    await input!.type(buyer.name);
    await page.waitForFunction((name) => [...document.querySelectorAll("button")].some(element => element.textContent?.includes(String(name))), {}, buyer.name);
    await page.evaluate((name) => {
      const button = [...document.querySelectorAll("button")].find(element => element.textContent?.includes(String(name)) && element.querySelector("svg"));
      (button as HTMLButtonElement | undefined)?.click();
    }, buyer.name);
    await page.waitForFunction(() => document.body.innerText.includes("現在 1人"));
    assert(true, `${label}: search and add`);

    const buyerPage = await browser.newPage();
    await buyerPage.setViewport({ width, height, deviceScaleFactor: 1 });
    await buyerPage.setCookie({ name: buyerCookie.name, value: buyerCookie.value, url: baseUrl });
    await buyerPage.goto(`${baseUrl}/v2/chat/${seller.id}/${property.id}`, { waitUntil: "networkidle0" });
    await buyerPage.waitForFunction(() => document.body.innerText.includes("過去の商談履歴のみ"));
    const buyerChatText = await buyerPage.evaluate(() => document.body.innerText);
    assert(buyerChatText.includes("閲覧制限中") && (await buyerPage.$("textarea")) === null, `${label}: restricted chat is history-only`);
    await buyerPage.close();

    await page.setCookie({ name: sellerCookie.name, value: sellerCookie.value, url: baseUrl });
    await page.reload({ waitUntil: "networkidle0" });
    await page.waitForFunction(() => document.body.innerText.includes("現在 1人"));
    assert(true, `${label}: restriction persists after reload`);

    await page.evaluate(() => {
      const button = [...document.querySelectorAll("button")].find(element => element.textContent?.includes("閲覧制限を設定"));
      (button as HTMLButtonElement | undefined)?.click();
    });
    const remove = await page.waitForSelector('button[aria-label="閲覧制限を解除"]');
    await remove!.click();
    await page.waitForFunction(() => document.body.innerText.includes("現在 0人"));
    assert(true, `${label}: remove and count update`);
  } finally {
    await browser.close();
    await mutate("property.removeExclusion", sellerCookie.header, { propertyId: property.id, userId: buyer.id });
  }
}

await runViewport("PC", 1440, 1000);
await runViewport("スマホ", 390, 844);
console.log("Viewing restriction UI test completed successfully.");
