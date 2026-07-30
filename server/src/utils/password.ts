import bcrypt from "bcrypt";

// Keep this configurable via env so you can tune cost vs. login speed
// without a code change. 10-12 is a reasonable range for 2026 hardware.
const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS ?? 12);

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}