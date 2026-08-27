import { beforeEach, describe, expect, it, vi } from "vitest";

const getByTask = vi.fn();
const complete = vi.fn();
const removeJob = vi.fn();
const getProperty = vi.fn();
const getDue = vi.fn();
const claim = vi.fn();
const claimNow = vi.fn();

vi.mock("../db", () => ({
  getPropertyByScheduleTaskUid: getByTask,
  completeScheduledPropertyPublish: complete,
  getPropertyById: getProperty,
  getPropertyExcludedUserIds: vi.fn(),
  markPropertyLineNotified: vi.fn(),
  getActiveUserEmailsForNotify: vi.fn(),
  listActiveUsers: vi.fn(),
  getDueScheduledProperties: getDue,
  claimScheduledPropertyPublish: claim,
  claimScheduledPropertyPublishNow: claimNow,
}));
vi.mock("./heartbeat", () => ({ deleteHeartbeatJob: removeJob }));
vi.mock("./mail", () => ({ sendMail: vi.fn() }));
vi.mock("./line", () => ({ buildPropertyFlexMessage: vi.fn(), sendLineBroadcast: vi.fn() }));
vi.mock("./webpush", () => ({ sendPushToUsers: vi.fn() }));

describe("executeScheduledPropertyPublish", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    removeJob.mockResolvedValue(undefined);
  });

  it("publishes a silent reservation once and removes its scheduler job", async () => {
    getByTask.mockResolvedValue({ id: 42, published: 0, scheduledPublishNotify: 0 });
    const { executeScheduledPropertyPublish } = await import("./propertyPublish");
    await expect(executeScheduledPropertyPublish("task-42")).resolves.toBe(42);
    expect(complete).toHaveBeenCalledOnce();
    expect(getProperty).not.toHaveBeenCalled();
    expect(removeJob).toHaveBeenCalledWith("task-42", "");
  });

  it("does nothing when the reservation no longer exists", async () => {
    getByTask.mockResolvedValue(null);
    const { executeScheduledPropertyPublish } = await import("./propertyPublish");
    await expect(executeScheduledPropertyPublish("missing")).resolves.toBeNull();
    expect(complete).not.toHaveBeenCalled();
    expect(removeJob).not.toHaveBeenCalled();
  });

  it("claims each due silent reservation once without sending notifications", async () => {
    getDue.mockResolvedValue([{ id: 51, scheduledPublishNotify: 0 }]);
    claim.mockResolvedValue(true);
    const { executeDueScheduledPropertyPublishes } = await import("./propertyPublish");
    await expect(executeDueScheduledPropertyPublishes()).resolves.toBe(1);
    expect(claim).toHaveBeenCalledWith(51);
    expect(getProperty).not.toHaveBeenCalled();
  });

  it("does not notify when another worker already claimed the reservation", async () => {
    getDue.mockResolvedValue([{ id: 52, scheduledPublishNotify: 1 }]);
    claim.mockResolvedValue(false);
    const { executeDueScheduledPropertyPublishes } = await import("./propertyPublish");
    await expect(executeDueScheduledPropertyPublishes()).resolves.toBe(0);
    expect(getProperty).not.toHaveBeenCalled();
  });
});
