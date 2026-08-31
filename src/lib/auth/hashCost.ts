/**
 * Work factor for every password hash this app writes (DECISIONS.md D-118).
 *
 * 10, not 12. bcryptjs is a pure-JS implementation, so each step up the cost
 * curve is felt more than it would be with a native binding: cost 12 measured
 * about 280ms per compare on a fast laptop and more on a shared serverless
 * vCPU, paid on the critical path of every sign-in. 10 is bcryptjs's own
 * default and meets current OWASP guidance for bcrypt, and the online guessing
 * this parameter defends against is already bounded by LOGIN_MAX_FAILURES.
 *
 * Its own module, free of "server-only" and of Prisma, because seed-admin.ts
 * is a plain tsx script and must hash at the same cost credentials.ts
 * verifies at. A hash carries its own cost, so raising this later is safe:
 * existing hashes keep verifying and upgrade on the next successful sign-in.
 */
export const BCRYPT_COST = 10;
