import "server-only";

import bcrypt from "bcryptjs";

import { BCRYPT_COST } from "@/lib/auth/hashCost";
import { prisma } from "@/lib/db";

/**
 * Hash of a random throwaway string, compared against when the username does
 * not exist so both failure paths cost one bcrypt compare. Never matches a
 * real password; the result is discarded unless a user row was found.
 *
 * Its cost must track BCRYPT_COST. A phantom at a different cost would take
 * measurably longer (or less) than a real compare, which is exactly the
 * "does this username exist" timing signal it exists to hide.
 *
 * Exported only so that invariant can be asserted in a test. It is a hash of
 * a discarded random string, so it is not a secret and matches no password.
 */
export const PHANTOM_HASH = "$2b$10$SqIDTZViOghHobtjufvAWOKz3C55bFOGBM5kBpkVUNRZM8sOQeP2u";

/**
 * Re-hashes a correct password that is stored at some other cost, so an
 * account seeded under an older work factor stops paying it (D-118). Runs
 * only after the password has been verified, which is the only moment the
 * plaintext is available to hash again.
 *
 * Deliberately best-effort: the sign-in already succeeded, so a failed write
 * must not turn it into a failure. The next sign-in simply tries again.
 */
async function upgradeHashCost(
  userId: string,
  storedHash: string,
  password: string,
): Promise<void> {
  try {
    if (bcrypt.getRounds(storedHash) === BCRYPT_COST) return;
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await bcrypt.hash(password, BCRYPT_COST) },
    });
  } catch (error) {
    console.error("Password hash cost upgrade failed (sign-in was not affected):", error);
  }
}

/** Returns the canonical username on a match, null on any failure. */
export async function verifyCredentials(
  username: string,
  password: string,
): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { username } });
  const matches = await bcrypt.compare(password, user?.passwordHash ?? PHANTOM_HASH);
  if (!matches || !user) return null;

  await upgradeHashCost(user.id, user.passwordHash, password);
  return user.username;
}
