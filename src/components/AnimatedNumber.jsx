import { useRef } from "react";
import { fmt } from "../constants/theme.js";
import { useMotion, gsap, EASE, D } from "../utils/motion.js";

/* رقم يعدّ تصاعدياً/تنازلياً بين قيمتين بدل القفز.
   في وحدة مستقلة عن charts.jsx كي تستطيع نقطة البيع استخدامه بلا أن تجرّ
   مكوّنات الرسوم كلها إلى حزمتها. */
export default function AnimatedNumber({ value, suffix = "", style }) {
  const ref = useRef(null);
  const prevRef = useRef(null);
  useMotion((m) => {
    const el = ref.current;
    if (!el) return;
    const from = prevRef.current;
    prevRef.current = value;
    const write = (v) => { el.textContent = fmt(v) + suffix; };
    if (from == null || from === value || !m.enabled) { write(value); return; }
    // التقريب أثناء العدّ: للأعداد الصحيحة نبقى صحيحين، وإلا منزلة عشرية واحدة
    // حتى لا يهتزّ الرقم بخانتين عشريتين متغيّرتين بسرعة أثناء الحركة
    const snap = gsap.utils.snap(Number.isInteger(from) && Number.isInteger(value) ? 1 : 0.1);
    const proxy = { v: from };
    gsap.to(proxy, {
      v: value, duration: m.d(D.slow), ease: EASE, overwrite: "auto",
      onUpdate: () => write(snap(proxy.v)),
      onComplete: () => write(value), // ضمان الدقّة النهائية بلا أثر التقريب
    });
  }, { dependencies: [value] });
  return <span ref={ref} style={style}>{fmt(value)}{suffix}</span>;
}
