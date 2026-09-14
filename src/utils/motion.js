import { useSyncExternalStore } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { CustomEase } from "gsap/CustomEase";
import { subscribeMotion, motionEnabled, dirX, D } from "./motionPrefs.js";

/* =========================================================================
   طبقة الحركة (GSAP) — تُبنى فوق motionPrefs.js وتضيف إليها منحنيات الهوية
   والافتراضات وخطاف الحركة.

   ⚠ لا تستوردها الحزمة الرئيسية: هذه الوحدة تجرّ GSAP كاملةً (~33KB مضغوطة).
   تستوردها الصفحات والمكوّنات الكسولة فقط (الرسوم، نقطة البيع…)، أما ما يحتاج
   قراءة التفضيل أو ضبطه — كـ App.jsx — فيستورد motionPrefs.js وحدها.
   ========================================================================= */

/* تُسجَّل الإضافات مرة واحدة على مستوى التطبيق. لا يُسجَّل هنا إلا ما يُستخدم فعلاً:
   مجرّد استيراد الإضافة يضمّها للحزمة، فتُضاف Flip وDrawSVG وScrollTrigger
   في المحاور التي تحتاجها لا قبلها. */
gsap.registerPlugin(useGSAP, CustomEase);

/* ---------- منحنيات هوية النظام ----------
   حركات CSS الحالية تستخدم cubic-bezier(.2,.8,.2,1) في كل مكان تقريباً.
   نعيد تعريفه هنا باسم "nk" ليبقى الإحساس البصري مطابقاً تماماً بعد الانتقال
   إلى GSAP، فلا يشعر المستخدم بأن سلوك الواجهة تغيّر. */
CustomEase.create("nk", "0.2, 0.8, 0.2, 1");    // الحركة العامة: انطلاقة سريعة واستقرار هادئ
CustomEase.create("nkIn", "0.4, 0, 0.9, 0.4");  // الخروج: يبدأ هادئاً ثم يتسارع للاختفاء

export const EASE = "nk";
export const EASE_EXIT = "nkIn";

gsap.defaults({ duration: D.base, ease: EASE });

/* ---------- خطاف الحركة ----------
   غلاف حول useGSAP يمرّر أدوات مراعية لتفضيل الحركة، ويعيد بناء الحركات
   تلقائياً عند تبديل التفضيل (قيمة التمكين جزء من مصفوفة الاعتماديات).

   الوسيط الأول للدالة هو m ويحوي:
     m.enabled / m.reduced — حالة التفضيل
     m.d(seconds)          — سلّم زمني: يُصفّر المدد والتأخيرات والتباعد عند طلب
                             تقليل الحركة. تصفير المدة (لا تخطّي الحركة) هو
                             المطلوب: العنصر يصل حالته النهائية فوراً بدل أن
                             يبقى عالقاً في حالته الأولى غير مرئي.
     m.dirX(px)            — إزاحة أفقية مراعية للـ RTL

   ملاحظة: لا يُفعَّل revertOnUpdate افتراضياً. الحركات المعتمدة على البيانات
   (المحور الثاني) تحتاج الانطلاق من القيمة المعروضة حالياً، والإرجاع التلقائي
   يعيدها لحالتها الأصلية أولاً فيُفقد ذلك. من يحتاجه يمرّره صراحةً. */
export function useMotion(fn, config = {}) {
  const enabled = useSyncExternalStore(subscribeMotion, motionEnabled, () => true);
  const { dependencies = [], ...rest } = config;
  return useGSAP((context, contextSafe) => {
    const m = {
      enabled,
      reduced: !enabled,
      d: (seconds = D.base) => (enabled ? seconds : 0),
      dirX,
    };
    return fn(m, context, contextSafe);
  }, { ...rest, dependencies: [...dependencies, enabled] });
}

export { gsap, D, dirX };
