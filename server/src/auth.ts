import type { NextFunction, Request, Response } from "express";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "./env.js";

export type AppUserRole = "admin" | "superadmin";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: AppUserRole;
  picture?: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signToken(user: AuthUser) {
  return jwt.sign(user, env.jwtSecret, { expiresIn: "7d" });
}

export function verifyToken(token: string) {
  return jwt.verify(token, env.jwtSecret) as AuthUser;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;

  if (!token) {
    res.status(401).json({ error: "missing_token" });
    return;
  }

  try {
    req.user = verifyToken(token);
    next();
  } catch {
    res.status(401).json({ error: "invalid_token" });
  }
}

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    if (req.user?.role !== "superadmin") {
      res.status(403).json({ error: "forbidden" });
      return;
    }

    next();
  });
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) return false;

  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, salt, 64);

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
