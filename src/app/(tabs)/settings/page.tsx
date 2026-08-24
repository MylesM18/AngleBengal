import { EmptyState } from "@/components/ui/EmptyState";
import { Sheet } from "@/components/ui/Sheet";
import { AI_MODELS } from "@/lib/ai/config";
import { costByPrompt } from "@/lib/attempts";

export const dynamic = "force-dynamic";

/**
 * Cost visibility (docs/07 Phase 5): AiCallLog token usage summed by prompt.
 *
 * Deliberately reports tokens and not dollars. Prices change independently of
 * this code, and a stale hardcoded rate would be worse than no number at all.
 */
export default async function SettingsPage() {
  const rows = await costByPrompt();

  const totals = rows.reduce(
    (sum, row) => ({
      calls: sum.calls + row.calls,
      failed: sum.failed + row.failed,
      input: sum.input + row.inputTokens,
      output: sum.output + row.outputTokens,
    }),
    { calls: 0, failed: 0, input: 0, output: 0 },
  );

  const number = (value: number) => value.toLocaleString("en-US");

  return (
    <div className="h-full overflow-y-auto p-2">
      <div className="max-w-[860px] pt-16">
        <h1 className="display-cut text-h1 text-ink">Settings</h1>

        {rows.length === 0 && (
          <EmptyState
            title="No AI calls logged yet"
            line="Generate a topic or practice a problem and the token usage shows up here."
            accent="var(--color-marigold)"
            className="mt-6"
          />
        )}

        <Sheet tone="paper-1" className="animate-enter-sheet mt-6 divide-y divide-hairline overflow-hidden">
          {rows.length > 0 && (
            <section aria-labelledby="settings-usage">
              <h2 id="settings-usage" className="meta-caps px-4 pt-3 pb-2 text-ink-soft">
                AI usage
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-ui">
                  <caption className="sr-only">Token usage and call counts by prompt</caption>
                  <thead className="bg-marigold-tint">
                    <tr>
                      <th scope="col" className="px-4 py-2 text-left font-bold">
                        Prompt
                      </th>
                      <th scope="col" className="px-4 py-2 text-right font-bold">
                        Calls
                      </th>
                      <th scope="col" className="px-4 py-2 text-right font-bold">
                        Input
                      </th>
                      <th scope="col" className="px-4 py-2 text-right font-bold">
                        Output
                      </th>
                      <th scope="col" className="px-4 py-2 text-right font-bold">
                        Avg time
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline">
                    {rows.map((row) => (
                      <tr key={row.promptName}>
                        <th scope="row" className="px-4 py-2 text-left font-semibold text-ink">
                          {row.promptName}
                          {row.failed > 0 && (
                            <span className="ml-1.5 text-meta font-normal text-red">
                              {row.failed} failed
                            </span>
                          )}
                        </th>
                        <td className="px-4 py-2 text-right tabular-nums">{number(row.calls)}</td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {number(row.inputTokens)}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {number(row.outputTokens)}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums text-ink-soft">
                          {row.calls ? `${Math.round(row.totalMs / row.calls / 100) / 10}s` : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-hairline bg-paper-0">
                      <th scope="row" className="px-4 py-2 text-left font-bold text-ink">
                        Total
                      </th>
                      <td className="px-4 py-2 text-right font-bold tabular-nums">
                        {number(totals.calls)}
                      </td>
                      <td className="px-4 py-2 text-right font-bold tabular-nums">
                        {number(totals.input)}
                      </td>
                      <td className="px-4 py-2 text-right font-bold tabular-nums">
                        {number(totals.output)}
                      </td>
                      <td className="px-4 py-2" />
                    </tr>
                  </tfoot>
                </table>
              </div>
              <p className="max-w-[60ch] px-4 py-3 text-meta leading-relaxed text-ink-soft">
                Tokens, not dollars: prices change independently of this app, and a stale
                hardcoded rate would mislead more than it informs.
              </p>
            </section>
          )}

          <section aria-labelledby="settings-models" className="px-4 pt-3 pb-4">
            <h2 id="settings-models" className="meta-caps mb-2 text-ink-soft">
              Models in use
            </h2>
            <dl className="divide-y divide-hairline">
              {Object.entries(AI_MODELS).map(([role, id]) => (
                <div key={role} className="flex gap-3 py-1.5 text-ui">
                  <dt className="w-[110px] shrink-0 font-semibold text-ink">{role}</dt>
                  <dd className="font-mono text-meta text-ink-soft">{id}</dd>
                </div>
              ))}
            </dl>
          </section>
        </Sheet>
      </div>
    </div>
  );
}
