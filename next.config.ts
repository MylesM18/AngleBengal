import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Next 16 appends a `nextjs-agent-rules` block to CLAUDE.md on every
   * `next dev`. CLAUDE.md is this project's source of truth, handed over with
   * the spec bundle, so a build tool must not edit it (DECISIONS.md D-013).
   *
   * The advice in that block still applies: Next 16 has breaking changes, and
   * the authoritative docs are in `node_modules/next/dist/docs/`.
   */
  agentRules: false,
  /**
   * Hides Next's dev-mode indicator. It floats in a corner of every page in
   * `next dev`, and every corner is taken on the compact sketch overlay: the
   * Undo and Redo arrows bottom left (D-194), Draw and Type bottom right,
   * Done top left, the overflow button top right. It sat over the Undo arrow
   * and blocked the e2e rig's clicks, and the rig runs against `next dev`.
   * Compile and runtime errors still surface (Next 16 devIndicators docs:
   * node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/devIndicators.md),
   * and production never renders the indicator.
   */
  devIndicators: false,
};

export default nextConfig;
