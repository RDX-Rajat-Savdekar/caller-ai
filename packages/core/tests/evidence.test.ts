import { describe, expect, it } from "vitest";
import { linkEvidence } from "../src/evidence";

describe("evidence linker", () => {
  it("marks a field unsupported when the transcript never said it", () => {
    const linked = linkEvidence({
      structuredResult: { has_power: "yes" },
      evidence: ["The recipient confirmed they have electricity."],
      turns: [{ speaker: "user", text: "We still have running water." }],
    });
    expect(linked[0]?.supported).toBe(false);
  });

  it("links a field to the supporting user turn", () => {
    const linked = linkEvidence({
      structuredResult: { has_water: "yes" },
      evidence: ["The recipient said they have running water."],
      turns: [
        { speaker: "bot", text: "Do you have running water?" },
        { speaker: "user", text: "Yes, we still have running water." },
      ],
    });
    expect(linked[0]?.supported).toBe(true);
    expect(linked[0]?.turn?.text).toMatch(/running water/i);
  });
});
