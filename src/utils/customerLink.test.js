import { describe, it, expect, vi } from "vitest";
import { pointsEarnedFor, customerSaleDelta, applyCustomerSale } from "./customerLink.js";

describe("pointsEarnedFor", () => {
  it("صفر إن كان الولاء مُعطَّلاً", () => {
    expect(pointsEarnedFor(100, { loyaltyOn: false })).toBe(0);
  });
  it("يحسب النقاط حسب pointsPerCurrency", () => {
    expect(pointsEarnedFor(100, { loyaltyOn: true, pointsPerCurrency: 10 })).toBe(10);
  });
  it("يستخدم 10 افتراضياً إن لم يُحدَّد", () => {
    expect(pointsEarnedFor(25, { loyaltyOn: true })).toBe(2);
  });
});

describe("customerSaleDelta", () => {
  it("بيع فوري: يزيد الإجمالي والفواتير بلا دَين", () => {
    const d = customerSaleDelta({ total: 50, deferred: false, settings: {} });
    expect(d).toEqual({ totalDelta: 50, invoicesDelta: 1, debtDelta: 0, pointsDelta: 0 });
  });
  it("بيع آجل: يزيد الدَين أيضاً", () => {
    const d = customerSaleDelta({ total: 50, deferred: true, settings: {} });
    expect(d.debtDelta).toBe(50);
    expect(d.totalDelta).toBe(50);
  });
});

describe("applyCustomerSale", () => {
  it("يراكم القيم على الزبون الصحيح فقط", () => {
    let customers = [{ id: 1, total: 100, invoices: 2, debt: 0, points: 5 }, { id: 2, total: 0, invoices: 0, debt: 0, points: 0 }];
    const setCustomers = vi.fn(fn => { customers = fn(customers); });
    applyCustomerSale(setCustomers, 1, { totalDelta: 50, invoicesDelta: 1, debtDelta: 50, pointsDelta: 5 }, { date: "2026-09-09" });
    expect(customers[0]).toMatchObject({ total: 150, invoices: 3, debt: 50, points: 10, last: "2026-09-09" });
    expect(customers[1]).toMatchObject({ total: 0, invoices: 0 });
  });
});
