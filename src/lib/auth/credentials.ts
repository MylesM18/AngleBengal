import "server-only";

import bcrypt from "bcryptjs";

import { prisma } from "@/lib/db";

/**
 * Hash of a random throwaway string, compared against when the username does
 * not exist so both failure paths cost one bcrypt compare. Never matches a
 * real password; the result is discarded unless a user row was found.
 */
const PHANTOM_HASH = "$2b$12$cqeAYCYjS.q3jWoT0eYijuQ8AZM.bb4.mBpq926umiMhyw2Gw3Vfm";

/** Returns the canonical username on a match, null on any failure. */
export async function verifyCredentials(
  username: string,
  password: string,
): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { username } });
  const matches = await bcrypt.compare(password, user?.passwordHash ?? PHANTOM_HASH);
  return matches && user ? user.username : null;
}
