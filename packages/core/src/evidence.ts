/**
 * Link structured_result fields to transcript spans.
 * CALL-E returns evidence[] as natural-language justifications,
 * not offsets — scoring a field against user turns is our job.
 *
 * Source: docs/build-plan.md §2.4. Full scorer lands Friday AM / Saturday.
 */

export type TranscriptTurn = {
  offset_seconds?: number;
  speaker: "bot" | "user" | string;
  text: string;
};

export type LinkedField = {
  field: string;
  value: unknown;
  turn: TranscriptTurn | null;
  score: number;
  supported: boolean;
};

export type EvidenceLinkInput = {
  structuredResult: Record<string, unknown>;
  evidence?: string[];
  turns: TranscriptTurn[];
  threshold?: number;
};

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1);
}

function overlapScore(claim: string, turn: string): number {
  const claimTokens = new Set(tokenize(claim));
  const turnTokens = tokenize(turn);
  if (claimTokens.size === 0 || turnTokens.length === 0) return 0;
  const hits = turnTokens.filter((token) => claimTokens.has(token)).length;
  return hits / claimTokens.size;
}

export function linkEvidence(input: EvidenceLinkInput): LinkedField[] {
  const threshold = input.threshold ?? 0.35;
  const userTurns = input.turns.filter((turn) => turn.speaker === "user");
  const evidenceBlob = (input.evidence ?? []).join(" ");

  return Object.entries(input.structuredResult).map(([field, value]) => {
    const claim = `${field} ${String(value)} ${evidenceBlob}`;
    let best: { turn: TranscriptTurn; score: number } | null = null;
    for (const turn of userTurns) {
      const score = overlapScore(claim, turn.text);
      if (!best || score > best.score) best = { turn, score };
    }
    const score = best?.score ?? 0;
    return {
      field,
      value,
      turn: best && score >= threshold ? best.turn : null,
      score,
      supported: score >= threshold,
    };
  });
}
