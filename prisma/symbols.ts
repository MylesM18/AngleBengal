import type { PrismaClient } from "@prisma/client";

import { SYMBOL_SEED_ROWS } from "../src/lib/symbols";

/**
 * Writes the ten symbol rows. Idempotent: `glyph` is unique, so a re-run
 * updates names and ordering instead of inserting duplicates. Returns
 * glyph -> id so callers can attach `Topic.symbolId` without a second query.
 */
export async function seedSymbols(prisma: PrismaClient): Promise<Map<string, string>> {
  const byGlyph = new Map<string, string>();
  for (const row of SYMBOL_SEED_ROWS) {
    const symbol = await prisma.mathSymbol.upsert({
      where: { glyph: row.glyph },
      update: { name: row.name, isDefault: row.isDefault, sortOrder: row.sortOrder },
      create: row,
      select: { id: true, glyph: true },
    });
    byGlyph.set(symbol.glyph, symbol.id);
  }
  return byGlyph;
}
