import { describe, expect, it } from "vitest";

import { isValidRolloutPercentage } from "@/lib/feature-flags-api";

describe("feature flag rollout percentage", () => {
  it("allows whole-number rollouts from 0 through 100", () => {
    expect(isValidRolloutPercentage(0)).toBe(true);
    expect(isValidRolloutPercentage(100)).toBe(true);
    expect(isValidRolloutPercentage(55)).toBe(true);
  });

  it("rejects values outside the 0 to 100 range or non-whole percentages", () => {
    expect(isValidRolloutPercentage(-1)).toBe(false);
    expect(isValidRolloutPercentage(101)).toBe(false);
    expect(isValidRolloutPercentage(12.5)).toBe(false);
  });
});