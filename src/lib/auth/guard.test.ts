import { describe, expect, test } from "vitest";

import { isApiPath, isPublicPath } from "@/lib/auth/guard";

describe("isPublicPath", () => {
  test.each([
    "/login",
    "/api/auth/login",
    "/_next/static/chunks/main.js",
    "/_next/image?url=x",
    "/favicon.ico",
    "/manifest.webmanifest",
    "/anglebengal-mark.svg",
    "/anglebengal-mark-dark.svg",
    "/apple-touch-icon.png",
  ])("allows %s without a session", (path) => {
    expect(isPublicPath(path)).toBe(true);
  });

  test.each([
    "/",
    "/learn",
    "/learn/algebra",
    "/practice",
    "/settings",
    "/api/topics",
    "/api/auth/logout",
    "/login/impostor",
    "/learn/file.svg",
  ])("walls %s", (path) => {
    expect(isPublicPath(path)).toBe(false);
  });
});

describe("isApiPath", () => {
  test("API routes get JSON 401 treatment", () => {
    expect(isApiPath("/api/topics")).toBe(true);
    expect(isApiPath("/api")).toBe(true);
  });

  test("pages get redirect treatment", () => {
    expect(isApiPath("/learn")).toBe(false);
    expect(isApiPath("/apify")).toBe(false);
  });
});
