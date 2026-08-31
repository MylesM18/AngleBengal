import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, test, vi } from "vitest";

// credentials.ts imports "server-only" (unloadable outside a server component)
// and reaches Prisma. Both are stubbed so the real module under test runs.
vi.mock("server-only", () => ({}));

const findUnique = vi.fn();
const update = vi.fn();
vi.mock("@/lib/db", () => ({ prisma: { user: { findUnique, update } } }));

const { BCRYPT_COST } = await import("@/lib/auth/hashCost");
const { PHANTOM_HASH, verifyCredentials } = await import("@/lib/auth/credentials");

const PASSWORD = "correct-horse-battery";
const USER = { id: "u1", username: "myles" };

beforeEach(() => {
  findUnique.mockReset();
  update.mockReset();
  update.mockResolvedValue(undefined);
});

describe("phantom hash", () => {
  test("is hashed at the same cost as real passwords", () => {
    // A phantom at a different cost takes measurably longer (or less) than a
    // real compare, which is the username-enumeration signal it exists to hide.
    expect(bcrypt.getRounds(PHANTOM_HASH)).toBe(BCRYPT_COST);
  });

  test("matches no password, so an unknown username can never sign in", async () => {
    findUnique.mockResolvedValue(null);
    expect(await verifyCredentials("nobody", PASSWORD)).toBeNull();
    expect(await verifyCredentials("nobody", "")).toBeNull();
    expect(update).not.toHaveBeenCalled();
  });
});

describe("verifyCredentials", () => {
  test("returns the canonical username for a correct password", async () => {
    findUnique.mockResolvedValue({ ...USER, passwordHash: await bcrypt.hash(PASSWORD, BCRYPT_COST) });
    expect(await verifyCredentials(USER.username, PASSWORD)).toBe(USER.username);
  });

  test("returns null for a wrong password and writes nothing", async () => {
    findUnique.mockResolvedValue({ ...USER, passwordHash: await bcrypt.hash(PASSWORD, BCRYPT_COST) });
    expect(await verifyCredentials(USER.username, "wrong")).toBeNull();
    expect(update).not.toHaveBeenCalled();
  });
});

describe("hash cost upgrade", () => {
  const LEGACY_COST = 12;

  test("re-hashes a correct password stored at an older cost", async () => {
    const legacyHash = await bcrypt.hash(PASSWORD, LEGACY_COST);
    findUnique.mockResolvedValue({ ...USER, passwordHash: legacyHash });

    expect(await verifyCredentials(USER.username, PASSWORD)).toBe(USER.username);
    expect(update).toHaveBeenCalledTimes(1);

    const written = update.mock.calls[0][0].data.passwordHash;
    expect(bcrypt.getRounds(written)).toBe(BCRYPT_COST);
    // The new hash is a real hash of the same password, not a copy of the old.
    expect(written).not.toBe(legacyHash);
    expect(await bcrypt.compare(PASSWORD, written)).toBe(true);
  });

  test("leaves a hash already at the current cost alone", async () => {
    findUnique.mockResolvedValue({ ...USER, passwordHash: await bcrypt.hash(PASSWORD, BCRYPT_COST) });
    expect(await verifyCredentials(USER.username, PASSWORD)).toBe(USER.username);
    expect(update).not.toHaveBeenCalled();
  });

  test("never upgrades on a wrong password, even against a legacy hash", async () => {
    findUnique.mockResolvedValue({ ...USER, passwordHash: await bcrypt.hash(PASSWORD, LEGACY_COST) });
    expect(await verifyCredentials(USER.username, "wrong")).toBeNull();
    expect(update).not.toHaveBeenCalled();
  });

  test("a failed upgrade write still signs the user in", async () => {
    findUnique.mockResolvedValue({ ...USER, passwordHash: await bcrypt.hash(PASSWORD, LEGACY_COST) });
    update.mockRejectedValue(new Error("database is unreachable"));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await verifyCredentials(USER.username, PASSWORD)).toBe(USER.username);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
