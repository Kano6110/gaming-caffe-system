import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

// Prisma 7 requires an explicit driver adapter instead of connecting
// automatically from DATABASE_URL — this is that adapter for Postgres.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

// Single shared instance across the whole app. Importing `new PrismaClient()`
// separately in every file (as auth.service.ts and session.service.ts did)
// creates a new connection pool each time, which will exhaust your Postgres
// connections under load. Import `prisma` from here everywhere instead.
export const prisma = new PrismaClient({ adapter });