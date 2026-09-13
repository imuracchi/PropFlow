import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";

const PUBLIC_ORIGIN = "https://propflow.jp";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]!);
}

function replaceMeta(html: string, name: string, content: string) {
  const tag = `<meta name="${name}" content="${escapeHtml(content)}" />`;
  const expression = new RegExp(`<meta\\s+name=["']${name}["'][^>]*>`, "i");
  return expression.test(html) ? html.replace(expression, tag) : html.replace("</head>", `  ${tag}\n  </head>`);
}

async function applySeoMetadata(html: string, pathname: string) {
  let title: string | null = null;
  let description: string | null = null;
  let canonical: string | null = null;
  let structuredData: Record<string, unknown> | null = null;

  if (pathname === "/public/properties") {
    title = "公開物件情報｜PropFlow";
    description = "不動産事業者が登録した公開物件を、エリア・物件種別・物件番号などから検索できます。";
    canonical = `${PUBLIC_ORIGIN}/public/properties`;
    structuredData = {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "PropFlow 公開物件情報",
      url: canonical,
      description,
    };
  } else {
    const match = pathname.match(/^\/public\/property\/(\d+)\/?$/);
    if (match) {
      const { getPublicSnsPropertyById } = await import("../db");
      const property = await getPublicSnsPropertyById(Number(match[1]));
      if (property) {
        title = `${property.name}（PF-${property.id}）｜PropFlow`;
        description = `${property.area}の${property.type || "物件"}。価格${property.priceNegotiable || !property.price ? "応相談" : `${Math.floor(property.price / 10000).toLocaleString("ja-JP")}万円`}。公開中の物件情報をご確認いただけます。`;
        canonical = `${PUBLIC_ORIGIN}/public/property/${property.id}`;
        structuredData = {
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: property.name,
          url: canonical,
          description,
          about: {
            "@type": "Place",
            name: property.name,
            address: property.area,
          },
        };
      }
    }
  }

  if (!title || !description || !canonical) return html;
  html = html.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  html = replaceMeta(html, "description", description);
  html = replaceMeta(html, "robots", "index,follow,max-image-preview:large");
  const socialTags = [
    `<link rel="canonical" href="${escapeHtml(canonical)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="PropFlow" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:url" content="${escapeHtml(canonical)}" />`,
    `<meta property="og:image" content="${PUBLIC_ORIGIN}/logo.png" />`,
    `<meta name="twitter:card" content="summary" />`,
    `<script type="application/ld+json">${JSON.stringify(structuredData).replace(/</g, "\\u003c")}</script>`,
  ].join("\n    ");
  return html.replace("</head>", `    ${socialTags}\n  </head>`);
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const transformed = await vite.transformIndexHtml(url, template);
      const page = await applySeoMetadata(transformed, req.path);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath =
    process.env.NODE_ENV === "development"
      ? path.resolve(import.meta.dirname, "../..", "dist", "public")
      : path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", async (req, res, next) => {
    try {
      const template = await fs.promises.readFile(path.resolve(distPath, "index.html"), "utf-8");
      const page = await applySeoMetadata(template, req.path);
      res.status(200).type("html").send(page);
    } catch (error) {
      next(error);
    }
  });
}
