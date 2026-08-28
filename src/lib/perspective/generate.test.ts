import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildPerspectiveDoc } from "@/lib/ai/perspectiveFixture";

const mocks = vi.hoisted(() => ({
  callText: vi.fn(),
  topicFindUnique: vi.fn(),
  perspectiveFindUnique: vi.fn(),
  perspectiveCreate: vi.fn(),
  modelDocFindUnique: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/ai/call", () => ({ callText: mocks.callText }));
vi.mock("@/lib/db", () => ({
  prisma: {
    topic: { findUnique: mocks.topicFindUnique },
    perspectiveDoc: { findUnique: mocks.perspectiveFindUnique, create: mocks.perspectiveCreate },
    mentalModelDoc: { findUnique: mocks.modelDocFindUnique },
  },
  isUniqueViolation: (error: unknown) =>
    typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002",
}));
vi.mock("@/lib/topics", () => ({
  getTopicPath: vi.fn().mockResolvedValue(["Geometry", "Trigonometry"]),
}));
vi.mock("@/lib/ai/prompts", () => ({
  perspectiveSystem: vi.fn().mockResolvedValue("SYSTEM PROMPT"),
  perspectiveUser: vi.fn().mockReturnValue("USER MESSAGE"),
  generatorRetryUser: vi.fn(
    (original: string, failures: string[]) => `${original}\n\nRETRY:\n${failures.join("\n")}`,
  ),
}));

import { generatePerspectiveDoc } from "./generate";

describe("generatePerspectiveDoc", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.topicFindUnique.mockResolvedValue({ id: "t1", name: "Trigonometry" });
    mocks.perspectiveFindUnique.mockResolvedValue(null);
    mocks.modelDocFindUnique.mockResolvedValue({ modelIndexJson: "[]" });
    mocks.perspectiveCreate.mockImplementation(
      ({ data }: { data: { topicId: string; contentMd: string } }) =>
        Promise.resolve({
          id: "p1",
          topicId: data.topicId,
          contentMd: data.contentMd,
          createdAt: new Date(0),
        }),
    );
  });

  it("returns the existing doc without generating", async () => {
    mocks.perspectiveFindUnique.mockResolvedValue({
      id: "p0",
      topicId: "t1",
      contentMd: "existing",
      createdAt: new Date(0),
    });
    const result = await generatePerspectiveDoc("t1");
    expect(result.created).toBe(false);
    expect(result.contentMd).toBe("existing");
    expect(mocks.callText).not.toHaveBeenCalled();
  });

  it("saves a valid first generation", async () => {
    mocks.callText.mockResolvedValueOnce(buildPerspectiveDoc());
    const result = await generatePerspectiveDoc("t1");
    expect(result.created).toBe(true);
    expect(mocks.callText).toHaveBeenCalledTimes(1);
    expect(mocks.perspectiveCreate).toHaveBeenCalledTimes(1);
  });

  it("retries once with the failures appended, then saves", async () => {
    mocks.callText
      .mockResolvedValueOnce(buildPerspectiveDoc({ omitHeading: "Proof it works" }))
      .mockResolvedValueOnce(buildPerspectiveDoc());
    const result = await generatePerspectiveDoc("t1");
    expect(result.created).toBe(true);
    expect(mocks.callText).toHaveBeenCalledTimes(2);
    const retryCall = mocks.callText.mock.calls[1][0] as { user: string };
    expect(retryCall.user).toContain("Proof it works");
  });

  it("throws GENERATION_INVALID after a second failure and saves nothing", async () => {
    mocks.callText.mockResolvedValue(buildPerspectiveDoc({ emDash: true }));
    await expect(generatePerspectiveDoc("t1")).rejects.toMatchObject({
      code: "GENERATION_INVALID",
    });
    expect(mocks.callText).toHaveBeenCalledTimes(2);
    expect(mocks.perspectiveCreate).not.toHaveBeenCalled();
  });

  it("hands back the winner on a concurrent unique violation", async () => {
    mocks.callText.mockResolvedValueOnce(buildPerspectiveDoc());
    mocks.perspectiveCreate.mockRejectedValueOnce({ code: "P2002" });
    mocks.perspectiveFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "winner",
        topicId: "t1",
        contentMd: "won",
        createdAt: new Date(0),
      });
    const result = await generatePerspectiveDoc("t1");
    expect(result.id).toBe("winner");
    expect(result.created).toBe(false);
  });

  it("404s an unknown topic", async () => {
    mocks.topicFindUnique.mockResolvedValue(null);
    await expect(generatePerspectiveDoc("missing")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
