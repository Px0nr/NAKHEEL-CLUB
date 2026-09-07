import { describe, it, expect } from "vitest";
import { promoActiveNow, promoFor } from "./promos.js";

const morning = new Date(2026, 5, 15, 10, 0); // June 15, 2026, 10:00 local
const evening = new Date(2026, 5, 15, 18, 0); // June 15, 2026, 18:00 local

describe("promoActiveNow", () => {
  it("is false when the promo is not active", () => {
    expect(promoActiveNow({ active: false }, morning)).toBe(false);
  });
  it("is false before the promo's start date", () => {
    expect(promoActiveNow({ active: true, from: "2026-07-01" }, morning)).toBe(false);
  });
  it("is false after the promo's end date", () => {
    expect(promoActiveNow({ active: true, to: "2026-05-01" }, morning)).toBe(false);
  });
  it("is true within the date range with no time-of-day restriction", () => {
    expect(promoActiveNow({ active: true, from: "2026-01-01", to: "2026-12-31" }, morning)).toBe(true);
  });
  it("respects a morning-only period", () => {
    expect(promoActiveNow({ active: true, period: "morning" }, morning)).toBe(true);
    expect(promoActiveNow({ active: true, period: "morning" }, evening)).toBe(false);
  });
  it("respects an evening-only period", () => {
    expect(promoActiveNow({ active: true, period: "evening" }, evening)).toBe(true);
    expect(promoActiveNow({ active: true, period: "evening" }, morning)).toBe(false);
  });
});

describe("promoFor", () => {
  const promos = [
    { id: 1, active: true, cat: "cafe", pct: 10 },
    { id: 2, active: true, cat: "cafe", pct: 25 },
    { id: 3, active: true, cat: "games", pct: 50 },
    { id: 4, active: false, cat: "all", pct: 90 },
  ];
  it("returns the highest-percentage active promo for the category", () => {
    expect(promoFor(promos, "cafe").id).toBe(2);
  });
  it("includes 'all'-category promos as candidates", () => {
    const withAll = [...promos, { id: 5, active: true, cat: "all", pct: 5 }];
    expect(promoFor(withAll, "cafe").id).toBe(2); // still the 25% one, not the 5% all-promo
  });
  it("returns null when there is no matching active promo", () => {
    expect(promoFor(promos, "rentals")).toBeNull();
  });
});
