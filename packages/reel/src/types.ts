export type CallReelTurn = {
  offset_seconds?: number;
  speaker: string;
  text: string;
};

export type CallReelField = {
  field: string;
  value: unknown;
  supported: boolean;
  score: number;
  turnText?: string | null;
  turnOffset?: number | null;
};

export type CallReelProps = {
  household: string;
  disposition: string;
  transcript_turns: CallReelTurn[];
  structured_result?: Record<string, unknown>;
  linked: CallReelField[];
};

export type CoverageReelProps = {
  dialed: number;
  reached: number;
  unaccounted: number;
  names?: string[];
};

export type TitleCardsProps = {
  event?: string;
};

export type ScopeReelProps = {
  requested: string[];
  permitted: string[];
  blocked: string[];
};
