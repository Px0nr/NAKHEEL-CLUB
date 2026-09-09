import { describe, it, expect } from "vitest";
import { payBreakdown, buildSplit } from "./payments.js";

describe("payBreakdown", () => {
  it("يعطي جزءاً واحداً للفاتورة العادية", () => {
    expect(payBreakdown({ pay: "كاش", total: 120 })).toEqual([{ method: "كاش", amount: 120 }]);
  });

  it("يعطي الأجزاء كما هي للفاتورة المقسَّمة", () => {
    const parts = [{ method: "كاش", amount: 70 }, { method: "بطاقة", amount: 50 }];
    expect(payBreakdown({ pay: "كاش + بطاقة", total: 120, payParts: parts })).toEqual(parts);
  });

  it("يتجاهل payParts الفارغة ويعود للطريقة الواحدة", () => {
    expect(payBreakdown({ pay: "بطاقة", total: 30, payParts: [] })).toEqual([{ method: "بطاقة", amount: 30 }]);
  });

  it("مجموع الأجزاء يساوي إجمالي الفاتورة", () => {
    const inv = { pay: "كاش + تحويل", total: 120, payParts: [{ method: "كاش", amount: 45.5 }, { method: "تحويل", amount: 74.5 }] };
    expect(payBreakdown(inv).reduce((s, p) => s + p.amount, 0)).toBe(inv.total);
  });
});

describe("buildSplit", () => {
  it("يقسّم الإجمالي على طريقتين والباقي للثانية", () => {
    const r = buildSplit({ total: 120, firstMethod: "كاش", firstAmount: "70", secondMethod: "بطاقة" });
    expect(r.parts).toEqual([{ method: "كاش", amount: 70 }, { method: "بطاقة", amount: 50 }]);
    expect(r.label).toBe("كاش + بطاقة");
  });

  it("يرفض تساوي الطريقتين", () => {
    expect(buildSplit({ total: 100, firstMethod: "كاش", firstAmount: "40", secondMethod: "كاش" }).error).toBeTruthy();
  });

  it("يرفض مبلغاً صفرياً أو سالباً", () => {
    expect(buildSplit({ total: 100, firstMethod: "كاش", firstAmount: "0", secondMethod: "بطاقة" }).error).toBeTruthy();
    expect(buildSplit({ total: 100, firstMethod: "كاش", firstAmount: "-5", secondMethod: "بطاقة" }).error).toBeTruthy();
  });

  it("يرفض مبلغاً يساوي الإجمالي أو يتجاوزه (لا معنى لتقسيم بلا جزء ثانٍ)", () => {
    expect(buildSplit({ total: 100, firstMethod: "كاش", firstAmount: "100", secondMethod: "بطاقة" }).error).toBeTruthy();
    expect(buildSplit({ total: 100, firstMethod: "كاش", firstAmount: "150", secondMethod: "بطاقة" }).error).toBeTruthy();
  });

  it("يضبط الكسور العشرية فلا تتسرّب أخطاء الفاصلة العائمة إلى المبالغ", () => {
    const r = buildSplit({ total: 100, firstMethod: "كاش", firstAmount: "33.33", secondMethod: "تحويل" });
    expect(r.parts[1].amount).toBe(66.67);
    expect(r.parts[0].amount + r.parts[1].amount).toBe(100);
  });
});
