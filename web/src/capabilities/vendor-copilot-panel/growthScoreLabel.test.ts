import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { growthScoreBand, growthScoreStatusPresentation } from "@/capabilities/vendor-copilot-panel/growthScoreLabel";

describe("growthScoreStatusPresentation", () => {
  it("labels a good lever", () => {
    assert.deepEqual(growthScoreStatusPresentation("good"), { label: "Good", tone: "success" });
  });

  it("labels an ok lever as could improve, with a warning tone", () => {
    assert.deepEqual(growthScoreStatusPresentation("ok"), { label: "Could improve", tone: "warning" });
  });

  it("labels a needs_work lever as critical", () => {
    assert.deepEqual(growthScoreStatusPresentation("needs_work"), { label: "Needs work", tone: "critical" });
  });
});

describe("growthScoreBand", () => {
  it("bands a high score as success", () => {
    assert.equal(growthScoreBand(90), "success");
    assert.equal(growthScoreBand(75), "success");
  });

  it("bands a mid score as warning", () => {
    assert.equal(growthScoreBand(74), "warning");
    assert.equal(growthScoreBand(40), "warning");
  });

  it("bands a low score as critical", () => {
    assert.equal(growthScoreBand(39), "critical");
    assert.equal(growthScoreBand(0), "critical");
  });
});
