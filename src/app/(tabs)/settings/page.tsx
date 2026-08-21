import { costByPrompt } from "@/lib/attempts";
import { AI_MODELS } from "@/lib/ai/config";

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
    <div className="mx-auto max-w-[760px] px-8 py-10">
      <h1 className="display-cut text-[30px] leading-tight text-ink">Settings</h1>

      <section className="mt-8">
        <h2 className="meta-caps mb-3 text-ink-soft">AI usage</h2>

        {rows.length === 0 ? (
          <div className="stock-textured rounded-card bg-kraft p-5">
            <p className="text-[13px] text-ink">No AI calls logged yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-card bg-paper-1 shadow-sheet">
            <table className="w-full text-[13px]">
              <caption className="sr-only">
                Token usage and call counts by prompt
              </caption>
              <thead className="bg-marigold-tint">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left font-bold">
                    Prompt
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-bold">
                    Calls
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-bold">
                    Input
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-bold">
                    Output
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-bold">
                    Avg time
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.promptName} className="border-t border-ink-faint/40">
                    <th scope="row" className="px-3 py-2 text-left font-semibold text-ink">
                      {row.promptName}
                      {row.failed > 0 && (
                        <span className="ml-1.5 text-[11px] font-normal text-red">
                          {row.failed} failed
                        </span>
                      )}
                    </th>
                    <td className="px-3 py-2 text-right tabular-nums">{number(row.calls)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {number(row.inputTokens)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {number(row.outputTokens)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-ink-soft">
                      {row.calls ? `${Math.round(row.totalMs / row.calls / 100) / 10}s` : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-ink-faint bg-paper-0">
                  <th scope="row" className="px-3 py-2 text-left font-bold text-ink">
                    Total
                  </th>
                  <td className="px-3 py-2 text-right font-bold tabular-nums">
                    {number(totals.calls)}
                  </td>
                  <td className="px-3 py-2 text-right font-bold tabular-nums">
                    {number(totals.input)}
                  </td>
                  <td className="px-3 py-2 text-right font-bold tabular-nums">
                    {number(totals.output)}
                  </td>
                  <td className="px-3 py-2" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <p className="mt-2 max-w-[60ch] text-[12px] leading-relaxed text-ink-soft">
          Tokens, not dollars: prices change independently of this app, and a stale
          hardcoded rate would mislead more than it informs.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="meta-caps mb-3 text-ink-soft">Models in use</h2>
        <dl className="rounded-card bg-paper-1 p-4 shadow-sheet">
          {Object.entries(AI_MODELS).map(([role, id]) => (
            <div key={role} className="flex gap-3 py-1 text-[13px]">
              <dt className="w-[110px] shrink-0 font-semibold text-ink">{role}</dt>
              <dd className="font-mono text-[12.5px] text-ink-soft">{id}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
