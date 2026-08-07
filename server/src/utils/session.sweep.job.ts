import { prisma } from "../lib/prisma";
import { endSession } from "../services/session.service";

// How often the sweep runs. 30s means a customer could theoretically play
// up to 30s past zero balance in the worst case — tune this against how
// precise you need billing to be vs. how much load you want on the DB.
const SWEEP_INTERVAL_MS = 30_000;

// Warn when 10 minutes or less remain. This only logs for now — the actual
// push notification to the Client Launcher is a Socket.IO concern we'll
// wire up later. Keeping the detection logic here now means Socket.IO just
// needs to plug into this check, not reimplement it.
const WARNING_THRESHOLD_SECONDS = 10 * 60;

/**
 * Finds every active session, computes live remaining time the same way
 * getRemainingSeconds() does, and:
 *  - ends it with TIME_EXPIRED if remaining time has hit zero
 *  - (TODO, once Socket.IO exists) pushes a low-time warning if under the
 *    threshold and not already warned
 *
 * Note: this recomputes remaining time inline rather than calling
 * getRemainingSeconds() per session in a loop, to avoid N+1 queries when
 * there are many active sessions — one query fetches everything needed.
 */
export async function sweepExpiredSessions(): Promise<void> {
  const activeSessions = await prisma.session.findMany({
    where: { endedAt: null },
    include: { user: { select: { id: true, playtimeSecs: true, username: true } } },
  });

  for (const session of activeSessions) {
    const elapsedSeconds = Math.floor(
      (Date.now() - session.startedAt.getTime()) / 1000
    );
    const remainingSeconds = session.user.playtimeSecs - elapsedSeconds;

    if (remainingSeconds <= 0) {
      await endSession(session.id, "TIME_EXPIRED");
      console.log(
        `[session-sweep] Ended session ${session.id} for user "${session.user.username}" — time expired`
      );
      continue;
    }

    if (remainingSeconds <= WARNING_THRESHOLD_SECONDS) {
      // TODO: once Socket.IO is wired up, emit a "low time" event to this
      // session's computerId here instead of just logging. Consider adding
      // a `lastWarnedAt` field to Session if you want to avoid re-warning
      // every single sweep interval once under the threshold.
      console.log(
        `[session-sweep] User "${session.user.username}" has ${remainingSeconds}s remaining`
      );
    }
  }
}

let sweepHandle: ReturnType<typeof setInterval> | null = null;

/** Call once at server startup. */
export function startSessionSweep(): void {
  if (sweepHandle) return; // idempotent — don't double-start if called twice
  sweepHandle = setInterval(() => {
    sweepExpiredSessions().catch((err) => {
      console.error("[session-sweep] sweep failed:", err);
    });
  }, SWEEP_INTERVAL_MS);
}

export function stopSessionSweep(): void {
  if (sweepHandle) clearInterval(sweepHandle);
  sweepHandle = null;
}