import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { getSessionCookie, verifySessionToken } from "./auth";
import * as db from "../db";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  const cookie = getSessionCookie(opts.req);
  if (cookie) {
    const session = await verifySessionToken(cookie);
    if (session) {
      const found = await db.getUserById(session.userId);
      if (found && found.status === "active") {
        user = found;
        const lastActiveAt = found.lastActiveAt?.getTime() ?? 0;
        if (Date.now() - lastActiveAt >= 24 * 60 * 60 * 1000) {
          await db.updateLastActiveAt(found.id);
        }
      }
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
