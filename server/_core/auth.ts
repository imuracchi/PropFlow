import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { SignJWT, jwtVerify } from "jose";
import { parse as parseCookieHeader } from "cookie";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { ENV } from "./env";
import type { Request } from "express";

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${buf.toString("hex")}`;
}

export async function verifyPassword(stored: string, supplied: string): Promise<boolean> {
  const [salt, hash] = stored.split(":");
  const buf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(Buffer.from(hash, "hex"), buf);
}

function getSecret() {
  return new TextEncoder().encode(ENV.cookieSecret);
}

export async function createSessionToken(userId: number, openId: string): Promise<string> {
  const expiresAt = Math.floor((Date.now() + ONE_YEAR_MS) / 1000);
  return new SignJWT({ userId, openId })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(expiresAt)
    .sign(getSecret());
}

export async function verifySessionToken(token: string): Promise<{ userId: number; openId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });
    const userId = payload.userId as number;
    const openId = payload.openId as string;
    if (!userId || !openId) return null;
    return { userId, openId };
  } catch {
    return null;
  }
}

export function getSessionCookie(req: Request): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  const parsed = parseCookieHeader(header);
  return parsed[COOKIE_NAME];
}
