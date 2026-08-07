import { ComputerMode, Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";

interface RegisterInput {
  machineId: string;
  ipAddress: string;
  name?: string; // only used as a default on first creation, never on update
}

interface HeartbeatInput {
  machineId: string;
  ipAddress: string;
}

interface UpdateComputerInput {
  name?: string;
  mode?: ComputerMode;
}

// A named error class, same pattern as AuthError in auth.service.ts.
// This lets the controller distinguish "client sent a heartbeat for a
// machine that was never registered" (404) from a genuine server crash (500).
export class ComputerNotFoundError extends Error {
  constructor(machineId: string) {
    super(`No computer registered with machineId "${machineId}"`);
  }
}

// A heartbeat older than this is considered stale — the PC is reported as
// OFFLINE even though its row still exists. Tune this relative to how often
// the Launcher actually sends heartbeats (e.g. 2-3x the heartbeat interval,
// so a single dropped packet doesn't flip a PC's status incorrectly).
const HEARTBEAT_STALE_MS = 60_000; // 60 seconds

export type DerivedStatus =
  | "MAINTENANCE"
  | "DISABLED"
  | "OFFLINE"
  | "IN_USE"
  | "AVAILABLE";

/**
 * The single source of truth for the status-precedence table we designed:
 * mode short-circuits everything, then heartbeat recency, then session
 * presence. Every endpoint that returns a computer's status MUST call this
 * — never re-derive it inline — so REST responses and (later) Socket.IO
 * broadcasts can never drift apart.
 */
export function deriveStatus(computer: {
  mode: ComputerMode;
  lastHeartbeat: Date | null;
  hasActiveSession: boolean;
}): DerivedStatus {
  if (computer.mode === "MAINTENANCE") return "MAINTENANCE";
  if (computer.mode === "DISABLED") return "DISABLED";

  const isOnline =
    computer.lastHeartbeat !== null &&
    Date.now() - computer.lastHeartbeat.getTime() < HEARTBEAT_STALE_MS;

  if (!isOnline) return "OFFLINE";
  return computer.hasActiveSession ? "IN_USE" : "AVAILABLE";
}

// Shared query fragment: pull only the one active session (if any) alongside
// each computer, so we can compute `hasActiveSession` without a second
// round-trip per row.
const withActiveSession = {
  sessions: {
    where: { endedAt: null, expiresAt: { gt: new Date() } },
    take: 1,
  },
} satisfies Prisma.ComputerInclude;

function toComputerWithStatus<
  T extends { mode: ComputerMode; lastHeartbeat: Date | null; sessions: unknown[] }
>(computer: T) {
  const { sessions, ...rest } = computer;
  const hasActiveSession = sessions.length > 0;
  return {
    ...rest,
    status: deriveStatus({
      mode: computer.mode,
      lastHeartbeat: computer.lastHeartbeat,
      hasActiveSession,
    }),
    currentSession: hasActiveSession ? sessions[0] : null,
  };
}

export async function listComputers() {
  const computers = await prisma.computer.findMany({
    include: withActiveSession,
    orderBy: { name: "asc" },
  });
  return computers.map(toComputerWithStatus);
}

export async function getComputerById(id: string) {
  const computer = await prisma.computer.findUnique({
    where: { id },
    include: withActiveSession,
  });
  if (!computer) return null;
  return toComputerWithStatus(computer);
}

/**
 * Admin-only edit. Only `name` and `mode` are accepted — this is the
 * enforcement point for "Launcher can never rename or change mode itself."
 * Nothing here touches ipAddress or lastHeartbeat; those remain exclusively
 * Launcher-owned via register/heartbeat.
 */
export async function updateComputer(id: string, input: UpdateComputerInput) {
  try {
    return await prisma.computer.update({
      where: { id },
      data: input,
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      throw new ComputerNotFoundError(id);
    }
    throw err;
  }
}

/**
 * Deleting a computer relies on the schema's onDelete: SetNull on
 * Session.computerId — historical sessions survive with computerId set to
 * null, preserving revenue/usage reports. This function does nothing extra
 * to enforce that; it's guaranteed at the database level by the migration.
 */
export async function deleteComputer(id: string) {
  try {
    await prisma.computer.delete({ where: { id } });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      throw new ComputerNotFoundError(id);
    }
    throw err;
  }
}

/**
 * Idempotent registration: a Launcher calling this repeatedly (e.g. every
 * app restart) should never create duplicate rows for the same physical
 * machine. Upsert keyed on `machineId` — the durable identity the Launcher
 * generated and persisted locally at first install.
 *
 * `name` is intentionally excluded from the update branch: once a computer
 * exists, only an admin (via PATCH /computers/:id) may rename it. See the
 * design discussion — this prevents a re-registering Launcher from silently
 * stomping a label staff already set.
 */
export async function registerComputer(input: RegisterInput) {
  const { machineId, ipAddress, name } = input;

  return prisma.computer.upsert({
    where: { machineId },
    update: {
      ipAddress,
      lastHeartbeat: new Date(), // registering counts as a heartbeat too
    },
    create: {
      machineId,
      ipAddress,
      name: name ?? machineId, // fallback so `name` is never empty on first creation
      lastHeartbeat: new Date(),
    },
  });
}

/**
 * Heartbeat deliberately uses `.update()`, not `.upsert()` — unlike register,
 * a heartbeat for an unknown machineId is treated as a client error, not
 * "create it for me." This forces a Launcher that's out of sync (e.g. DB was
 * reset) to go back through /register explicitly, rather than heartbeat
 * silently recreating rows with no `name` context behind the scenes.
 *
 * `mode` is NEVER touched here — same rule as `name` in register. Heartbeat
 * fires every few seconds; if it could reset MAINTENANCE, an admin's flag
 * would get wiped almost immediately after being set.
 */
export async function heartbeatComputer(input: HeartbeatInput) {
  const { machineId, ipAddress } = input;

  try {
    return await prisma.computer.update({
      where: { machineId },
      data: {
        ipAddress,
        lastHeartbeat: new Date(),
      },
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      throw new ComputerNotFoundError(machineId);
    }
    throw err;
  }
}