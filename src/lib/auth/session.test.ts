import { describe, expect, test } from "vitest";

import { SESSION_COOKIE, createSessionValue, verifySessionValue } from "@/lib/auth/session";

const SECRET = "test-secret-0123456789abcdef0123456789abcdef";

describe("session cookie value", () => {
  test("round trip: create then verify returns the username", async () => {
    const value = await createSessionValue("myles", SECRET);
    expect(await verifySessionValue(value, SECRET)).toBe("myles");
  });

  test("a username containing dots survives the round trip", async () => {
    const value = await createSessionValue("m.y.les", SECRET);
    expect(await verifySessionValue(value, SECRET)).toBe("m.y.les");
  });

  test("rejects a value whose signature was tampered with", async () => {
    const value = await createSessionValue("myles", SECRET);
    const tampered = value.slice(0, -2) + (value.endsWith("AA") ? "BB" : "AA");
    expect(await verifySessionValue(tampered, SECRET)).toBeNull();
  });

  test("rejects a value whose username was swapped after signing", async () => {
    const value = await createSessionValue("myles", SECRET);
    const forgedName = await createSessionValue("mallory", SECRET);
    const [, ...rest] = value.split(".");
    const [forged] = forgedName.split(".");
    expect(await verifySessionValue([forged, ...rest].join("."), SECRET)).toBeNull();
  });

  test("rejects a value signed with a different secret", async () => {
    const value = await createSessionValue("myles", "some-other-secret");
    expect(await verifySessionValue(value, SECRET)).toBeNull();
  });

  test.each(["", "abc", "a.b", "a.b.c.d", "..", "%%%.123.%%%"])(
    "rejects the malformed value %j",
    async (bad) => {
      expect(await verifySessionValue(bad, SECRET)).toBeNull();
    },
  );

  test("exports a stable cookie name", () => {
    expect(SESSION_COOKIE).toBe("anglebengal_session");
  });
});
