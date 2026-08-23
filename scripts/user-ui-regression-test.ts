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
  const raw = response.headers.get("set-cookie")?.split(";")[0];
  assert(response.ok && raw, "seller login for UI regression");
  const separator = raw.indexOf("=");
  return {
    name: raw.slice(0, separator),
    value: raw.slice(separator + 1),
    header: raw,
  };
}

async function query(path: string, cookie: string, value: unknown = null) {
  const input = encodeURIComponent(JSON.stringify({ json: value }));
  const response = await fetch(`${baseUrl}/api/trpc/${path}?input=${input}`, {
    headers: { cookie },
  });
  const body: any = await response.json();
  return body.result?.data?.json;
}

async function mutate(path: string, cookie: string, value: unknown) {
  const response = await fetch(`${baseUrl}/api/trpc/${path}`, {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({ json: value }),
  });
  const body: any = await response.json();
  return body.result?.data?.json;
}

const cookie = await login("seller@propflow.test");
const buyerCookie = await login("buyer@propflow.test");
const adminCookie = await login("admin@propflow.test");
const properties = await query("property.list", cookie.header);
const property = properties.find(
  (item: any) => item.name === "V2テスト 代沢レジデンス"
);
const threads = await query("dm.threads", cookie.header);
const thread = threads.find((item: any) => item.propertyId === property?.id);
assert(property && thread, "property and negotiation test data available");
const searchRequests = await query("propertySearch.list", buyerCookie.header);
if (
  !searchRequests.some(
    (item: any) => item.title === "テスト用 足立区 事業用地募集（募集中）"
  )
) {
  await mutate("propertySearch.create", buyerCookie.header, {
    title: "テスト用 足立区 事業用地募集（募集中）",
    areas: ["東京都足立区"],
    propertyTypes: ["土地"],
    minPrice: null,
    maxPrice: 600000000,
    minArea: 500,
    maxArea: null,
    purpose: "開発用地",
    purchaseTiming: "年内",
    notes: "画面回帰テスト用",
    anonymous: true,
  });
}

const routes = [
  ["/v2/properties", "物件一覧"],
  [`/v2/property/${property.id}`, property.name],
  ["/v2/messages", "商談一覧"],
  ["/v2/favorites", "お気に入り"],
  ["/v2/my-properties", "自社物件"],
  ["/v2/mypage", "マイページ"],
  ["/v2/documents", "ダウンロード資料"],
  ["/v2/interested", "興味者リスト"],
  ["/v2/upload", "物件情報の登録"],
  ["/v2/announcements", "お知らせ"],
  ["/v2/property-search", "物件募集一覧"],
  [`/v2/simulation/${property.id}`, "利益シミュレーション"],
  [`/v2/chat/${thread.partnerId}/${property.id}`, property.name],
] as const;

