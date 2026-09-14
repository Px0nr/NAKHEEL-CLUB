import { describe, it, expect } from "vitest";
import { parseBookingMinutes } from "./bookings.js";

describe("parseBookingMinutes", () => {
  it("returns 0 for empty input", () => {
    expect(parseBookingMinutes("")).toBe(0);
    expect(parseBookingMinutes(null)).toBe(0);
  });
  it("recognizes quarter and half hour shorthand", () => {
    expect(parseBookingMinutes("حجز — ربع")).toBe(15);
    expect(parseBookingMinutes("حجز — نصف")).toBe(30);
  });
  it("recognizes a plain hour", () => {
    expect(parseBookingMinutes("حجز — ساعة")).toBe(60);
  });
  it("parses hour-and-minutes notation", () => {
    expect(parseBookingMinutes("حجز — 2س 30د")).toBe(150);
    expect(parseBookingMinutes("حجز — 1س")).toBe(60);
  });
  it("parses minutes-only notation", () => {
    expect(parseBookingMinutes("حجز — 45د")).toBe(45);
  });
  it("returns 0 for unrecognized text", () => {
    expect(parseBookingMinutes("حجز — غير معروف")).toBe(0);
  });
});
