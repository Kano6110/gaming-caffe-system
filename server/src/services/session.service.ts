import crypto from "crypto";
import type { Prisma } from "../generated/prisma/client";
import { SessionEndReason } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";

const SESSION_TTL_MS = 1000 * 60 * 60 * 24; // 24h absolute session lifetime (safety net)

export async function createSession(userId: string, computerId?: string) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  return prisma.$transaction(async (tx) => {
    // End any existing active session for this user first — one active
    // session per user, enforced here rather than at the DB level, since
    // "only one row where endedAt IS NULL" isn't expressible as a simple
    // unique constraint.
    const existing = await tx.session.findFirst({
      where: { userId, endedAt: null },
    });

    if (existing) {
      await endSessionInternal(tx, existing, "SUPERSEDED_BY_NEW_LOGIN");
    }

    return tx.session.create({
      data: { userId, computerId, token, expiresAt },
    });
  });
}

/**
 * A session is valid if it exists, hasn't been ended, and hasn't blown past
 * its absolute 24h cap. Note this does NOT check playtime remaining — that's
 * the sweep job's responsibility (see session-sweep.job.ts), not something
 * checked on every single authenticated request, since it requires an extra
 * User lookup and would add latency to every API call for no benefit — the
 * sweep job already guarantees playtime-expired sessions get endedAt set
 * within one sweep interval.
 */
export async function isSessionValid(sessionId: string): Promise<boolean> {
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) return false;
  if (session.endedAt !== null) return false;
  if (session.expiresAt < new Date()) return false;
  return true;
}

/**
 * The core billing operation. Deducts only ACTUAL elapsed time from the
 * user's balance, capped at what they had — this is what makes "logout
 * early preserves remaining time" and "recharging mid-session" both work
 * correctly with zero special-case code, per our design discussion.
 *
 * Wrapped in a transaction: reading playtimeSecs, computing the deduction,
 * and writing both the User and Session rows must happen atomically, or a
 * concurrent request (e.g. the sweep job and a manual admin-end racing)
 * could double-deduct.
 */
export async function endSession(sessionId: string, reason: SessionEndReason) {
  return prisma.$transaction(async (tx) => {
    const session = await tx.session.findUnique({ where: { id: sessionId } });
    if (!session) return null;
    if (session.endedAt !== null) return session; // already ended — no-op, not an error

    return endSessionInternal(tx, session, reason);
  });
}

// Shared by createSession's supersede path and the public endSession —
// keeps the billing math in exactly one place.
async function endSessionInternal(
  tx: Prisma.TransactionClient,
  session: { id: string; userId: string; startedAt: Date },
  reason: SessionEndReason
) {
  const user = await tx.user.findUniqueOrThrow({ where: { id: session.userId } });

  const elapsedSeconds = Math.floor((Date.now() - session.startedAt.getTime()) / 1000);
  const deduction = Math.min(elapsedSeconds, user.playtimeSecs);

  await tx.user.update({
    where: { id: user.id },
    data: { playtimeSecs: user.playtimeSecs - deduction },
  });

  return tx.session.update({
    where: { id: session.id },
    data: { endedAt: new Date(), endReason: reason },
  });
}

/** Used by the admin dashboard's "force end session" button. */
export async function endActiveSessionForUser(userId: string, reason: SessionEndReason) {
  const session = await prisma.session.findFirst({ where: { userId, endedAt: null } });
  if (!session) return null;
  return endSession(session.id, reason);
}

/**
 * Live remaining-time calculation. Deliberately NOT stored anywhere — it's
 * always computed fresh from (current playtimeSecs) - (elapsed since start),
 * so a mid-session recharge (playtimeSecs increases) is reflected instantly
 * on the next read with no extra logic needed.
 */
export async function getRemainingSeconds(sessionId: string): Promise<number | null> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { user: { select: { playtimeSecs: true } } },
  });
  if (!session || session.endedAt !== null) return null;

  const elapsedSeconds = Math.floor((Date.now() - session.startedAt.getTime()) / 1000);
  return Math.max(0, session.user.playtimeSecs - elapsedSeconds);
}