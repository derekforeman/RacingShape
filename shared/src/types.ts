export type EventType = 'commit' | 'pr_opened' | 'pr_merged' | 'issue_closed';
export type ReactionKind = '🔥' | '⚡' | '🏎️';
export type Cosmetic = 'flame_trail' | 'gold_rims' | 'rookie_decal';

export interface Racer {
  login: string; // github_login (pk)
  displayName: string;
  avatarUrl: string;
  firstSeen: string; // ISO UTC
}

/** Count of each event type for a racer in a day. */
export interface ScoreBreakdown {
  commit: number;
  pr_opened: number;
  pr_merged: number;
  issue_closed: number;
}

export interface ReactionSummary {
  total: number;
  byKind: Record<ReactionKind, number>;
}

export interface RacerStanding {
  login: string;
  displayName: string;
  avatarUrl: string;
  score: number;
  breakdown: ScoreBreakdown; // counts per event type (multiply by weights for points)
  position: number; // 1-based, ties share lower number then by login
  gapToLeader: number; // points behind P1; 0 for leader
  isLeader: boolean;
  topMover: boolean; // DRS: gained the most points on the latest poll
  reactions: ReactionSummary;
  cosmetics: Cosmetic[];
}

export interface RaceToday {
  raceDate: string; // YYYY-MM-DD (America/New_York)
  live: true;
  topScore: number; // for track auto-scale (>=1)
  standings: RacerStanding[]; // sorted by position
  lastPolledAt: string | null; // ISO UTC
}

export interface SnapshotFrame {
  capturedAt: string; // ISO UTC
  scores: { login: string; score: number }[];
}

export interface ArchivedReaction {
  targetLogin: string;
  kind: ReactionKind;
  reactor: string;
  createdAt: string; // ISO UTC
}

export interface PodiumStep {
  position: number; // 1..3
  login: string;
  displayName: string;
  avatarUrl: string;
  score: number;
  breakdown: ScoreBreakdown;
}

export interface Superlative {
  key: 'fastest_hour' | 'comeback' | 'midnight_grinder';
  title: string; // human label, e.g. "Fastest hour"
  login: string | null; // null if no data supports it
  detail: string; // e.g. "9 commits · 2–3pm"
}

export interface Recap {
  raceDate: string;
  podium: PodiumStep[]; // up to 3
  superlatives: Superlative[]; // exactly 3 (login may be null)
}

export interface RaceArchive {
  raceDate: string;
  live: false;
  topScore: number;
  standings: RacerStanding[]; // final standings for the day
  frames: SnapshotFrame[]; // ordered by capturedAt for replay
  reactions: ArchivedReaction[];
  recap: Recap;
}

export interface RaceListItem {
  raceDate: string;
  topScore: number;
  winnerLogin: string | null;
}

export interface ChartDay {
  raceDate: string; // YYYY-MM-DD
  commits: number;
  prsOpened: number;
  issuesClosed: number;
}

export interface TasksStat {
  total: number;
  issues: number;
  prs: number;
  deltaVsPriorWeek: number; // signed
}

export interface CompletionStat {
  rate: number; // 0..1
  closed: number;
  opened: number;
}

export interface StreakStat {
  current: number; // consecutive days with >=1 event, ending today
  startDate: string | null; // YYYY-MM-DD when current run began
  bestThisMonth: number;
}

export interface StatsResponse {
  range: string; // echo, e.g. "14d"
  repoUrl: string; // https://github.com/S2AI/s2shape
  chart: ChartDay[]; // ascending by date
  totalTasks: TasksStat;
  completion: CompletionStat;
  streak: StreakStat;
}

/** POST body for a pit-stop boost (plan 04). */
export interface CreateReactionBody {
  targetLogin: string;
  kind: ReactionKind;
  reactor: string; // who cheered (free-text handle for v1)
}

export interface CreateReactionResponse {
  ok: true;
  reactions: ReactionSummary; // updated count for the target
}
