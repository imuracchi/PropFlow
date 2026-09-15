import { describe, expect, it } from "vitest";
import { buildPublicPropertyDocumentHtml } from "./publicPropertyDocument";

describe("public property document", () => {
  it("renders public fields and does not introduce company or logo content", () => {
    const html = buildPublicPropertyDocumentHtml({ id: 287, name: "ロワール坂戸", area: "埼玉県坂戸市", price: 194_000_000, type: "一棟マンション" }, "https://propflow.jp/registration-request?sourcePropertyId=287");
    expect(html).toContain("PF-287");
    expect(html).toContain("埼玉県坂戸市");
    expect(html).toContain("一般公開用資料です");
    expect(html).not.toContain("価格はお問い合わせください");
    expect(html).not.toContain(">価格<");
    expect(html).not.toContain("1億9,400万円");
    expect(html).toContain("PropFlow Japanese");
    expect(html).toContain("NotoSansJP-VF.ttf");
    expect(html).not.toContain("fonts.googleapis.com");
    expect(html).not.toContain("G-Spec");
    expect(html).not.toContain("<img");
  });

  it("escapes registered property text", () => {
    const html = buildPublicPropertyDocumentHtml({ id: 1, name: "<script>alert(1)</script>", area: "東京都" }, "https://propflow.jp");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
