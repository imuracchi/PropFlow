import { beforeEach, describe, expect, it, vi } from "vitest";

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));

vi.mock("dotenv", () => ({ config: () => ({ parsed: { RESEND_API_KEY: "test-key" } }) }));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: sendMock };
  },
}));

import { sendMail } from "./mail";

describe("sendMail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true only when the provider accepts the email with an id", async () => {
    sendMock.mockResolvedValue({ data: { id: "email-123" }, error: null });

    await expect(sendMail("to@example.com", "subject", "<p>body</p>"))
      .resolves.toBe(true);
  });

  it("returns false when Resend returns an API error without throwing", async () => {
    sendMock.mockResolvedValue({
      data: null,
      error: { name: "validation_error", message: "Attachment was rejected", statusCode: 422 },
    });

    await expect(sendMail("to@example.com", "subject", "<p>body</p>"))
      .resolves.toBe(false);
  });

  it("returns false when the provider response has no delivery id", async () => {
    sendMock.mockResolvedValue({ data: null, error: null });

    await expect(sendMail("to@example.com", "subject", "<p>body</p>"))
      .resolves.toBe(false);
  });

  it("returns false when the provider request throws", async () => {
    sendMock.mockRejectedValue(new Error("network failure"));

    await expect(sendMail("to@example.com", "subject", "<p>body</p>"))
      .resolves.toBe(false);
  });
});
