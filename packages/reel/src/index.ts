/**
 * Remotion compositions land Saturday. Input is a real call's JSON.
 * CallReel + CoverageReel are required; ScopeReel is nice-to-have.
 * Source: docs/build-plan.md §4.
 */

export type CallReelProps = {
  transcript_turns: Array<{ offset_seconds?: number; speaker: string; text: string }>;
  structured_result: Record<string, unknown>;
  linked: Array<{ field: string; value: unknown; supported: boolean; score: number }>;
};

export type CoverageReelProps = {
  dialed: number;
  reached: number;
  unaccounted: number;
};

export type ScopeReelProps = {
  requested: string[];
  permitted: string[];
  blocked: string[];
};

export const REEL_COMPOSITIONS = ["CallReel", "CoverageReel", "TitleCards"] as const;
