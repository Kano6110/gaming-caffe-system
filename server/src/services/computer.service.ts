import { prisma } from "../lib/prisma";
import { Prisma } from "../generated/prisma/client";
interface RegisterInput {
  machineId: string;
  ipAddress: string;
  name?: string; // only used as a default on first creation, never on update
}

interface HeartbeatInput {
  machineId: string;
  ipAddress: string;
}
export class ComputerNotFoundError extends Error {
  constructor(machineId: string) {
    super(`No computer registered with machineId "${machineId}"`);
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
    throw err; // anything else really is an unexpected server error — rethrow as-is
  }
}