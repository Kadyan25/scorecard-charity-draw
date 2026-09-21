/**
 * Pure rules for score entry (PRD section 05). The database enforces the same
 * rules authoritatively; these give the UI and API clean, early answers.
 */

import { TICKET_SIZE } from "@/services/draw";

/**
 * Latest date a round may be logged for, as YYYY-MM-DD.
 *
 * One day ahead of UTC so a golfer east of Greenwich can log today's round just
 * after local midnight. Mirrors the database check in migration 0004.
 */
export function latestAllowedPlayDate(now: Date = new Date()): string {
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  return tomorrow.toISOString().slice(0, 10);
}

export interface ScoreLike {
  value: number;
  played_on: string;
}

export interface TicketSummary {
  /** Newest first, matching how scores are displayed (PRD section 05). */
  numbers: number[];
  count: number;
  remaining: number;
  complete: boolean;
  /** Repeated values count once in the draw — see architecture 2.3. */
  hasDuplicates: boolean;
  /** The round the next new score would push out, once the ticket is full. */
  nextToReplace: ScoreLike | null;
}

export function sortNewestFirst<T extends ScoreLike>(scores: readonly T[]): T[] {
  return [...scores].sort((a, b) => b.played_on.localeCompare(a.played_on));
}

export function describeTicket(scores: readonly ScoreLike[]): TicketSummary {
  const ordered = sortNewestFirst(scores);
  const numbers = ordered.map((score) => score.value);
  const complete = ordered.length >= TICKET_SIZE;

  return {
    numbers,
    count: ordered.length,
    remaining: Math.max(0, TICKET_SIZE - ordered.length),
    complete,
    hasDuplicates: new Set(numbers).size < numbers.length,
    nextToReplace: complete ? ordered[ordered.length - 1] : null,
  };
}

export interface ScoreErrorResponse {
  status: number;
  message: string;
}

/**
 * Translate a database rejection into something a golfer can act on. Returns
 * null for anything unexpected so the caller surfaces it as a real failure
 * instead of dressing it up as user error.
 */
export function mapScoreDbError(error: { code?: string; message: string }): ScoreErrorResponse | null {
  switch (error.code) {
    case "23505":
      return {
        status: 409,
        message: "You already have a score for that date. Edit that round instead.",
      };
    case "23514":
      if (error.message.includes("older than your five retained scores")) {
        return { status: 422, message: error.message };
      }
      return {
        status: 400,
        message: "Scores must be between 1 and 45, for a round that has already been played.",
      };
    case "42501":
      return { status: 403, message: "You can only change your own scores." };
    default:
      return null;
  }
}
