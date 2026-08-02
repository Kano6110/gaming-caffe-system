import { prisma } from "../lib/prisma";
import crypto from "crypto";

const SESSION_TTL_MS = 1000 * 60 * 60 * 24;; // 24h absolute session lifetime

/**
 * Creates a new session for a user, revoking any existing active session
 * first. This is what enforces "one user can only have one active session."
 *
 * Wrapped in a transaction so there's never a window where two sessions
 * are simultaneously active for the same user, even under concurrent
 * login attempts.
 */
export async function createSession(userId: string, computerId?: string) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  return prisma.$transaction(async (tx) => {
    await tx.session.updateMany({
      where: { userId, isRevoked: false },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
        revokedReason: "superseded_by_new_login",
      },
    });

    return tx.session.create({
      data: { userId, computerId, token, expiresAt },
    });
  });
}

/**
 * Validates that a session is still usable: exists, not revoked,
 * not expired. Call this on every authenticated request, not just at
 * login — this is what lets you force-logout someone mid-session.
 */
export async function isSessionValid(sessionId: string): Promise<boolean> {
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) return false;
  if (session.isRevoked) return false;
  if (session.expiresAt < new Date()) return false;
  return true;
}

export async function revokeSession(
  sessionId: string,
  reason: string
): Promise<void> {
  await prisma.session.updateMany({
    where: { id: sessionId, isRevoked: false },
    data: { isRevoked: true, revokedAt: new Date(), revokedReason: reason },
  });
}

/** Used by the admin dashboard's "force logout" button. */
export async function revokeAllSessionsForUser(
  userId: string,
  reason: string
): Promise<void> {
  await prisma.session.updateMany({
    where: { userId, isRevoked: false },
    data: { isRevoked: true, revokedAt: new Date(), revokedReason: reason },
  });
}