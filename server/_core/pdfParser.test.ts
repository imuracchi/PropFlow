import { beforeEach, describe, expect, it, vi } from "vitest";

const { createMessageMock } = vi.hoisted(() => ({
  createMessageMock: vi.fn(),
}));

vi.mock("dotenv", () => ({
  config: () => ({ parsed: { ANTHROPIC_API_KEY: "test-key" } }),
}));
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: createMessageMock };
  },
}));

import { generatePropertyShareStrength } from "./pdfParser";

describe("generatePropertyShareStrength", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("normalizes the generated introduction and limits it to 100 characters", async () => {
    createMessageMock.mockResolvedValue({
      content: [{ type: "text", text: `${"魅力".repeat(30)}\n${"立地".repeat(30)}` }],
    });

    const result = await generatePropertyShareStrength({
      name: "テスト物件",
      address: "東京都千代田区",
      type: "一棟マンション",
      price: 100_000_000,
    });

    expect(result.error).toBeNull();
    expect(result.strength).toHaveLength(100);
    expect(result.strength).not.toContain("\n");
  });
});
