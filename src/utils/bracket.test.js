import { describe, it, expect } from "vitest";
import { nextPow2, roundLabels, buildBracket, setMatchWinner } from "./bracket.js";

describe("nextPow2", () => {
  it("returns the smallest power of 2 >= n", () => {
    expect(nextPow2(1)).toBe(2);
    expect(nextPow2(3)).toBe(4);
    expect(nextPow2(4)).toBe(4);
    expect(nextPow2(5)).toBe(8);
    expect(nextPow2(9)).toBe(16);
  });
});

describe("roundLabels", () => {
  it("uses the named labels for known round counts", () => {
    expect(roundLabels(1)).toEqual(["النهائي"]);
    expect(roundLabels(3)).toEqual(["ربع النهائي", "نصف النهائي", "النهائي"]);
  });
  it("falls back to generic labels for larger round counts", () => {
    expect(roundLabels(5)).toEqual(["الدور 1", "الدور 2", "الدور 3", "الدور 4", "الدور 5"]);
  });
});

const players = (n) => Array.from({ length: n }, (_, i) => ({ id: i + 1, name: `P${i + 1}` }));

describe("buildBracket", () => {
  it("builds a full first round with no byes when participant count matches size", () => {
    const rounds = buildBracket(players(4), 4);
    expect(rounds).toHaveLength(2); // log2(4) = 2 rounds
    expect(rounds[0]).toHaveLength(2); // 4/2 matches
    expect(rounds[0].every(m => m.p1 && m.p2 && m.status === "pending")).toBe(true);
    expect(rounds[1]).toHaveLength(1);
  });

  it("assigns a bye winner when a match is missing an opponent", () => {
    const rounds = buildBracket(players(3), 4);
    const byeMatch = rounds[0].find(m => m.status === "bye");
    expect(byeMatch).toBeTruthy();
    expect(byeMatch.winner).not.toBeNull();
  });

  it("auto-advances bye winners into the next round", () => {
    const rounds = buildBracket(players(3), 4);
    const byeMatch = rounds[0].find(m => m.status === "bye");
    const advanced = rounds[1].some(m => m.p1 === byeMatch.winner || m.p2 === byeMatch.winner);
    expect(advanced).toBe(true);
  });
});

describe("setMatchWinner", () => {
  it("records the winner/score and advances them to the next round", () => {
    const rounds = buildBracket(players(4), 4);
    const { rounds: next } = setMatchWinner(rounds, 0, 0, 1, "3", "1");
    expect(next[0][0].winner).toBe(1);
    expect(next[0][0].score1).toBe(3);
    expect(next[0][0].score2).toBe(1);
    expect(next[1][0].p1).toBe(1);
  });

  it("does not mutate the original rounds array", () => {
    const rounds = buildBracket(players(4), 4);
    setMatchWinner(rounds, 0, 0, 1, "3", "1");
    expect(rounds[0][0].winner).toBeNull();
  });

  it("declares a champion and runner-up once the final match is decided", () => {
    const rounds = buildBracket(players(2), 2);
    const { champion, runnerUp } = setMatchWinner(rounds, 0, 0, 1, "2", "0");
    expect(champion).toBe(1);
    expect(runnerUp).toBe(2);
  });
});
