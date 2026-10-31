import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));

vi.mock("dotenv", () => ({
  config: () => ({ parsed: { RESEND_API_KEY: "test-key" } }),
}));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: sendMock };
  },
}));

let sendMail: typeof import("./mail").sendMail;

describe("sendMail", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();
    sendMock.mockReset();
    ({ sendMail } = await import("./mail"));
  });
  afterEach(() => vi.useRealTimers());

  it("returns true only when the provider accepts the email with an id", async () => {
    sendMock.mockResolvedValue({ data: { id: "email-123" }, error: null });

    await expect(
      sendMail("to@example.com", "subject", "<p>body</p>")
    ).resolves.toBe(true);
  });

  it("uses an explicitly requested verified sender", async () => {
    sendMock.mockResolvedValue({ data: { id: "email-456" }, error: null });

    await sendMail("to@example.com", "subject", "<p>body</p>", {
      from: "PropFlowサポート <support@gspec.me>",
    });

    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "PropFlowサポート <support@gspec.me>",
        to: "to@example.com",
      }),
      expect.objectContaining({ idempotencyKey: expect.any(String) })
    );
  });

  it("returns false when Resend returns an API error without throwing", async () => {
    sendMock.mockResolvedValue({
      data: null,
      error: {
        name: "validation_error",
        message: "Attachment was rejected",
        statusCode: 422,
      },
    });

    await expect(
      sendMail("to@example.com", "subject", "<p>body</p>")
    ).resolves.toBe(false);
  });

  it("returns false when the provider response has no delivery id", async () => {
    sendMock.mockResolvedValue({ data: null, error: null });

    await expect(
      sendMail("to@example.com", "subject", "<p>body</p>")
    ).resolves.toBe(false);
  });

  it("returns false when the provider request throws", async () => {
    sendMock.mockRejectedValue(new Error("network failure"));

    await expect(
      sendMail("to@example.com", "subject", "<p>body</p>")
    ).resolves.toBe(false);
  });

  it("spaces a simultaneous notification burst, with no overlapping requests", async () => {
    const times: number[] = [];
    let active = 0;
    let maxActive = 0;
    sendMock.mockImplementation(async () => {
      times.push(Date.now());
      maxActive = Math.max(maxActive, ++active);
      await new Promise(resolve => setTimeout(resolve, 800));
      active--;
      return { data: { id: `mail-${times.length}` }, error: null };
    });
    const jobs = Array.from({ length: 20 }, (_, i) =>
      sendMail(`${i}@example.com`, "subject", "body")
    );
    await vi.runAllTimersAsync();
    expect(await Promise.all(jobs)).toEqual(Array(20).fill(true));
    expect(maxActive).toBe(1);
    expect(times.slice(1).every((time, i) => time - times[i] >= 600)).toBe(
      true
    );
  });

  it("throttles even when the provider responds immediately", async () => {
    const times: number[] = [];
    sendMock.mockImplementation(async () => {
      times.push(Date.now());
      return { data: { id: "accepted" }, error: null };
    });
    const jobs = Array.from({ length: 30 }, (_, i) =>
      sendMail(`${i}@example.com`, "subject", "body")
    );
    await vi.runAllTimersAsync();
    expect((await Promise.all(jobs)).every(Boolean)).toBe(true);
    expect(times).toHaveLength(30);
    expect(times.slice(1).every((time, i) => time - times[i] >= 600)).toBe(
      true
    );
  });

  it("honors HTTP-date Retry-After", async () => {
    vi.setSystemTime(new Date("2026-10-31T00:00:00Z"));
    const times: number[] = [];
    sendMock.mockImplementation(async () => {
      times.push(Date.now());
      return times.length === 1
        ? {
            data: null,
            error: { name: "rate_limit_exceeded", statusCode: 429 },
            headers: { "retry-after": "Sat, 31 Oct 2026 00:00:05 GMT" },
          }
        : { data: { id: "accepted" }, error: null };
    });
    const job = sendMail("to@example.com", "subject", "body");
    await vi.runAllTimersAsync();
    expect(await job).toBe(true);
    expect(times[1] - times[0]).toBe(5000);
  });

  it("honors 429 Retry-After, reuses the key and pauses later mail", async () => {
    const times: number[] = [];
    sendMock.mockImplementation(async () => {
      times.push(Date.now());
      return times.length === 1
        ? {
            error: { name: "rate_limit_exceeded", statusCode: 429 },
            data: null,
            headers: { "retry-after": "3" },
          }
        : { data: { id: "accepted" }, error: null };
    });
    const first = sendMail("first@example.com", "subject", "body");
    const second = sendMail("second@example.com", "subject", "body");
    await vi.runAllTimersAsync();
    expect(await first).toBe(true);
    expect(await second).toBe(true);
    expect(times[1] - times[0]).toBe(3000);
    expect(times[2] - times[1]).toBeGreaterThanOrEqual(600);
    expect(sendMock.mock.calls[0][1]).toEqual(sendMock.mock.calls[1][1]);
    expect(sendMock.mock.calls[2][1]).not.toEqual(sendMock.mock.calls[0][1]);
  });

  it("stops after bounded retries and continues with the next message", async () => {
    sendMock.mockResolvedValue({
      data: null,
      error: { name: "rate_limit_exceeded", statusCode: 429 },
    });
    const failed = sendMail("first@example.com", "subject", "body");
    await vi.runAllTimersAsync();
    expect(await failed).toBe(false);
    expect(sendMock).toHaveBeenCalledTimes(5);
    sendMock.mockResolvedValue({ data: { id: "next" }, error: null });
    const next = sendMail("next@example.com", "subject", "body");
    await vi.runAllTimersAsync();
    expect(await next).toBe(true);
  });

  it("does not retry quota or authentication errors", async () => {
    for (const name of ["daily_quota_exceeded", "restricted_api_key"]) {
      sendMock.mockResolvedValue({
        data: null,
        error: {
          name,
          statusCode: name === "daily_quota_exceeded" ? 429 : 403,
        },
      });
      const result = sendMail("to@example.com", "subject", "body");
      await vi.runAllTimersAsync();
      expect(await result).toBe(false);
    }
    expect(sendMock).toHaveBeenCalledTimes(2);
  });

  it("retries explicit temporary server errors with the same key", async () => {
    sendMock
      .mockResolvedValueOnce({
        data: null,
        error: { name: "internal_server_error", statusCode: 500 },
      })
      .mockResolvedValue({ data: { id: "recovered" }, error: null });
    const job = sendMail("to@example.com", "subject", "body");
    await vi.runAllTimersAsync();
    expect(await job).toBe(true);
    expect(sendMock.mock.calls[0][1]).toEqual(sendMock.mock.calls[1][1]);
  });
});
