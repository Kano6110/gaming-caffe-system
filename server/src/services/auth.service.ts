import { Role } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { hashPassword, verifyPassword } from "../utils/password";
import { signAccessToken } from "../utils/jwt";
import { createSession } from "./session.service";

// Fields safe to ever send to the client. Never spread the raw Prisma
// user object into a response — that's how passwordHash leaks.
const SAFE_USER_SELECT = {
  id: true,
  username: true,
  role: true,
  playtimeSecs: true,
  isActive: true,
  createdAt: true,
} as const;

export class AuthError extends Error {
  constructor(message: string, public statusCode = 401) {
    super(message);
  }
}

/**
 * Admin-only: creates a customer or staff account.
 * (Enforce the "who's allowed to call this" check in the controller/route,
 * not here — this service just does the work.)
 */
export async function registerUser(
  username: string,
  plainPassword: string,
  role: Role = "USER"
) {
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    throw new AuthError("Username already taken", 409);
  }

  const passwordHash = await hashPassword(plainPassword);

  return prisma.user.create({
    data: { username, passwordHash, role },
    select: SAFE_USER_SELECT,
  });
}

/**
 * Logs a user in: verifies credentials, enforces business rules,
 * creates a session, and returns a signed access token.
 *
 * computerId is passed when a Client Launcher PC is logging a customer
 * in — used to enforce "one computer can only have one active user."
 */
export async function login(
  username: string,
  plainPassword: string,
  computerId?: string
) {
  const user = await prisma.user.findUnique({ where: { username } });

  // Deliberately vague error message — don't reveal whether the
  // username or the password was wrong, that helps attackers enumerate
  // valid usernames.
  if (!user) throw new AuthError("Invalid username or password");

  if (!user.isActive) {
    throw new AuthError("This account has been disabled", 403);
  }

  const passwordMatches = await verifyPassword(plainPassword, user.passwordHash);
  if (!passwordMatches) throw new AuthError("Invalid username or password");

  if (computerId) {
    const computerOccupied = await prisma.session.findFirst({
      where: { computerId, isRevoked: false, expiresAt: { gt: new Date() } },
    });
    if (computerOccupied) {
      throw new AuthError("This computer is already in use", 409);
    }
  }

  const session = await createSession(user.id, computerId);

  const accessToken = signAccessToken({
    userId: user.id,
    role: user.role,
    sessionId: session.id,
  });

  const { passwordHash: _omit, ...safeUser } = user;
  return { user: safeUser, accessToken };
}