import { todayISO } from "./format.js";
import { fmt } from "../constants/theme.js";

/* =========================================================================
   طبقة التجميع المركزية — دوال نقية قابلة للاختبار تحسب التوزيع والنطاقات
   الزمنية والإيرادات، تُستهلك في لوحة التحكم والرؤى والتقارير بلا تكرار.
   ========================================================================= */

/* ---------- نظام الألوان التصنيفي ----------
   الترتيب الثماني ثابت ولا يجوز تدويره أو تغييره — هذا هو أساس أمان عمى الألوان (CVD).
   محقَّق عبر أداة dataviz (فحوصات فصل CVD والتباين) ضد سطحَي بطاقات التطبيق الفعليين
   (#fff فاتح / #1e1b16 داكن من constants/theme.js) وليس افتراضاً عاماً. */
export const CATEGORICAL_LIGHT = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];
export const CATEGORICAL_DARK = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"];
export const CHART_MUTED = "#898781"; // لون محايد لشريحة «أخرى» المجمَّعة — لا يحمل هوية قسم بعينه فلا يستحق لوناً حيوياً

// مصادر إيراد ليست أقساماً حقيقية للمنتجات (حجوزات/تأجير/أرصدة سابقة/غير مصنّف)
export const STREAM_LABELS = {
  __booking: "الحجوزات",
  __rental: "التأجير",
  __opening: "أرصدة سابقة",
  __uncat: "غير مصنّف",
};
const STREAM_ORDER = ["__booking", "__rental", "__opening", "__uncat"];

// اسم القسم للعرض: قسم منتج حقيقي (من cats)، أو مصدر إيراد، أو المفتاح نفسه
export const catLabel = (key, cats = {}) => cats[key] || STREAM_LABELS[key] || key;

// تعيين لون ثابت بهوية القسم لا بترتيبه — الأقسام الحقيقية أولاً (مرتَّبة أبجدياً بالمفتاح، لا بالقيمة)
// ثم مصادر الإيراد الاصطناعية بترتيب ثابت. هذا يضمن أن «كافيه» مثلاً يحصل دائماً على نفس اللون
// بصرف النظر عن ترتيبه في المبيعات — لو عُيِّن اللون حسب الترتيب بعد الفرز لتغيّر لونه كل يوم
// حسب أدائه النسبي، وهذا يكسر قابلية القراءة عبر الرسوم المختلفة ومع الوقت (color follows the entity, never its rank).
export function categoryColorMap(keys, dark = false) {
  const palette = dark ? CATEGORICAL_DARK : CATEGORICAL_LIGHT;
  const uniq = [...new Set(keys.map(String))];
  const real = uniq.filter(k => !k.startsWith("__")).sort();
  const streams = STREAM_ORDER.filter(k => uniq.includes(k));
  const rest = uniq.filter(k => !real.includes(k) && !streams.includes(k));
  const order = [...real, ...streams, ...rest];
  const map = {};
  order.forEach((k, i) => { map[k] = palette[i % palette.length]; });
  return map;
}

// المفتاح التصنيفي لفاتورة بلا items[] (بيانات قديمة أُنشئت قبل التوحيد) — يُشتق من مصدرها
export function sourceCat(inv) {
  if (inv.source === "حجز") return "__booking";
  if (inv.source === "تأجير") return "__rental";
  if (inv.source === "رصيد سابق") return "__opening";
  return "__uncat";
}

// إجمالي الإيراد لكل قسم/مصدر عبر فواتير معطاة —
// يعتمد items[].cat عند وجودها (الأدق، يفصل ألعاب/كافيه/...) ويتراجع لمصدر الفاتورة للبيانات القديمة.
// الأرصدة السابقة (ديون قبل النظام) ليست مبيعات فعلية فتُستثنى افتراضياً.
export function categoryTotals(invoices, { includeOpening = false } = {}) {
  const map = {};
  (invoices || []).forEach(inv => {
    if (inv.items && inv.items.length) {
      inv.items.forEach(it => {
        const k = it.cat || "__uncat";
        if (!includeOpening && k === "__opening") return;
        map[k] = (map[k] || 0) + (it.lineTotal || 0);
      });
    } else {
      const k = sourceCat(inv);
      if (!includeOpening && k === "__opening") return;
      map[k] = (map[k] || 0) + (inv.total || 0);
    }
  });
  return map;
}

// تحويل خريطة الأقسام إلى شرائح مرتّبة تنازلياً للرسوم (للعرض البصري فقط)، مع تجميع الذيل في شريحة «أخرى» محايدة اللون.
// ترتيب العرض بالقيمة، لكن تعيين اللون بالهوية الثابتة (categoryColorMap) — فصل متعمَّد بين الاثنين.
export function toSegments(totals, cats = {}, dark = false, maxSegments = 5) {
  const entries = Object.entries(totals).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, v]) => s + v, 0) || 1;
  const top = entries.slice(0, maxSegments);
  const restSum = entries.slice(maxSegments).reduce((s, [, v]) => s + v, 0);
  const colorMap = categoryColorMap(entries.map(([k]) => k), dark);
  const segs = top.map(([k, v]) => ({ key: k, label: catLabel(k, cats), value: v, pct: Math.round((v / total) * 100), color: colorMap[k] }));
  if (restSum > 0) segs.push({ key: "__more", label: "أخرى", value: restSum, pct: Math.round((restSum / total) * 100), color: CHART_MUTED });
  return segs;
}

