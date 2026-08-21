import { PrismaClient } from "@prisma/client";

/**
 * Prisma client singleton. Next dev reloads modules on every edit, so without
 * caching on globalThis each reload would open another connection pool.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
