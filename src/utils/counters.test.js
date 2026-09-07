import { describe, it, expect, vi } from "vitest";
import { nextCounter } from "./counters.js";

describe("nextCounter", () => {
  it("increments the named counter and returns the new value", () => {
    const setCounters = vi.fn();
    const result = nextCounter({ invoice: 1047 }, setCounters, "invoice");
    expect(result).toBe(1048);
    expect(setCounters).toHaveBeenCalledTimes(1);
    const updater = setCounters.mock.calls[0][0];
    expect(updater({ invoice: 1047 })).toEqual({ invoice: 1048 });
  });

  it("starts from 1 when the key has never been used", () => {
    const setCounters = vi.fn();
    const result = nextCounter({}, setCounters, "po");
    expect(result).toBe(1);
  });

  it("only updates the requested key, leaving other counters untouched", () => {
    const setCounters = vi.fn();
    nextCounter({ invoice: 5, po: 9 }, setCounters, "po");
    const updater = setCounters.mock.calls[0][0];
    expect(updater({ invoice: 5, po: 9 })).toEqual({ invoice: 5, po: 10 });
  });
});
