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
};

export default nextConfig;
