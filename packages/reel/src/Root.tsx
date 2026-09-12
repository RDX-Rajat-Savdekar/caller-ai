import { Composition } from "remotion";
import {
  CallReel,
  CALL_REEL_DURATION_FALLBACK,
  CALL_REEL_FPS,
  CALL_REEL_HEIGHT,
  CALL_REEL_WIDTH,
  callReelFrames,
} from "./CallReel";
import { CoverageReel, COVERAGE_REEL_DURATION, COVERAGE_REEL_FPS, COVERAGE_REEL_HEIGHT, COVERAGE_REEL_WIDTH } from "./CoverageReel";
import { TitleCards, TITLE_CARDS_DURATION, TITLE_CARDS_FPS, TITLE_CARDS_HEIGHT, TITLE_CARDS_WIDTH } from "./TitleCards";
import type { CallReelProps, CoverageReelProps } from "./types";

const sampleCall: CallReelProps = {
  household: "Household 07",
  disposition: "answered_confirmed",
  transcript_turns: [
    { offset_seconds: 0, speaker: "bot", text: "This is an automated AI assistant from Sonoma County Emergency Management." },
    { offset_seconds: 7, speaker: "user", text: "Hi." },
    { offset_seconds: 9, speaker: "bot", text: "Is everyone in the household safe and accounted for?" },
    { offset_seconds: 13, speaker: "user", text: "Yes, we are all safe and we are staying here." },
    { offset_seconds: 18, speaker: "bot", text: "Do you have electricity right now? Running water?" },
    { offset_seconds: 23, speaker: "user", text: "The water is on. I am not sure about the rest." },
    { offset_seconds: 28, speaker: "bot", text: "Does anyone need prescription medication you cannot get?" },
    { offset_seconds: 32, speaker: "user", text: "No medication issues." },
  ],
  linked: [
    { field: "safety_status", value: "safe", supported: true, score: 1, turnText: "Yes, we are all safe and we are staying here.", turnOffset: 13 },
    { field: "has_power", value: "yes", supported: false, score: 0, turnText: null, turnOffset: null },
    { field: "has_water", value: "yes", supported: true, score: 1, turnText: "The water is on. I am not sure about the rest.", turnOffset: 23 },
  ],
};

const sampleCoverage: CoverageReelProps = {
  dialed: 12,
  reached: 8,
  unaccounted: 4,
  names: ["Household 02", "Household 05", "Household 08", "Household 10"],
};

export const RemotionRoot = () => (
  <>
    <Composition
      id="CallReel"
      component={CallReel}
      durationInFrames={callReelFrames(sampleCall.transcript_turns.length) || CALL_REEL_DURATION_FALLBACK}
      fps={CALL_REEL_FPS}
      width={CALL_REEL_WIDTH}
      height={CALL_REEL_HEIGHT}
      defaultProps={sampleCall}
    />
    <Composition
      id="CoverageReel"
      component={CoverageReel}
      durationInFrames={COVERAGE_REEL_DURATION}
      fps={COVERAGE_REEL_FPS}
      width={COVERAGE_REEL_WIDTH}
      height={COVERAGE_REEL_HEIGHT}
      defaultProps={sampleCoverage}
    />
    <Composition
      id="TitleCards"
      component={TitleCards}
      durationInFrames={TITLE_CARDS_DURATION}
      fps={TITLE_CARDS_FPS}
      width={TITLE_CARDS_WIDTH}
      height={TITLE_CARDS_HEIGHT}
      defaultProps={{ event: "Bennett Valley fire" }}
    />
  </>
);
