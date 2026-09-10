import { describe, expect, it } from "vitest";
import { createStoredZip } from "./storedZip";

describe("createStoredZip", () => {
  it("creates a UTF-8 ZIP containing every supplied file", () => {
    const zip = createStoredZip([
      { name: "01_物件概要書.pdf", data: Buffer.from("first") },
      { name: "02_レントロール.pdf", data: Buffer.from("second") },
    ]);
    expect(zip.readUInt32LE(0)).toBe(0x04034b50);
    expect(zip.includes(Buffer.from("01_物件概要書.pdf"))).toBe(true);
    expect(zip.includes(Buffer.from("02_レントロール.pdf"))).toBe(true);
    expect(zip.includes(Buffer.from("first"))).toBe(true);
    expect(zip.readUInt32LE(zip.length - 22)).toBe(0x06054b50);
    expect(zip.readUInt16LE(zip.length - 12)).toBe(2);
  });
});
