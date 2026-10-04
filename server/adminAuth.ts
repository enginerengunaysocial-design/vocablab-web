import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";

export const ADMIN_USERNAME = "ereng_admin";
export const ADMIN_PASSWORD = "ereng6776";
export const ADMIN_COOKIE = "vocablab_admin";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;
const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || "vocablab-admin-session-secret";

function signature(payload: string) {
  return createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");
}

function readCookie(req: Request, name: string) {
  const header = req.headers.cookie || "";
  const pair = header.split(";").map(item => item.trim()).find(item => item.startsWith(`${name}=`));
  return pair ? decodeURIComponent(pair.slice(name.length + 1)) : "";
}

export function createAdminToken() {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = `${ADMIN_USERNAME}.${expiresAt}`;
  return `${payload}.${signature(payload)}`;
}

export function isAdminRequest(req: Request) {
  const token = readCookie(req, ADMIN_COOKIE);
  const [username, expiresAtRaw, providedSignature] = token.split(".");
  if (!username || !expiresAtRaw || !providedSignature || username !== ADMIN_USERNAME) return false;
  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;
  const expected = signature(`${username}.${expiresAtRaw}`);
  if (providedSignature.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(providedSignature), Buffer.from(expected));
}

export function setAdminCookie(res: Response) {
  res.cookie(ADMIN_COOKIE, createAdminToken(), {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: true,
    maxAge: SESSION_TTL_MS,
  });
}

export function clearAdminCookie(res: Response) {
  res.clearCookie(ADMIN_COOKIE, {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: true,
  });
}
