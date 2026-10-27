import { beforeEach, describe, expect, it, vi } from "vitest";
import { isSoldPolicyActive, matchesSoldList, soldFileDeadline } from "../shared/soldRetention";

const mocks = vi.hoisted(() => ({
  select: vi.fn(), transaction: vi.fn(), locked: vi.fn(),
  deleteWhere: vi.fn(), updateWhere: vi.fn(),
}));
vi.mock("drizzle-orm/mysql2", () => ({ drizzle: () => ({
  select: mocks.select, transaction: mocks.transaction,
}) }));
import { purgeExpiredSoldPropertyFiles } from "./db";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.DATABASE_URL = "mysql://unused-test-only";
  mocks.select.mockReturnValue({ from: () => ({ where: () => ({ limit: async () => [{ id: 1 }] }) }) });
  mocks.locked.mockResolvedValue([{ id: 1 }]);
  mocks.transaction.mockImplementation(async callback => callback({
    select: () => ({ from: () => ({ where: () => ({ for: mocks.locked }) }) }),
    delete: () => ({ where: mocks.deleteWhere }),
    update: () => ({ set: () => ({ where: mocks.updateWhere }) }),
  }));
});

describe("announced sold property retention", () => {
  it("activates exactly at midnight November 4 in Japan", () => {
    expect(isSoldPolicyActive(new Date("2026-11-03T14:59:59.999Z"))).toBe(false);
    expect(isSoldPolicyActive(new Date("2026-11-03T15:00:00Z"))).toBe(true);
  });
  it("gives previously sold properties until the announced start", () => {
    expect(soldFileDeadline(new Date("2026-10-01T00:00:00+09:00")).toISOString())
      .toBe("2026-11-03T15:00:00.000Z");
  });
  it("keeps a full week for a sale during the notice period", () => {
    expect(soldFileDeadline(new Date("2026-11-02T12:00:00+09:00")).toISOString())
      .toBe("2026-11-09T03:00:00.000Z");
  });
  it("never touches the database before activation", async () => {
    expect(await purgeExpiredSoldPropertyFiles(new Date("2026-11-03T14:59:59.999Z"))).toBe(0);
    expect(mocks.select).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("cleans files and metadata together after eligibility is locked and rechecked", async () => {
    expect(await purgeExpiredSoldPropertyFiles(new Date("2026-11-04T00:00:00+09:00"))).toBe(1);
    expect(mocks.locked).toHaveBeenCalledWith("update");
    expect(mocks.deleteWhere).toHaveBeenCalledOnce();
    expect(mocks.updateWhere).toHaveBeenCalledOnce();
  });
  it("does not delete if a property no longer qualifies when locked", async () => {
    mocks.locked.mockResolvedValue([]);
    expect(await purgeExpiredSoldPropertyFiles(new Date("2026-11-04T00:00:00+09:00"))).toBe(0);
    expect(mocks.deleteWhere).not.toHaveBeenCalled();
    expect(mocks.updateWhere).not.toHaveBeenCalled();
  });
  it("leaves the default list unchanged before activation", () => {
    expect(matchesSoldList("sold", false, false)).toBe(true);
  });
  it("shows sold properties only through the sold filter after activation", () => {
    expect(matchesSoldList("sold", false, true)).toBe(false);
    expect(matchesSoldList("sold", true, true)).toBe(true);
    expect(matchesSoldList("available", true, true)).toBe(false);
    expect(matchesSoldList("negotiating", false, true)).toBe(true);
  });
});
