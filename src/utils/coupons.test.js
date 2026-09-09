import { describe, it, expect } from "vitest";
import { couponState, couponActive } from "./coupons.js";

const TODAY = "2026-09-10";
const base = { status: "نشط", exp: "2026-12-31", used: 0, limit: 100 };

describe("couponState", () => {
  it("نشط عند استيفاء كل الشروط", () => {
    expect(couponState(base, TODAY)).toBe("نشط");
  });
  it("معطّل عند تعطيله يدوياً", () => {
    expect(couponState({ ...base, status: "معطّل" }, TODAY)).toBe("معطّل");
  });
  it("منتهي عند تجاوز تاريخ الصلاحية ولو كان status نشطاً", () => {
    expect(couponState({ ...base, exp: "2026-01-01" }, TODAY)).toBe("منتهي");
  });
  it("مكتمل عند بلوغ حد الاستخدام", () => {
    expect(couponState({ ...base, used: 100, limit: 100 }, TODAY)).toBe("مكتمل");
  });
  it("التعطيل اليدوي له الأولوية على بقية الأسباب", () => {
    expect(couponState({ ...base, status: "معطّل", exp: "2026-01-01" }, TODAY)).toBe("معطّل");
  });
  it("كوبون غير موجود يُعتبر معطّلاً", () => {
    expect(couponState(null, TODAY)).toBe("معطّل");
  });
});

describe("couponActive", () => {
  it("true فقط عندما تكون الحالة نشط", () => {
    expect(couponActive(base, TODAY)).toBe(true);
    expect(couponActive({ ...base, exp: "2026-01-01" }, TODAY)).toBe(false);
  });
});
