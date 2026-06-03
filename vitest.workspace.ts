// Per-workspace Vitest projects so each runs in the right environment:
// `shared` and `api` use the default node environment; `web` uses jsdom
// (configured in web/vite.config.ts). Root `npm test` (vitest run) honors all three.
export default ['shared', 'api', 'web'];
