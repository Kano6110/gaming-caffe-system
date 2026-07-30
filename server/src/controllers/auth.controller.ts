import { Request, Response } from "express";
import { z } from "zod";
import { registerUser, login, AuthError } from "../services/auth.service";
import { revokeSession } from "../services/session.service";

const registerSchema = z.object({
  username: z.string().min(3).max(32),
  password: z.string().min(8),
  role: z.enum(["ADMIN",  "USER"]).optional(),
});

const loginSchema = z.object({
  username: z.string(),
  password: z.string(),
  computerId: z.string().uuid().optional(),
});

export async function registerHandler(req: Request, res: Response) {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const user = await registerUser(
      parsed.data.username,
      parsed.data.password,
      parsed.data.role
    );
    return res.status(201).json({ user });
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error("registerHandler error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function loginHandler(req: Request, res: Response) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const { user, accessToken } = await login(
      parsed.data.username,
      parsed.data.password,
      parsed.data.computerId
    );
    return res.status(200).json({ user, accessToken });
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error("loginHandler error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function logoutHandler(req: Request, res: Response) {
  // req.user is set by requireAuth middleware
  if (!req.user) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  await revokeSession(req.user.sessionId, "logout");
  return res.status(200).json({ message: "Logged out" });
}
