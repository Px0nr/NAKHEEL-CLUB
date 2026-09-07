// هل العرض فعّال الآن؟ (ضمن التاريخ + الفترة الزمنية + مُفعّل)
export function promoActiveNow(pr, now = new Date()) {
  if (!pr.active) return false;
  const today = now.toISOString().split("T")[0];
  if (pr.from && today < pr.from) return false;
  if (pr.to && today > pr.to) return false;
  const h = now.getHours();
  if (pr.period === "morning" && !(h >= 6 && h < 16)) return false;
  if (pr.period === "evening" && !(h >= 16 && h <= 23)) return false;
  return true;
}
// أفضل عرض فعّال لقسم معيّن (الأعلى نسبة)
export function promoFor(promotions, cat) {
  const act = (promotions || []).filter(p => promoActiveNow(p) && (p.cat === "all" || p.cat === cat));
  if (!act.length) return null;
  return act.reduce((best, p) => (p.pct > best.pct ? p : best), act[0]);
}