async function runLoginViewport(label: string, width: number, height: number) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await page.goto(`${baseUrl}/v2/properties`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForFunction(() =>
      document.body.innerText.includes(
        "登録済みのアカウントでログインしてください"
      )
    );
    const bodyBeforeLogin = await page.evaluate(() => document.body.innerText);
    assert(
      bodyBeforeLogin.includes("不動産情報プラットフォーム") &&
        !bodyBeforeLogin.includes("業者間だけで流通する"),
      `${label}: V2 login design renders`
    );

    await page.click('[role="tab"]:nth-child(2)');
    await page.waitForFunction(() =>
      document.body.innerText.includes("登録方法を選択してください")
    );
    assert(
      !(await page.evaluate(() => document.body.innerText)).includes(
        "業者間だけで流通する"
      ),
      `${label}: registration choices use V2 shell`
    );
    await page.evaluate(() => {
      const button = [...document.querySelectorAll("button")].find(element =>
        element.textContent?.includes("メールで登録する")
      );
      (button as HTMLButtonElement | undefined)?.click();
    });
    await page.waitForFunction(() =>
      document.body.innerText.includes("メールで新規登録")
    );
    assert(
      !!(await page.$('input[type="email"]')),
      `${label}: email registration form uses V2 design`
    );

    for (const [path, expected] of [
      ["/forgot-password", "パスワードをお忘れの方"],
      ["/reset-password/invalid-test-token", "新しいパスワードを設定"],
      ["/register/invalid-test-token", "無効なリンクです"],
    ] as const) {
      await page.goto(`${baseUrl}${path}`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(
        text => document.body.innerText.includes(String(text)),
        { timeout: 20000 },
        expected
      );
      const authPageText = await page.evaluate(() => document.body.innerText);
      assert(
        authPageText.includes("PropFlow") &&
          !authPageText.includes("An unexpected error occurred"),
        `${label}: ${path} uses V2 auth design`
      );
    }

    await page.goto(`${baseUrl}/v2/properties`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForSelector('input[type="email"]');
    await page.type('input[type="email"]', "seller@propflow.test");
    await page.type('input[type="password"]', password);
    await page.evaluate(() => {
      const button = [...document.querySelectorAll("button")]
        .filter(
          element =>
            element.textContent?.trim() === "ログイン" &&
            !(element as HTMLButtonElement).disabled
        )
        .at(-1);
      (button as HTMLButtonElement | undefined)?.click();
    });
    await page.waitForFunction(
      () => document.body.innerText.includes("物件一覧"),
      { timeout: 20000 }
    );
    assert(
      new URL(page.url()).pathname === "/v2/properties",
      `${label}: login returns to requested V2 screen`
    );
  } finally {
    await browser.close();
  }
}

async function runViewport(label: string, width: number, height: number) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await page.setCookie({
      name: cookie.name,
      value: cookie.value,
      url: baseUrl,
    });
    for (const [path, expectedText] of routes) {
      const pageErrors: string[] = [];
      const onPageError = (error: Error) => pageErrors.push(error.message);
      page.on("pageerror", onPageError);
      await page.goto(`${baseUrl}${path}`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(
        text => document.body.innerText.includes(String(text)),
        { timeout: 20000 },
        expectedText
      );
      const body = await page.evaluate(() => document.body.innerText);
      assert(
        !body.includes("An unexpected error occurred") &&
          !body.includes("ReferenceError:"),
        `${label}: ${path} renders without error screen`
      );
      assert(
        new URL(page.url()).pathname.startsWith("/v2/"),
        `${label}: ${path} stays on V2`
      );
      assert(
        pageErrors.length === 0,
        `${label}: ${path} has no runtime exception`
      );
      page.off("pageerror", onPageError);
    }

    await page.goto(`${baseUrl}/v2/property-search`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForFunction(() =>
      document.body.innerText.includes("物件募集一覧")
    );
    await page.evaluate(() => {
      const title = [...document.querySelectorAll("button")].find(element =>
        element.textContent?.includes("自動テスト用 事業用地募集")
      );
      (title as HTMLButtonElement | undefined)?.click();
    });
    await page.waitForFunction(() =>
      document.body.innerText.includes("募集案件の詳細")
    );
    if (width >= 1024) {
      const sidebarVisible = await page.evaluate(() => {
        const aside = document.querySelector("aside");
        return (
          !!aside &&
          getComputedStyle(aside).display !== "none" &&
          aside.getBoundingClientRect().width > 0
        );
      });
      assert(
        sidebarVisible,
        `${label}: property-search detail keeps the PC sidebar visible`
      );
    }

    await page.goto(`${baseUrl}/v2/property/${property.id}`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForFunction(() =>
      document.body.innerText.includes("紹介資料を作る")
    );
    await page.evaluate(() => {
      const button = [...document.querySelectorAll("button")].find(element =>
        element.textContent?.includes("紹介資料を作る")
      );
      (button as HTMLButtonElement | undefined)?.click();
    });
    await page.waitForFunction(
      () =>
        document.body.innerText.includes("紹介資料を作成") &&
        document.body.innerText.includes("作成して表示")
    );
    assert(true, `${label}: introduction document options open`);
  } finally {
    await browser.close();
  }
}

async function runAdminViewport(label: string, width: number, height: number) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await page.setCookie({
      name: adminCookie.name,
      value: adminCookie.value,
      url: baseUrl,
    });
    const pageErrors: string[] = [];
    page.on("pageerror", error => pageErrors.push(error.message));
    await page.goto(`${baseUrl}/v2/admin`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(
      () =>
        document.body.innerText.includes("管理画面") &&
        document.body.innerText.includes("管理ダッシュボード"),
      { timeout: 30000 }
    );
    const body = await page.evaluate(() => document.body.innerText);
    assert(
      body.includes("管理ダッシュボード"),
      `${label}: V2 admin dashboard renders`
    );
    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1
    );
    assert(
      !hasHorizontalOverflow,
      `${label}: admin has no page-level horizontal overflow`
    );
    assert(
      new URL(page.url()).pathname === "/v2/admin",
      `${label}: admin stays on V2`
    );
    assert(pageErrors.length === 0, `${label}: admin has no runtime exception`);
  } finally {
    await browser.close();
  }
}

await runLoginViewport("PC", 1440, 1000);
await runLoginViewport("スマホ", 390, 844);
await runViewport("PC", 1440, 1000);
await runViewport("スマホ", 390, 844);
await runAdminViewport("PC", 1440, 1000);
await runAdminViewport("スマホ", 390, 844);
console.log("User UI regression test completed successfully.");
