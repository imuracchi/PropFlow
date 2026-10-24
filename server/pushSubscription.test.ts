import { describe, expect, it, vi } from "vitest";
import { ensurePushSubscription } from "../client/src/lib/pushSubscription";

function setup(bytes: number[] | null, unsubscribeResult = true) {
  const existing = {
    endpoint: "https://push.example/old",
    options: { applicationServerKey: bytes === null ? null : new Uint8Array(bytes).buffer },
    unsubscribe: vi.fn().mockResolvedValue(unsubscribeResult),
  };
  const replacement = { endpoint: "https://push.example/new" };
  const manager = {
    getSubscription: vi.fn().mockResolvedValue(existing),
    subscribe: vi.fn().mockResolvedValue(replacement),
  };
  const permission = vi.fn().mockResolvedValue("granted");
  return { existing, replacement, manager, permission };
}

describe("push subscriptions after VAPID rotation", () => {
  it("keeps subscriptions already bound to the current key without prompting", async () => {
    const { existing, manager, permission } = setup([1, 2, 3]);
    expect(await ensurePushSubscription(manager as unknown as PushManager, "AQID", permission))
      .toEqual({ subscription: existing });
    expect(permission).not.toHaveBeenCalled();
    expect(existing.unsubscribe).not.toHaveBeenCalled();
  });

  it.each([[9, 2, 3], null])("renews an old or unavailable application key %j", async bytes => {
    const { existing, replacement, manager, permission } = setup(bytes);
    expect(await ensurePushSubscription(manager as unknown as PushManager, "AQID", permission))
      .toEqual({ subscription: replacement, retiredEndpoint: existing.endpoint });
    expect(existing.unsubscribe).toHaveBeenCalledOnce();
    expect(manager.subscribe).toHaveBeenCalledWith({ userVisibleOnly: true, applicationServerKey: "AQID" });
  });

  it("does not remove an existing subscription when permission is denied", async () => {
    const { existing, manager, permission } = setup([9]);
    permission.mockResolvedValue("denied");
    expect(await ensurePushSubscription(manager as unknown as PushManager, "AQID", permission))
      .toEqual({ subscription: null });
    expect(existing.unsubscribe).not.toHaveBeenCalled();
    expect(manager.subscribe).not.toHaveBeenCalled();
  });

  it("stops if the old subscription cannot be removed", async () => {
    const { manager, permission } = setup([9], false);
    await expect(ensurePushSubscription(manager as unknown as PushManager, "AQID", permission))
      .rejects.toThrow("renewal failed");
    expect(manager.subscribe).not.toHaveBeenCalled();
  });

  it("subscribes a new browser after permission is granted", async () => {
    const { replacement, manager, permission } = setup(null);
    manager.getSubscription.mockResolvedValue(null);
    expect(await ensurePushSubscription(manager as unknown as PushManager, "AQID", permission))
      .toEqual({ subscription: replacement, retiredEndpoint: undefined });
  });
});
