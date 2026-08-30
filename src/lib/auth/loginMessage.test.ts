import { describe, expect, test } from "vitest";

import { loginErrorMessage } from "./loginMessage";

describe("loginErrorMessage", () => {
  test("401 stays deliberately vague about which field was wrong", () => {
    expect(loginErrorMessage(401)).toBe("Wrong username or password.");
  });

  test("429 tells the person to wait instead of to try again", () => {
    const message = loginErrorMessage(429);

    expect(message).toBe("Too many attempts. Wait a few minutes and try again.");
  });

  test("a server error falls back to the generic message", () => {
    expect(loginErrorMessage(500)).toBe("Something went wrong. Try again.");
  });

  test("an unexpected status falls back to the generic message", () => {
    expect(loginErrorMessage(418)).toBe("Something went wrong. Try again.");
  });
});
