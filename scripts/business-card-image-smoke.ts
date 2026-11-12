// Local-only image conversion test: no OCR, registration, or external uploads.
// Usage: tsx scripts/business-card-image-smoke.ts <image path> [output JPEG path]
import { build } from "esbuild";
import { createServer } from "node:http";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import puppeteer from "puppeteer";
import { preview } from "vite";
const input = process.argv[2];
if (!input) throw new Error("Supply a local image path");
const bundle = await build({
  stdin: {
    contents:
      'import {normalizeBusinessCardImage} from "./client/src/lib/businessCardImage"; window.normalizeCard = normalizeBusinessCardImage;',
    resolveDir: process.cwd(),
  },
  bundle: true,
  write: false,
  format: "iife",
  platform: "browser",
});
const server = createServer((req, res) => {
  if (req.url === "/card.js") {
    res.setHeader("content-type", "text/javascript");
    res.end(bundle.outputFiles[0].text);
  } else {
    res.setHeader("content-type", "text/html");
    res.end('<input id="file" type="file"><script src="/card.js"></script>');
  }
});
await new Promise<void>(done => server.listen(0, "127.0.0.1", done));
const port = (server.address() as { port: number }).port;
let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;
let app: Awaited<ReturnType<typeof preview>> | undefined;
try {
  browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
  });
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on("request", req =>
    req.url().startsWith(`http://127.0.0.1:${port}/`) ||
    req.url().startsWith("blob:") ||
    req.url().startsWith("data:")
      ? void req.continue()
      : void req.abort()
  );
  await page.goto(`http://127.0.0.1:${port}/`);
  const field = await page.$("#file");
  await field!.uploadFile(resolve(input));
  const result = await page.evaluate(async () => {
    const file = (document.querySelector("#file") as HTMLInputElement)
      .files![0];
    return (window as any).normalizeCard(file);
  });
  const jpeg = Buffer.from(result.base64, "base64");
  if (
    result.mimeType !== "image/jpeg" ||
    jpeg[0] !== 255 ||
    jpeg[1] !== 216 ||
    Math.max(result.width, result.height) > 2048
  )
    throw new Error("Invalid normalized JPEG");
  // Ordinary JPEG input must still work through the same pipeline.
  await page.evaluate(
    async ({ base64 }: { base64: string }) => {
      const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
      const result = await (window as any).normalizeCard(
        new File([bytes], "card.jpg", { type: "image/jpeg" })
      );
      if (result.mimeType !== "image/jpeg" || !result.base64)
        throw new Error("JPEG regression");
    },
    { base64: result.base64 }
  );
  if (process.argv[3]) await writeFile(resolve(process.argv[3]), jpeg);
  // Verify the built registration screen sends JPEG to OCR. All API calls are mocked.
  app = await preview({ preview: { host: "127.0.0.1", port: 0, open: false } });
  const appPort = (app.httpServer.address() as { port: number }).port;
  const origin = `http://127.0.0.1:${appPort}`;
  const ui = await browser.newPage();
  let ocrReceivedJpeg = false;
  await ui.setRequestInterception(true);
  ui.on("request", request => {
    if (request.url().startsWith(`${origin}/api/trpc/`)) {
      const url = new URL(request.url());
      const paths = url.pathname.split("/api/trpc/")[1].split(",");
      const results = paths.map(path => {
        let data: unknown = path === "auth.me" ? null : [];
        if (path === "auth.readBusinessCard") {
          const body = JSON.parse(request.postData() ?? "{}");
          const input = (url.searchParams.has("batch") ? body[0] : body).json;
          ocrReceivedJpeg =
            input.mimeType === "image/jpeg" &&
            Buffer.from(input.imageBase64, "base64")[0] === 255;
          data = {
            success: true,
            data: {
              name: "検証用ユーザー",
              company: "架空の検証会社",
              email: "test@example.com",
            },
          };
        }
        return { result: { data: { json: data } } };
      });
      void request.respond({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          url.searchParams.has("batch") ? results : results[0]
        ),
      });
    } else if (
      request.url().startsWith(origin) ||
      request.url().startsWith("data:") ||
      request.url().startsWith("blob:")
    ) {
      void request.continue();
    } else void request.abort();
  });
  await ui.goto(`${origin}/registration-request`);
  await ui.waitForSelector('input[type="file"]');
  const uiInput = await ui.$('input[type="file"]');
  const accept = await uiInput!.evaluate(element =>
    element.getAttribute("accept")
  );
  if (!accept?.includes(".heic"))
    throw new Error("HEIC missing from registration file chooser");
  await uiInput!.uploadFile(resolve(input));
  await ui.waitForSelector('img[alt="送信する名刺"]', { timeout: 60000 });
  if (!ocrReceivedJpeg)
    throw new Error("Registration did not send normalized JPEG to OCR");
  console.log(
    JSON.stringify({
      ok: true,
      mimeType: result.mimeType,
      width: result.width,
      height: result.height,
      jpegBytes: jpeg.length,
      jpegRegression: true,
      registrationUi: true,
    })
  );
} finally {
  await browser?.close();
  await new Promise<void>(done =>
    app ? app.httpServer.close(() => done()) : done()
  );
  await new Promise<void>((done, fail) =>
    server.close(error => (error ? fail(error) : done()))
  );
}
