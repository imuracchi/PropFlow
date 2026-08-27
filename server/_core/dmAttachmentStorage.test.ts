import { describe, expect, it } from "vitest";
import { decodeAndValidateDmAttachment } from "./dmAttachmentStorage";

describe("DM attachment validation", () => {
  it("accepts a PDF by its binary signature", () => {
    const result = decodeAndValidateDmAttachment({
      fileName: "概要書.pdf",
      dataBase64: Buffer.from("%PDF-1.7\nexample").toString("base64"),
    });
    expect(result.mimeType).toBe("application/pdf");
    expect(result.fileName).toBe("概要書.pdf");
  });

  it("does not trust a disguised extension", () => {
    expect(() =>
      decodeAndValidateDmAttachment({
        fileName: "document.pdf",
        dataBase64: Buffer.from("not a pdf").toString("base64"),
      })
    ).toThrow("PDF、JPEG、PNG、WebPのみ");
  });

  it("removes path and line-break characters from names", () => {
    const result = decodeAndValidateDmAttachment({
      fileName: "../bad\nname.pdf",
      dataBase64: Buffer.from("%PDF-1.7\nexample").toString("base64"),
    });
    expect(result.fileName).toBe(".._bad_name.pdf");
  });
});
