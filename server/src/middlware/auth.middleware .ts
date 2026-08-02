import { Request, Response, NextFunction } from "express";
import { verifyAccessToken, AccessTokenPayload } from "../utils/jwt";
import { isSessionValid } from "../services/session.service";

// Extend Express's Request type so `req.user` is typed downstream
declare global {
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
    }
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or malformed authorization header" });
  }

  const token = header.slice("Bearer ".length);

  let payload: AccessTokenPayload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  // This DB check is what makes force-logout and "time expired" actually
  // take effect immediately, instead of waiting up to 15 min for the JWT
  // to naturally expire.
  const valid = await isSessionValid(payload.sessionId);
  if (!valid) {
    return res.status(401).json({ error: "Session has been revoked or expired" });
  }

  req.user = payload;
  next();
}

/** Role gate — use after requireAuth, e.g. requireRole("ADMIN") */
export function requireRole(...allowed: Array<"ADMIN" | "USER">) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !allowed.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
}