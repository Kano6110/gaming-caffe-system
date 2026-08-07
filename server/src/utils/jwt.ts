import jwt, { SignOptions } from "jsonwebtoken";

const JWT_SECRET: string = process.env.JWT_SECRET ?? "";
if (!JWT_SECRET) {
  // Fail loudly at startup rather than silently signing with `undefined`
  throw new Error("JWT_SECRET is not set in environment variables");
}

// Short-lived on purpose: the JWT is a cache of "this session was valid
// as of N minutes ago", not the ultimate source of truth. The Session
// table in Postgres is the source of truth.
//
// Cast to SignOptions["expiresIn"] because @types/jsonwebtoken types this
// as a branded `StringValue` (e.g. "15m", "1h"), not a plain `string` —
// process.env values are always typed `string`, so TS can't verify the
// format at compile time. Just make sure JWT_ACCESS_TTL is a valid
// "ms"-style string like "15m", "1h", "7d", or a number of seconds.
const ACCESS_TOKEN_TTL = (process.env.JWT_ACCESS_TTL ??
  "15m") as SignOptions["expiresIn"];

export interface AccessTokenPayload {
  userId: string;
  role: "ADMIN" | "STAFF" | "USER";
  sessionId: string;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  const options: SignOptions = { expiresIn: ACCESS_TOKEN_TTL };
  return jwt.sign(payload, JWT_SECRET, options);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  // Throws if invalid/expired — let the caller decide how to respond
  return jwt.verify(token, JWT_SECRET as string) as AccessTokenPayload;
}