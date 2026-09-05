import { beforeEach, describe, expect, it, vi } from "vitest";

import { readResume, writeResume } from "@/lib/resume/store";

import { GET, POST } from "./route";

vi.mock("@/lib/resume/store", () => ({
  readResume: vi.fn(),
  writeResume: vi.fn(),
}));

const readMock = vi.mocked(readResume);
const writeMock = vi.mocked(writeResume);

const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/state/resume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

beforeEach(() => {
  readMock.mockReset();
  writeMock.mockReset();
  writeMock.mockResolvedValue();
});

describe("GET /api/state/resume", () => {
  it("returns the record, or null when there is none", async () => {
    readMock.mockResolvedValue({ path: "/learn/t1?doc=d1", context: { scrollTop: 120 } });
    expect(await (await GET()).json()).toEqual({
      path: "/learn/t1?doc=d1",
      context: { scrollTop: 120 },
    });

    readMock.mockResolvedValue(null);
    expect(await (await GET()).json()).toBeNull();
  });
});

describe("POST /api/state/resume", () => {
  it("saves a valid report and answers 204", async () => {
    const response = await post({ path: "/practice/t1", problemId: "p1", scrollTop: 5 });
    expect(response.status).toBe(204);
    expect(writeMock).toHaveBeenCalledWith("/practice/t1", { scrollTop: 5, problemId: "p1" });
  });

  it("omits absent detail fields rather than storing undefined", async () => {
    await post({ path: "/learn/t1" });
    expect(writeMock).toHaveBeenCalledWith("/learn/t1", {});
  });

  it("400s on a path outside the tabs", async () => {
    for (const path of ["/", "/evil", "//evil.example/learn", "https://evil.example"]) {
      const response = await post({ path });
      expect(response.status).toBe(400);
    }
    expect(writeMock).not.toHaveBeenCalled();
  });

  it("400s on malformed bodies", async () => {
    expect((await post({ path: 7 })).status).toBe(400);
    expect((await post({ path: "/learn", problemId: "not valid!" })).status).toBe(400);
    expect((await post({ path: "/learn", scrollTop: -2 })).status).toBe(400);
  });
});
