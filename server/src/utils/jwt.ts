import jwt, { SignOptions } from "jsonwebtoken";

const JWT_SECRET: string = process.env.JWT_SECRET ?? "";
if (!JWT_SECRET) {
  // Fail loudly at startup rather than silently signing with `undefined`
  throw new Error("JWT_SECRET is not set in environment variables");
}


const ACCESS_TOKEN_TTL = (process.env.JWT_ACCESS_TTL ??
  "15m") as SignOptions["expiresIn"];

export interface AccessTokenPayload {
  userId: string;
  role: "ADMIN" | "USER" ;
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