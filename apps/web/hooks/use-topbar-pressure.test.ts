import { describe, expect, it } from "vitest";
import { resolveTopbarPressure, TOPBAR_TITLE_MIN_PX } from "./use-topbar-pressure";

// A chain wide enough that the two thresholds are far apart.
const chain = { chainFull: 300, chainMin: 80, titleNatural: 200 };

describe("resolveTopbarPressure", () => {
  it("applies no pressure while the full chain and floored title fit", () => {
    expect(resolveTopbarPressure({ available: 400, ...chain })).toEqual({
      crumbsCollapsed: false,
      actionsOverflowed: false,
    });
  });

  it("collapses ancestry before actions overflow", () => {
    // Between the two thresholds: too tight for the full chain, fine for the
    // collapsed one. Ancestry yields; actions stay inline.
    expect(resolveTopbarPressure({ available: 300, ...chain })).toEqual({
      crumbsCollapsed: true,
      actionsOverflowed: false,
    });
  });

  it("overflows actions only when even the collapsed chain squeezes the title floor", () => {
    expect(resolveTopbarPressure({ available: 150, ...chain })).toEqual({
      crumbsCollapsed: true,
      actionsOverflowed: true,
    });
  });

  it("never overflows actions without also collapsing ancestry", () => {
    const pressure = resolveTopbarPressure({
      available: 0,
      chainFull: 10,
      chainMin: 10,
      titleNatural: 10,
    });
    expect(pressure.actionsOverflowed).toBe(true);
    expect(pressure.crumbsCollapsed).toBe(true);
  });

  it("reserves only the floor for long titles", () => {
    // chainFull + natural title would not fit, but the policy only defends the
    // floor, and chainFull + floor fits exactly.
    expect(resolveTopbarPressure({ available: 300 + TOPBAR_TITLE_MIN_PX, ...chain })).toEqual({
      crumbsCollapsed: false,
      actionsOverflowed: false,
    });
  });

  it("reserves the natural width of titles shorter than the floor", () => {
    expect(
      resolveTopbarPressure({ available: 100, chainFull: 60, chainMin: 60, titleNatural: 50 }),
    ).toEqual({ crumbsCollapsed: true, actionsOverflowed: true });
  });
});