/* ---------- النطاقات الزمنية المشتركة ---------- */
// تُشتق الحدود بيوم UTC (عبر Date.UTC + toISOString) ليطابق تماماً تأريخ الفواتير في todayISO،
// فلا تنزاح الأيام عند حدود الشهر بسبب فرق التوقيت المحلي
const isoUTC = (dt) => dt.toISOString().slice(0, 10);

// نطاق جاهز { from, to } بصيغة ISO
export function rangePreset(preset, ref = new Date()) {
  const y = ref.getUTCFullYear(), m = ref.getUTCMonth(), d = ref.getUTCDate();
  const today = isoUTC(ref);
  switch (preset) {
    case "today": return { from: today, to: today };
    case "last7": return { from: isoUTC(new Date(Date.UTC(y, m, d - 6))), to: today };
    case "last30": return { from: isoUTC(new Date(Date.UTC(y, m, d - 29))), to: today };
    case "thisMonth": return { from: isoUTC(new Date(Date.UTC(y, m, 1))), to: today };
    case "lastMonth": return { from: isoUTC(new Date(Date.UTC(y, m - 1, 1))), to: isoUTC(new Date(Date.UTC(y, m, 0))) };
    case "thisQuarter": { const q = Math.floor(m / 3) * 3; return { from: isoUTC(new Date(Date.UTC(y, q, 1))), to: today }; }
    case "lastQuarter": { const q = Math.floor(m / 3) * 3 - 3; return { from: isoUTC(new Date(Date.UTC(y, q, 1))), to: isoUTC(new Date(Date.UTC(y, q + 3, 0))) }; }
    case "thisYear": return { from: isoUTC(new Date(Date.UTC(y, 0, 1))), to: today };
    case "lastYear": return { from: isoUTC(new Date(Date.UTC(y - 1, 0, 1))), to: isoUTC(new Date(Date.UTC(y - 1, 11, 31))) };
    default: return { from: today, to: today };
  }
}

export const inRange = (date, from, to) => date >= from && date <= to;

// إجمالي إيراد الفواتير المدفوعة ضمن نطاق [from, to]
export function revenueInRange(invoices, from, to) {
  return (invoices || []).filter(i => i.status === "مدفوعة" && inRange(i.date, from, to)).reduce((s, i) => s + i.total, 0);
}

// عنوان النطاق الافتراضي (للاتساق) — اليوم
export const defaultRange = () => ({ from: todayISO(), to: todayISO() });

/* ---------- مقارنات الدلتا المشتركة (لوحة التحكم والرؤى) ---------- */
// نسبة التغيّر المئوية — 100% عند الانتقال من صفر لقيمة موجبة، 0% إن بقي عند صفر
export const pctDelta = (a, b) => b === 0 ? (a > 0 ? 100 : 0) : Math.round(((a - b) / b) * 100);

// نص الدلتا: نسبة مئوية عادةً — لكنها مضلِّلة رياضياً عند تقاطع الصفر أو القيم السالبة (كصافي الربح
// الذي قد ينتقل من خسارة لربح)، فنعرض عندها فرقاً بالعملة بدل نسبة مربكة (كـ"+400%" من رقم شبه معدوم)
export const deltaLabel = (a, b, cur = "", suffix = "") => {
  if (a >= 0 && b >= 0) return `${pctDelta(a, b)}%${suffix}`;
  const diff = Math.round(a - b);
  return `${diff >= 0 ? "+" : ""}${fmt(diff)} ${cur}${suffix}`;
};

/* ---------- صافي الربح ليوم واحد ---------- */
// نفس تعريف totals.profit في App.jsx (الإيراد ناقص تكلفة البضاعة المباعة وخسائر
// الإتلاف والمصاريف) لكن مقصوراً على تاريخ واحد — يُستخدم لرسم اتجاه الربح اليومي
// بدل الإيراد وحده، فالإيراد قد يرتفع بينما الهامش يتآكل بمصاريف أو إتلاف أكبر.
export function profitOnDate(date, { invoices, expenses, waste } = {}) {
  const paidToday = (invoices || []).filter(i => i.date === date && i.status === "مدفوعة");
  const revenue = paidToday.reduce((s, i) => s + i.total, 0);
  const cogs = paidToday.reduce((s, i) => s + (i.cost || 0), 0);
  const expTotal = (expenses || []).filter(e => e.date === date).reduce((s, e) => s + e.amount, 0);
  const wasteCost = (waste || []).filter(w => w.date === date).reduce((s, w) => s + w.cost, 0);
  return revenue - cogs - wasteCost - expTotal;
}

/* ---------- أفضل الأصناف مبيعاً ---------- */
// عناصر بيع منتجات حقيقية (لها pid) ضمن فواتير مدفوعة ليوم واحد، مجمَّعة بالصنف
// ومرتَّبة بالإيراد تنازلياً. تُستثنى العناصر الاصطناعية بلا pid (حجوزات/تأجير/
// أرصدة سابقة) — ليست "أصنافاً" بالمعنى التجاري الذي يقصده هذا الترتيب.
export function topItemsOnDate(date, invoices, limit = 5) {
  const map = {};
  (invoices || []).forEach(inv => {
    if (inv.date !== date || inv.status !== "مدفوعة") return;
    (inv.items || []).forEach(it => {
      if (it.pid == null) return;
      const k = it.pid;
      if (!map[k]) map[k] = { pid: k, name: it.name, qty: 0, revenue: 0 };
      map[k].qty += it.qty || 0;
      map[k].revenue += it.lineTotal || 0;
    });
  });
  return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, limit);
}
