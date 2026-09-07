/**
 * Shared constants for the mobile regression rig (mobile fix plan Phase 7).
 * Kept out of playwright.config.ts so the global setup and the specs can read
 * them without importing the config.
 */

/**
 * Port 3011, deliberately not 3010. Port 3010 belongs to the `anglebengal-dev`
 * server the Browser pane drives; running the rig on it would fight that
 * server for the same Next build directory.
 */
export const E2E_PORT = 3011;

/*
 * `localhost`, not `127.0.0.1`. Next 16's dev origin allowlist covers
 * `localhost` and the configured hostname, and 127.0.0.1 is not on it, so
 * driving the rig there makes the dev server refuse the HMR websocket upgrade
 * and log a cross origin warning on every request. Static chunks still load
 * (they carry no Origin header, so the block does not apply) and the page does
 * hydrate, so this is about a quiet, noisy dev channel rather than a broken
 * page. Using the allowlisted host costs nothing and keeps the run legible.
 */
export const E2E_HOST = "localhost";

export const E2E_BASE_URL = `http://${E2E_HOST}:${E2E_PORT}`;

/**
 * Where global-setup writes the minted session (DECISIONS.md D-163). Never
 * committed: the file holds a live signed cookie, so `.gitignore` covers
 * `e2e/.auth/`.
 */
export const STORAGE_STATE = "e2e/.auth/storage-state.json";

/** The username stamped into the minted cookie. See D-163 for why any string works. */
export const E2E_USERNAME = "e2e-rig";

/**
 * The two compact widths the plan's acceptance criteria are written against
 * (docs/research/mobile-responsiveness.md §4 Phase 7). No device descriptor
 * gives both, so the specs override the viewport width per test and keep the
 * descriptor's engine, user agent and touch characteristics.
 */
export const COMPACT_WIDTHS = [360, 390] as const;

/** Portrait height used with the compact widths. 800/844 are the real pairs; one height is enough. */
export const COMPACT_HEIGHT = 800;

/** The desktop width the D-074 gate runs at. */
export const DESKTOP_WIDTH = 1280;
export const DESKTOP_HEIGHT = 800;
