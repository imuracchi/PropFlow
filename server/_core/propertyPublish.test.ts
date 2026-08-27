import { beforeEach, describe, expect, it, vi } from "vitest";

const getByTask = vi.fn();
const complete = vi.fn();
const removeJob = vi.fn();
const getProperty = vi.fn();

vi.mock("../db", () => ({
  getPropertyByScheduleTaskUid: getByTask,
  completeScheduledPropertyPublish: complete,
  getPropertyById: getProperty,
  getPropertyExcludedUserIds: vi.fn(),
  markPropertyLineNotified: vi.fn(),
  getActiveUserEmailsForNotify: vi.fn(),
  listActiveUsers: vi.fn(),
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
});
