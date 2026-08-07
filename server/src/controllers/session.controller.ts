import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import {
  endSession,
  endActiveSessionForUser,
  getRemainingSeconds,
} from "../services/session.service";

function getIdParam(req: Request): string {
  const { id } = req.params;
  return Array.isArray(id) ? id[0] : id;
}

const endSchema = z.object({
  // Admin ends a specific user's active session by userId (they don't
  // necessarily know the session's internal id from the dashboard).
  userId: z.string().uuid(),
});

/**
 * POST /sessions/end
 * Admin-only: force-ends a user's currently active session.
 * (A user ending their OWN session is just /auth/logout — already built.
 * This endpoint is specifically the admin "kick" action.)
 */
export async function endHandler(req: Request, res: Response) {
  const parsed = endSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const session = await endActiveSessionForUser(parsed.data.userId, "ADMIN_ENDED");
    if (!session) {
      return res.status(404).json({ error: "No active session for this user" });
    }
    return res.status(200).json({ session });
  } catch (err) {
    console.error("endHandler error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * GET /sessions/active
 * Admin/Staff-only: every currently active session, café-wide — this is
 * the dashboard's "who's online right now" view.
 */
export async function activeHandler(_req: Request, res: Response) {
  try {
    const sessions = await prisma.session.findMany({
      where: { endedAt: null },
      include: {
        user: { select: { id: true, username: true } },
        computer: { select: { id: true, name: true } },
      },
      orderBy: { startedAt: "desc" },
    });
    return res.status(200).json({ sessions });
  } catch (err) {
    console.error("activeHandler error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

const historyQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * GET /sessions/history
 * Admin: full paginated history, every user, every ended session.
 * Non-admin (USER): NOT this endpoint — see monthlyTotalHandler below,
 * which is the aggregate-only view a customer is allowed to see.
 */
export async function historyHandler(req: Request, res: Response) {
  const parsed = historyQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { page, pageSize } = parsed.data;

  try {
    const [sessions, total] = await Promise.all([
      prisma.session.findMany({
        where: { endedAt: { not: null } },
        include: {
          user: { select: { id: true, username: true } },
          computer: { select: { id: true, name: true } },
        },
        orderBy: { startedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.session.count({ where: { endedAt: { not: null } } }),
    ]);

    return res.status(200).json({
      sessions,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (err) {
    console.error("historyHandler error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * GET /sessions/me/total
 * Any authenticated user: their own total playtime this calendar month,
 * aggregate only — no per-session detail, per our design ("user can see
 * how much they've played, not more info").
 */
export async function myMonthlyTotalHandler(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const sessions = await prisma.session.findMany({
      where: {
        userId: req.user.userId,
        endedAt: { not: null },
        startedAt: { gte: startOfMonth },
      },
      select: { startedAt: true, endedAt: true },
    });

    const totalSeconds = sessions.reduce((sum, s) => {
      if (!s.endedAt) return sum;
      return sum + Math.floor((s.endedAt.getTime() - s.startedAt.getTime()) / 1000);
    }, 0);

    return res.status(200).json({ totalSeconds, month: startOfMonth.toISOString() });
  } catch (err) {
    console.error("myMonthlyTotalHandler error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * GET /sessions/:id
 * Admin/Staff-only: full detail on one session.
 */
export async function getByIdHandler(req: Request, res: Response) {
  try {
    const session = await prisma.session.findUnique({
      where: { id: getIdParam(req) },
      include: {
        user: { select: { id: true, username: true } },
        computer: { select: { id: true, name: true } },
      },
    });
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    return res.status(200).json({ session });
  } catch (err) {
    console.error("getByIdHandler error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * GET /sessions/:id/remaining
 * The live remaining-time calculation your point #2 needs — computed
 * fresh every call, reflects mid-session recharges automatically.
 */
export async function remainingHandler(req: Request, res: Response) {
  try {
    const remainingSeconds = await getRemainingSeconds(getIdParam(req));
    if (remainingSeconds === null) {
      return res.status(404).json({ error: "Session not found or already ended" });
    }
    return res.status(200).json({ remainingSeconds });
  } catch (err) {
    console.error("remainingHandler error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}