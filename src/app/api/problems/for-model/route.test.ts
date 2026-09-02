import { beforeEach, describe, expect, it, vi } from "vitest";

import { problemForModel } from "@/lib/problems/serve";

import { GET } from "./route";

vi.mock("@/lib/problems/serve", () => ({
  problemForModel: vi.fn(async () => null),
}));

const request = (query: string) =>
  new Request(`http://localhost/api/problems/for-model${query}`);

beforeEach(() => {
  vi.mocked(problemForModel).mockClear();
});

describe("GET /api/problems/for-model", () => {
  it("400s without docId and never queries", async () => {
    const response = await GET(request("?modelNumber=2"));
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("BAD_REQUEST");
    expect(problemForModel).not.toHaveBeenCalled();
  });

  it("400s on a non-integer or out-of-range modelNumber", async () => {
    expect((await GET(request("?docId=d1&modelNumber=zero"))).status).toBe(400);
    expect((await GET(request("?docId=d1&modelNumber=0"))).status).toBe(400);
    expect((await GET(request("?docId=d1&modelNumber=100"))).status).toBe(400);
    expect(problemForModel).not.toHaveBeenCalled();
  });

  it("404s POOL_EMPTY when no problem qualifies", async () => {
    const response = await GET(request("?docId=d1&modelNumber=2"));
    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe("POOL_EMPTY");
  });

  it("returns the served problem and passes the parsed arguments through", async () => {
    vi.mocked(problemForModel).mockResolvedValueOnce({ id: "p1" } as never);
    const response = await GET(request("?docId=d1&modelNumber=3"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: "p1" });
    expect(problemForModel).toHaveBeenCalledWith("d1", 3);
  });

  it("500s INTERNAL when serving throws", async () => {
    vi.mocked(problemForModel).mockRejectedValueOnce(new Error("boom"));
    const response = await GET(request("?docId=d1&modelNumber=3"));
    expect(response.status).toBe(500);
    expect((await response.json()).error.code).toBe("INTERNAL");
  });
});
