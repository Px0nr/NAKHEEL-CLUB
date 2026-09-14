import { describe, it, expect, beforeEach } from "vitest";
import { dirX, isRTL, D, setAppAnimations, motionEnabled, prefersReducedMotion } from "./motionPrefs.js";
import { EASE, EASE_EXIT, gsap } from "./motion.js";

beforeEach(() => { setAppAnimations(true); });

describe("dirX", () => {
  it("يعكس الإزاحة الأفقية في واجهة RTL", () => {
    // تحويلات CSS دائماً يسار→يمين، فالإزاحة المنطقية «من جهة البداية» تُعكس
    expect(isRTL()).toBe(true);
    expect(dirX(40)).toBe(-40);
    expect(dirX(-40)).toBe(40);
  });

  it("لا يغيّر الصفر", () => {
    // toBeCloseTo لا toBe: نفي الصفر في JS ينتج ‎-0 وهو مطابق للصفر عملياً
    // (‏String(-0) === "0"، وGSAP تعامله كصفر)، لكن Object.is يفرّق بينهما
    expect(dirX(0)).toBeCloseTo(0);
  });
});

describe("المدد القياسية", () => {
  it("مرتّبة تصاعدياً وقصيرة بما يناسب أداة عمل يومية", () => {
    expect(D.micro).toBeLessThan(D.base);
    expect(D.base).toBeLessThan(D.slow);
    expect(D.slow).toBeLessThanOrEqual(0.6);
  });
});

describe("منحنيات الهوية", () => {
  it("تُسجَّل في GSAP بالأسماء المستخدمة في الافتراضات", () => {
    // CustomEase تسجّل المنحنى عالمياً بالاسم، فيصبح صالحاً كقيمة ease
    expect(gsap.parseEase(EASE)).toBeTypeOf("function");
    expect(gsap.parseEase(EASE_EXIT)).toBeTypeOf("function");
  });

  it("منحنى الحركة العامة يبدأ عند 0 وينتهي عند 1", () => {
    const ease = gsap.parseEase(EASE);
    expect(ease(0)).toBeCloseTo(0, 5);
    expect(ease(1)).toBeCloseTo(1, 5);
  });

  it("منحنى الحركة العامة سريع البداية (يتجاوز منتصف المسافة قبل منتصف الزمن)", () => {
    // هذا هو جوهر إحساس cubic-bezier(.2,.8,.2,1) المستخدم في النظام أصلاً
    expect(gsap.parseEase(EASE)(0.5)).toBeGreaterThan(0.5);
  });
});

describe("فصل وحدة التفضيل عن GSAP", () => {
  it("motionPrefs.js لا تستورد GSAP ولا أي وحدة تجرّها", async () => {
    // حارس معماري: App.jsx تستورد motionPrefs.js وهي في الحزمة الرئيسية التي
    // تُحمَّل عند شاشة الدخول. أي استيراد لـ GSAP هنا يعيد +33KB مضغوطة إلى
    // المسار الأول — وهو ما قِيس فعلاً قبل هذا الفصل.
    const fs = await import("node:fs/promises");
    const src = await fs.readFile(new URL("./motionPrefs.js", import.meta.url), "utf8");
    const imports = [...src.matchAll(/^\s*import\s.*?from\s+["']([^"']+)["']/gm)].map(m => m[1]);
    expect(imports.filter(p => p.includes("gsap"))).toEqual([]);
    expect(imports).toEqual([]); // لا اعتمادات إطلاقاً — وحدة نقية بالكامل
  });
});

describe("تفضيل الحركة", () => {
  it("مفعّل افتراضياً", () => {
    expect(motionEnabled()).toBe(true);
  });

  it("ينطفئ عند إطفاء مفتاح الإعدادات", () => {
    setAppAnimations(false);
    expect(motionEnabled()).toBe(false);
  });

  it("يعود بالتشغيل مرة أخرى", () => {
    setAppAnimations(false);
    setAppAnimations(true);
    expect(motionEnabled()).toBe(true);
  });

  it("يتحمّل بيئة بلا matchMedia دون أن ينهار", () => {
    // بيئة الاختبارات (node) بلا window: يجب أن تعود القيمة false لا أن تُرمى استثناء
    expect(prefersReducedMotion()).toBe(false);
  });
});
