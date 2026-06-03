import type { EventType } from '@racingshape/shared';

/** A normalized author as seen on a GitHub event. */
export interface RawAuthor {
  login: string;
  displayName: string;
  avatarUrl: string;
}

/** One raw activity item the client hands to ingest, pre-typed but un-scored/un-dated. */
export interface RawActivity {
  type: EventType;
  /** Stable natural key: sha for commits, PR number, or issue number (as string). */
  nativeId: string;
  author: RawAuthor;
  /** ISO UTC timestamp the activity occurred (commit date, PR created/merged, issue closed). */
  occurredAt: string;
}

/** Everything the poller fetched for one race day. */
export interface RawActivityBatch {
  raceDate: string;
  activities: RawActivity[];
}
