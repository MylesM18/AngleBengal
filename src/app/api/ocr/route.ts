import { NextResponse } from "next/server";
import { z } from "zod";

import { callStructured } from "@/lib/ai/call";
import { AI_MODELS } from "@/lib/ai/config";
import { ApiError, errorBody } from "@/lib/ai/errors";
import { OCR_SYSTEM } from "@/lib/ai/prompts";
import { ocrSchema } from "@/lib/ai/schemas";

/**
 * POST /api/ocr (docs/04, docs/02 flow D): handwriting image to ordered
 * blocks of LaTeX and text.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** A 1600px-wide PNG lands well under this; the cap is a guard, not a target. */
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const bodySchema = z.object({
  imageBase64: z.string().min(1, "No image supplied."),
});

export async function POST(request: Request) {
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? (error.issues[0]?.message ?? "Invalid request body.")
        : "Invalid request body.";
    const badRequest = new ApiError("BAD_REQUEST", message);
    return NextResponse.json(errorBody(badRequest), { status: badRequest.status });
  }

  const dataUrl = body.imageBase64.startsWith("data:")
    ? body.imageBase64
    : `data:image/png;base64,${body.imageBase64}`;

  if (dataUrl.length > MAX_IMAGE_BYTES) {
    const tooBig = new ApiError("BAD_REQUEST", "That image is too large to read.");
    return NextResponse.json(errorBody(tooBig), { status: tooBig.status });
  }

  try {
    const result = await callStructured({
      promptName: "ocr",
      model: AI_MODELS.OCR,
      system: OCR_SYSTEM,
      user: "Transcribe this scratch work.",
      imageDataUrl: dataUrl,
      schema: ocrSchema,
      schemaName: "ocr_blocks",
    });

    // Drop blocks whose payload field is empty: a "math" block with no latex
    // is noise the client would render as a blank row.
    const blocks = result.blocks.filter((block) =>
      block.kind === "math" ? Boolean(block.latex?.trim()) : Boolean(block.text?.trim()),
    );

    if (blocks.length === 0) {
      const unreadable = new ApiError(
        "UNREADABLE",
        "Couldn't read that. Try writing larger or darker.",
      );
      return NextResponse.json(errorBody(unreadable), { status: unreadable.status });
    }

    return NextResponse.json({ blocks });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(errorBody(error), { status: error.status });
    }
    console.error("POST /api/ocr failed:", error);
    const internal = new ApiError("INTERNAL", "Could not read that image.");
    return NextResponse.json(errorBody(internal), { status: internal.status });
  }
}
