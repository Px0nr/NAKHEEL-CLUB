/* =========================================================================
   تفضيل الحركة — وحدة نقية خفيفة بلا أي اعتماد على GSAP.

   مفصولة عمداً عن motion.js: تستوردها App.jsx (وهي في الحزمة الرئيسية التي
   تُحمَّل عند شاشة الدخول)، بينما motion.js تستوردها مكوّنات الرسوم والصفحات
   الكسولة فقط. لو كانت الاثنتان ملفاً واحداً لدخلت GSAP كاملةً حزمةَ الدخول
   بلا داعٍ — وهو ما قِيس فعلاً: +33KB مضغوطة على المسار الأول.
   ========================================================================= */

/* مصدران مستقلان لتفضيل الحركة: مفتاح الإعدادات داخل النظام
   (settings.animations)، وتفضيل نظام التشغيل (prefers-reduced-motion) الذي
   لم يكن مُحترماً قبل هذه الطبقة. أيّهما طلب التقليل يُحترم. */
let appAnimations = true;
const listeners = new Set();
const emit = () => listeners.forEach(fn => fn());

export const subscribeMotion = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

const reduceQuery = typeof window !== "undefined" && window.matchMedia
  ? window.matchMedia("(prefers-reduced-motion: reduce)")
  : null;
reduceQuery?.addEventListener?.("change", emit); // تغيير التفضيل أثناء التشغيل يُطبَّق فوراً

export const prefersReducedMotion = () => !!reduceQuery?.matches;

// تستدعيها App.jsx عند تغيّر مفتاح الإعدادات
export function setAppAnimations(on) {
  const next = !!on;
  if (appAnimations === next) return;
  appAnimations = next;
  emit();
}

export const motionEnabled = () => appAnimations && !prefersReducedMotion();

/* ---------- الاتجاه (RTL) ----------
   تحويلات CSS تعمل دائماً يسار→يمين مهما كانت قيمة dir: القيمة الموجبة لـ x
   تزيح العنصر يميناً حتى في واجهة عربية. لذلك أي حركة "قادمة من الجانب"
   يجب أن تُعكس يدوياً، وإلا بدت آتية من الجهة الخاطئة بصرياً. */
let rtlCache = null;
export function isRTL() {
  if (rtlCache === null) {
    rtlCache = typeof document === "undefined"
      ? true // بيئة الاختبارات (node): النظام عربي RTL بالكامل
      : (document.documentElement.getAttribute("dir") || "rtl").toLowerCase() === "rtl";
  }
  return rtlCache;
}

// تحويل إزاحة أفقية منطقية (موجب = من جهة بداية القراءة) إلى إزاحة CSS فعلية
export const dirX = (px) => (isRTL() ? -px : px);

/* المدد القياسية بالثواني — قصيرة عمداً. هذا نظام تشغيل يومي متكرّر
   (نقطة بيع، جرد، تقارير) لا واجهة دعائية؛ الحركة الطويلة هنا تعطّل الموظف. */
export const D = {
  micro: 0.18, // ردود فعل فورية: ضغط، تبديل حالة، تلميح
  base: 0.32,  // الافتراضي: دخول بطاقة، انتقال قيمة
  slow: 0.55,  // تحوّلات أكبر: رسم بياني، انتقال صفحة
};
