import { describe, expect, it } from "vitest";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";

function createAnonymousContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("public SNS PDF access", () => {
  it("rejects an unauthenticated file download", async () => {
    const caller = appRouter.createCaller(createAnonymousContext());

    await expect(caller.property.downloadFile({ fileId: 1 })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("rejects unauthenticated external-share creation", async () => {
    const caller = appRouter.createCaller(createAnonymousContext());
    await expect(caller.externalFileShare.create({ fileIds: [1] })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("requires explicit prohibition acceptance before emailing a download URL", async () => {
    const caller = appRouter.createCaller(createAnonymousContext());
    await expect(caller.externalFileShare.requestDownloadLink({
      token: "a".repeat(48),
      email: "viewer@example.jp",
      acceptedProhibitions: false,
    } as any)).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("requires the public-document notice to be accepted", async () => {
    const caller = appRouter.createCaller(createAnonymousContext());
    await expect(caller.property.requestPublicDocument({
      propertyId: 1,
      email: "viewer@example.jp",
      acceptedNotice: false,
      acceptedTransactionNotice: true,
    } as any)).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("requires the property and transaction notice to be accepted", async () => {
    const caller = appRouter.createCaller(createAnonymousContext());
    await expect(caller.property.requestPublicDocument({
      propertyId: 1,
      email: "viewer@example.jp",
      acceptedNotice: true,
      acceptedTransactionNotice: false,
    } as any)).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("accepts an anonymous public list event without requiring login", async () => {
    const caller = appRouter.createCaller(createAnonymousContext());
    await expect(caller.property.recordPublicEvents({
      visitorId: "00000000-0000-4000-8000-000000000001",
      referrerDomain: "example.com",
      events: [{ eventType: "list_view" }],
    })).resolves.toEqual({ success: true });
  });

  it("rejects a property event that has no property id", async () => {
    const caller = appRouter.createCaller(createAnonymousContext());
    await expect(caller.property.recordPublicEvents({
      visitorId: "00000000-0000-4000-8000-000000000002",
      events: [{ eventType: "document_click" }],
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
