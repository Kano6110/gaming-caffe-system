import { Request, Response, NextFunction } from "express";

const AGENT_SECRET = process.env.AGENT_SECRET;
if (!AGENT_SECRET) {
  throw new Error("AGENT_SECRET is not set in environment variables");
}

/**
 * Verifies the caller is a café PC (not a logged-in user), via a shared
 * secret sent in a custom header. This is a coarse trust boundary, not
 * identity — it proves "this is café infrastructure," not "this is
 * specifically machine X." Machine identity comes from `machineId` in
 * the request body, checked separately in the service layer.
 */
export function requireAgentSecret(req: Request, res: Response, next: NextFunction) {
  const provided = req.headers["x-agent-secret"];

  if (!provided || provided !== AGENT_SECRET) {
    return res.status(401).json({ error: "Invalid or missing agent secret" });
  }

  next();
}