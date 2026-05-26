import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

const isProd = process.env.NODE_ENV === "production";

export const prisma = globalForPrisma.prisma || new PrismaClient({
  log: isProd ? ["error", "warn"] : ["error", "warn", "query"],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

if (!isProd) globalForPrisma.prisma = prisma;

export default prisma;
