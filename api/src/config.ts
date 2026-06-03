export interface AppConfig {
  port: number;
  githubToken: string;
  repoOwner: string; // "S2AI"
  repoName: string; // "s2shape"
  pollIntervalMs: number; // default 60_000
  snapshotIntervalMs: number; // default 300_000 (5 min) — replay frame cadence
  dbPath: string; // default "./data/racingshape.db"
}

/** Parse a positive integer env var; throw a clear error naming the var on failure. */
function parsePositiveInt(name: string, raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw === '') return fallback;
  if (!/^\d+$/.test(raw)) {
    throw new Error(`Invalid ${name}: "${raw}" is not a positive integer`);
  }
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`Invalid ${name}: "${raw}" must be a positive integer`);
  }
  return n;
}

export function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  const isTest = env.NODE_ENV === 'test';
  const githubToken = env.GITHUB_TOKEN ?? '';
  if (!githubToken && !isTest) {
    throw new Error('Missing required env var GITHUB_TOKEN');
  }

  return {
    port: parsePositiveInt('PORT', env.PORT, 8787),
    githubToken,
    repoOwner: env.REPO_OWNER && env.REPO_OWNER !== '' ? env.REPO_OWNER : 'S2AI',
    repoName: env.REPO_NAME && env.REPO_NAME !== '' ? env.REPO_NAME : 's2shape',
    pollIntervalMs: parsePositiveInt('POLL_INTERVAL_MS', env.POLL_INTERVAL_MS, 60_000),
    snapshotIntervalMs: parsePositiveInt(
      'SNAPSHOT_INTERVAL_MS',
      env.SNAPSHOT_INTERVAL_MS,
      300_000,
    ),
    dbPath: env.DB_PATH && env.DB_PATH !== '' ? env.DB_PATH : './data/racingshape.db',
  };
}
