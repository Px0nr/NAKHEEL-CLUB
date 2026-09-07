import { describe, it, expect } from "vitest";
import { fitWithin, dataUrlBytes, MAX_IMAGE_DIM } from "./image.js";

describe("fitWithin", () => {
  it("لا يكبّر صورة أصغر من الحدّ", () => {
    expect(fitWithin(100, 80, 256)).toEqual({ width: 100, height: 80 });
  });

  it("يصغّر بالضلع الأطول مع حفظ النسبة", () => {
    // 1200×600 بحدّ 256 → المقياس 256/1200، فالارتفاع 128
    expect(fitWithin(1200, 600, 256)).toEqual({ width: 256, height: 128 });
  });

  it("يتعامل مع الصور الطولية (الارتفاع هو الأطول)", () => {
    expect(fitWithin(600, 1200, 256)).toEqual({ width: 128, height: 256 });
  });

  it("لا ينتج بعداً صفرياً لصورة شديدة الاستطالة", () => {
    const r = fitWithin(4000, 3, 256);
    expect(r.width).toBe(256);
    expect(r.height).toBeGreaterThanOrEqual(1); // لا 0 — canvas بعرض/ارتفاع صفر يفشل
  });

  it("يتحمّل الأبعاد الصفرية أو المفقودة", () => {
    expect(fitWithin(0, 0)).toEqual({ width: 0, height: 0 });
    expect(fitWithin(undefined, 100)).toEqual({ width: 0, height: 0 });
  });

  it("الحدّ الافتراضي أكبر بكثير من أكبر مقاس عرض في النظام (46 بكسل)", () => {
    // ضمان أن التصغير لا يُفقد جودةً مرئية حتى على شاشة بكثافة 3x
    expect(MAX_IMAGE_DIM).toBeGreaterThanOrEqual(46 * 3);
  });
});

describe("dataUrlBytes", () => {
  it("يحسب حجم البايتات من جزء base64", () => {
    // "AAAA" أربعة محارف base64 = 3 بايتات
    expect(dataUrlBytes("data:image/jpeg;base64,AAAA")).toBe(3);
  });

  it("يخصم حشو '=' من الحساب", () => {
    expect(dataUrlBytes("data:image/jpeg;base64,AAA=")).toBe(2);
    expect(dataUrlBytes("data:image/jpeg;base64,AA==")).toBe(1);
  });

  it("يعيد صفراً لمدخل غير صالح", () => {
    expect(dataUrlBytes(null)).toBe(0);
    expect(dataUrlBytes("ليست data url")).toBe(0);
    expect(dataUrlBytes(12345)).toBe(0);
  });
});
