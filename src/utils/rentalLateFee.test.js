import { describe, it, expect } from "vitest";
import { computeLateFee } from "./rentalLateFee.js";

describe("computeLateFee", () => {
  it("لا غرامة إن أُعيد في الموعد أو قبله", () => {
    expect(computeLateFee("2026-09-09T12:00:00Z", "2026-09-09T11:59:00Z", 20)).toEqual({ lateDays: 0, lateFee: 0 });
    expect(computeLateFee("2026-09-09T12:00:00Z", "2026-09-09T12:00:00Z", 20)).toEqual({ lateDays: 0, lateFee: 0 });
  });

  it("يحتسب يوماً كاملاً حتى لو كان التأخير دقيقة واحدة", () => {
    expect(computeLateFee("2026-09-09T12:00:00Z", "2026-09-09T12:01:00Z", 20)).toEqual({ lateDays: 1, lateFee: 20 });
  });

  it("يحتسب يومين ونصف كثلاثة أيام (تقريب لأعلى)", () => {
    expect(computeLateFee("2026-09-09T12:00:00Z", "2026-09-12T00:00:00Z", 20).lateDays).toBe(3);
  });

  it("يضرب عدد الأيام في السعر اليومي", () => {
    expect(computeLateFee("2026-09-09T12:00:00Z", "2026-09-11T12:00:00Z", 15).lateFee).toBe(30);
  });
});
