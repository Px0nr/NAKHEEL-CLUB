import { describe, it, expect } from "vitest";
import { daysBetween, productBarcodes, matchesBarcode, matchesBarcodePartial, overdueDays, toWa } from "./format.js";

describe("daysBetween", () => {
  it("counts whole days between two ISO dates", () => {
    expect(daysBetween("2026-01-01", "2026-01-05")).toBe(4);
  });
  it("is negative when the second date is earlier", () => {
    expect(daysBetween("2026-01-05", "2026-01-01")).toBe(-4);
  });
});

describe("productBarcodes / matchesBarcode / matchesBarcodePartial", () => {
  const p = { bc: "1001", barcodes: ["1002", "1003"] };
  it("collects the primary and extra barcodes", () => {
    expect(productBarcodes(p)).toEqual(["1001", "1002", "1003"]);
  });
  it("omits missing barcodes", () => {
    expect(productBarcodes({ bc: "1001" })).toEqual(["1001"]);
  });
  it("matches an exact barcode", () => {
    expect(matchesBarcode(p, "1002")).toBe(true);
    expect(matchesBarcode(p, "9999")).toBe(false);
  });
  it("matches a partial barcode", () => {
    expect(matchesBarcodePartial(p, "100")).toBe(true);
    expect(matchesBarcodePartial(p, "999")).toBe(false);
  });
});

describe("overdueDays", () => {
  it("is zero for a non-deferred invoice", () => {
    expect(overdueDays({ pay: "كاش", status: "معلقة", date: "2026-01-01" }, "2026-02-01")).toBe(0);
  });
  it("is zero for a settled deferred invoice", () => {
    expect(overdueDays({ pay: "آجل", status: "مدفوعة", date: "2026-01-01" }, "2026-02-01")).toBe(0);
  });
  it("is zero when still within the due date", () => {
    expect(overdueDays({ pay: "آجل", status: "معلقة", date: "2026-01-01" }, "2026-01-01")).toBe(0);
  });
  it("returns the number of overdue days using dueDate when present", () => {
    expect(overdueDays({ pay: "آجل", status: "معلقة", date: "2026-01-01", dueDate: "2026-01-10" }, "2026-01-15")).toBe(5);
  });
  it("falls back to the invoice date when no dueDate is set", () => {
    expect(overdueDays({ pay: "آجل", status: "معلقة", date: "2026-01-01" }, "2026-01-04")).toBe(3);
  });
});

describe("toWa", () => {
  it("converts a local 0-prefixed number to international format", () => {
    expect(toWa("0913-000-000")).toBe("218913000000");
  });
  it("strips a 00 international prefix before normalizing", () => {
    expect(toWa("0021891234567")).toBe("21891234567");
  });
  it("leaves an already-international number unchanged", () => {
    expect(toWa("218913000000")).toBe("218913000000");
  });
  it("returns an empty string for empty input", () => {
    expect(toWa("")).toBe("");
    expect(toWa(undefined)).toBe("");
  });
});
