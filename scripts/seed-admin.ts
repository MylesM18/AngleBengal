/**
 * Seeds or updates the single admin account for the login wall (DECISIONS.md
 * D-105). No public signup exists; this script is the only way accounts are
 * created. Run from the repo root:
 *
 *   ADMIN_USERNAME=you ADMIN_PASSWORD='your-password' npx tsx scripts/seed-admin.ts
 *
 * Idempotent: re-running with the same username replaces the password hash.
 * The password is bcrypt-hashed (cost 12) and never printed or stored raw.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

/**
 * tsx does not load .env on its own (the Prisma CLI does, this script is not
 * the CLI). Minimal loader: KEY=VALUE lines, optional quotes, existing
 * process.env wins so inline overrides keep working.
 */
function loadDotEnv(): void {
  let raw: string;
  try {
    raw = readFileSync(path.join(process.cwd(), ".env"), "utf8");
  } catch {
    return;
  }
  for (const line of raw.split("\n")) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = rawValue.replace(/^["']|["']$/g, "");
  }
}

async function main(): Promise<void> {
  loadDotEnv();

  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) {
    console.error(
      "Set ADMIN_USERNAME and ADMIN_PASSWORD in the environment, for example:\n" +
        "  ADMIN_USERNAME=you ADMIN_PASSWORD='your-password' npx tsx scripts/seed-admin.ts",
    );
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("ADMIN_PASSWORD must be at least 8 characters.");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.upsert({
      where: { username },
      update: { passwordHash },
      create: { username, passwordHash },
    });
    console.log(`Admin account "${username}" is ready.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("seed-admin failed:", error);
  process.exit(1);
});
