import { useState, useMemo, useRef } from "react";
import { C, fmt } from "../constants/theme.js";
import { TYPE_NAME, TYPE_ICON, ASSET_STATUS } from "../constants/seeds.js";
import { PageTop, Field, Sel, Inp, Btn, Table, Crest } from "../components/ui.jsx";
import { RankBarChart } from "../components/charts.jsx";
import { pctDelta } from "../utils/analytics.js";
import { todayISO, arDate } from "../utils/format.js";
import { parseBookingMinutes } from "../utils/bookings.js";

/* ============================ REPORTS ============================ */
export default function Reports({ ctx }) {
  const { invoices, purchases, expenses, products, totals, assets, waste, cats, rentals, reportPresets, setReportPresets, showToast } = ctx;
  const [type, setType] = useState("sales");
  const [cat, setCat] = useState("");       // فلتر القسم (منتجات / تتبع مبيعات قسم)
  const [source, setSource] = useState(""); // فلتر المصدر لتقرير المبيعات العام
  const [resType, setResType] = useState(""); // فلتر نوع الجهاز/الطاولة لتقرير الحجوزات
  const [selectedPreset, setSelectedPreset] = useState("");
  const [presetName, setPresetName] = useState("");
  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split("T")[0]; });
  const [to, setTo] = useState(todayISO());
  const printRef = useRef(null);
  const rangeless = type === "assets" || type === "products";

  // بنّاء التقرير كدالة نقية على نطاق زمني — تُستدعى مرتين (الفترة الحالية وفترة مقارنة مساوية الطول قبلها مباشرة)
  // لإتاحة مقارنة الفترتين دون تكرار منطق كل تقرير من الأربعة عشر
  const buildReport = (rFrom, rTo) => {
    const cur = ctx.settings?.currency || "د.ل";
    const inRange = (d) => d >= rFrom && d <= rTo;

    if (type === "sales") {
      const rows = invoices.filter(i => inRange(i.date) && (!source || i.source === source));
      const paid = rows.filter(i => i.status === "مدفوعة");
      const rev = paid.reduce((s, i) => s + i.total, 0);
      const avg = paid.length ? Math.round(rev / paid.length) : 0;
      return { title: "تقرير المبيعات", headline: rev, summary: [["إجمالي المبيعات", fmt(rev) + " " + cur], ["عدد الفواتير", rows.length], ["متوسط الفاتورة", fmt(avg) + " " + cur]],
        thead: ["رقم", "الزبون", "المصدر", "التفاصيل", "الدفع", "الإجمالي"], tbody: rows.map(i => ["#" + i.id, i.customer, i.source, i.details, i.paidVia ? `آجل ← ${i.paidVia}` : i.pay, fmt(i.total) + " " + cur]) };
    }

    if (type === "purchases") {
      const rows = purchases.filter(p => inRange(p.date));
      const total = rows.reduce((s, p) => s + p.total, 0);
      return { title: "تقرير المشتريات", headline: total, summary: [["إجمالي المشتريات", fmt(total) + " " + cur], ["عدد الطلبات", rows.length], ["الموردون", ctx.suppliers.length]], thead: ["رقم", "المورد", "المنتجات", "الدفع", "الإجمالي"], tbody: rows.map(p => ["#" + p.id, p.supplier, p.items, p.pay, fmt(p.total) + " " + cur]) };
    }

    if (type === "profit") {
      const paidR = invoices.filter(i => i.status === "مدفوعة" && inRange(i.date));
      const revenue = paidR.reduce((s, i) => s + i.total, 0);
      const cogs = paidR.reduce((s, i) => s + (i.cost || 0), 0);
      const expR = expenses.filter(e => inRange(e.date)).reduce((s, e) => s + e.amount, 0);
      const wasteR = (waste || []).filter(w => inRange(w.date)).reduce((s, w) => s + w.cost, 0);
      const profit = revenue - cogs - wasteR - expR;
      return { title: "تقرير الأرباح والخسائر", headline: profit, summary: [["الإيرادات", fmt(revenue) + " " + cur], ["المصاريف", fmt(expR) + " " + cur], ["صافي الربح", fmt(profit) + " " + cur]],
        thead: ["البند", "القيمة"], tbody: [["إجمالي الإيرادات", fmt(revenue) + " " + cur], ["تكلفة البضاعة المباعة", fmt(cogs) + " " + cur], ["خسائر الإتلاف", fmt(wasteR) + " " + cur], ["إجمالي المصاريف", fmt(expR) + " " + cur], ["صافي الربح", fmt(profit) + " " + cur], ["هامش الربح", (revenue ? (profit / revenue * 100).toFixed(1) : 0) + "%"]],
        chart: revenue > 0 ? { data: [{ label: "الإيرادات", value: revenue }, { label: "التكاليف والمصاريف", value: cogs + wasteR + expR }], color: C.grl } : null };
    }

    if (type === "expenses") {
      const rows = expenses.filter(e => inRange(e.date));
      const byCat = {};
      rows.forEach(e => { byCat[e.cat] = (byCat[e.cat] || 0) + e.amount; });
      const ranked = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
      const top = ranked[0];
      const total = rows.reduce((s, e) => s + e.amount, 0);
      return { title: "تقرير المصاريف", headline: total, summary: [["إجمالي المصاريف", fmt(total) + " " + cur], ["عدد البنود", rows.length], ["أكبر فئة", top ? top[0] : "—"]], thead: ["التاريخ", "الفئة", "الوصف", "المبلغ"], tbody: rows.map(e => [arDate(e.date), e.cat, e.desc, fmt(e.amount) + " " + cur]),
        chart: ranked.length ? { data: ranked.slice(0, 8).map(([label, value]) => ({ label, value })), color: C.red } : null };
    }

    if (type === "assets") {
      const active = assets.filter(a => a.status === "active").length;
      const maint = assets.filter(a => a.status === "maintenance").length;
      const damaged = assets.filter(a => a.status === "damaged").length;
      const lost = assets.filter(a => a.status === "lost").length;
      const val = assets.filter(a => a.status === "active" || a.status === "maintenance").reduce((s, a) => s + (a.cost || 0) * (a.qty || 1), 0);
      const statusChart = [["نشط", active], ["صيانة", maint], ["تالف", damaged], ["مفقود", lost]].filter(([, v]) => v > 0);
      return { title: "تقرير موارد النادي", summary: [["قيمة الموجودات", fmt(val) + " " + cur], ["موجود / صيانة", active + " / " + maint], ["تالف / مفقود", damaged + " / " + lost]],
        thead: ["المورد", "الفئة", "العدد", "تاريخ الإضافة", "التكلفة", "الحالة"],
        tbody: assets.map(a => [a.name, a.cat, a.qty, arDate(a.addedAt), a.cost ? fmt(a.cost) + " " + cur : "—", ASSET_STATUS[a.status].label]),
        chart: statusChart.length ? { data: statusChart.map(([label, value]) => ({ label, value })), color: C.gold } : null };
    }

    if (type === "waste") {
      const rows = (waste || []).filter(w => inRange(w.date));
      const total = rows.reduce((s, w) => s + w.cost, 0);
      const byReason = {};
      rows.forEach(w => { byReason[w.reason] = (byReason[w.reason] || 0) + w.cost; });
      const ranked = Object.entries(byReason).sort((a, b) => b[1] - a[1]);
      const topReason = ranked[0];
      return { title: "تقرير الإتلاف والهالك", headline: total, summary: [["إجمالي الخسائر", fmt(total) + " " + cur], ["عدد الحوادث", rows.length], ["أكثر سبب", topReason ? topReason[0] : "—"]],
        thead: ["التاريخ", "الصنف", "الكمية", "السبب", "الخسارة", "بواسطة"], tbody: rows.map(w => [arDate(w.date), w.name, w.qty, w.reason, fmt(w.cost) + " " + cur, w.by]),
        chart: ranked.length ? { data: ranked.slice(0, 8).map(([label, value]) => ({ label, value })), color: C.red } : null };
    }

    if (type === "leaderboard") {
      // تصنيف الموظفين حسب إيراد المبيعات والحجوزات المسجَّلة باسمهم ضمن الفترة
      const byEmp = {};
      invoices.filter(i => i.status === "مدفوعة" && i.by && inRange(i.date)).forEach(i => {
        if (!byEmp[i.by]) byEmp[i.by] = { count: 0, total: 0 };
        byEmp[i.by].count++; byEmp[i.by].total += i.total;
      });
      const ranked = Object.entries(byEmp).sort((a, b) => b[1].total - a[1].total);
      const grand = ranked.reduce((s, [, v]) => s + v.total, 0);
      const top = ranked[0];
      return { title: "تصنيف الموظفين حسب المبيعات", headline: grand, summary: [["إجمالي المبيعات المسجَّلة", fmt(grand) + " " + cur], ["عدد الموظفين النشطين", ranked.length], ["المتصدّر", top ? top[0] : "—"]],
        thead: ["الترتيب", "الموظف", "عدد الفواتير", "إجمالي المبيعات", "متوسط الفاتورة"],
        tbody: ranked.length ? ranked.map(([name, v], i) => [i === 0 ? "🥇 1" : i === 1 ? "🥈 2" : i === 2 ? "🥉 3" : i + 1, name, v.count, fmt(v.total) + " " + cur, fmt(Math.round(v.total / v.count)) + " " + cur]) : [["لا بيانات مبيعات مرتبطة بموظفين ضمن الفترة", "", "", "", ""]],
        chart: ranked.length ? { data: ranked.slice(0, 8).map(([label, v]) => ({ label, value: v.total })), color: C.grl } : null };
    }

    if (type === "utilization") {
      // معدل إشغال الطاولات/الأجهزة: الساعات والإيراد لكل مورد ضمن الفترة
      const rows = invoices.filter(i => i.status === "مدفوعة" && i.source === "حجز" && inRange(i.date));
      const byRes = {};
      rows.forEach(i => {
        const key = i.resName || (i.details ? i.details.split(" — ")[1] : "—");
        const mins = parseBookingMinutes(i.details);
        if (!byRes[key]) byRes[key] = { count: 0, minutes: 0, revenue: 0, type: i.resType };
        byRes[key].count++; byRes[key].minutes += mins; byRes[key].revenue += i.total;
      });
      const ranked = Object.entries(byRes).sort((a, b) => b[1].revenue - a[1].revenue);
      const totalHours = ranked.reduce((s, [, v]) => s + v.minutes, 0) / 60;
      const totalRev = ranked.reduce((s, [, v]) => s + v.revenue, 0);
      const top = ranked[0];
      return { title: "معدل إشغال الموارد", headline: totalRev, summary: [["إجمالي ساعات الاستخدام", (Math.round(totalHours * 10) / 10) + " ساعة"], ["إجمالي الإيراد", fmt(totalRev) + " " + cur], ["الأكثر استخداماً", top ? top[0] : "—"]],
        thead: ["المورد", "النوع", "عدد الحجوزات", "إجمالي الساعات", "الإيراد", "متوسط الإيراد/ساعة"],
        tbody: ranked.length ? ranked.map(([name, v]) => [name, TYPE_NAME[v.type] || v.type || "—", v.count, (Math.round(v.minutes / 6) / 10) + " س", fmt(v.revenue) + " " + cur, v.minutes > 0 ? fmt(Math.round(v.revenue / (v.minutes / 60))) + " " + cur : "—"]) : [["لا حجوزات مسجَّلة ضمن الفترة المختارة", "", "", "", "", ""]],
        chart: ranked.length ? { data: ranked.slice(0, 8).map(([label, v]) => ({ label, value: v.revenue })), color: "#2a78d6" } : null };
    }

    if (type === "peakHours") {
      // ساعات الذروة: توزيع الفواتير على ساعات اليوم (يعتمد على وقت الفاتورة — الفواتير القديمة قبل هذا التحديث لا تحمل وقتاً وتُستثنى)
      const rows = invoices.filter(i => i.status === "مدفوعة" && i.time && inRange(i.date));
      const byHour = Array.from({ length: 24 }, () => ({ count: 0, revenue: 0 }));
      rows.forEach(i => { const h = parseInt(i.time.split(":")[0]); if (!isNaN(h)) { byHour[h].count++; byHour[h].revenue += i.total; } });
      const withData = byHour.map((v, h) => ({ h, ...v })).filter(x => x.count > 0);
      const top = [...withData].sort((a, b) => b.count - a.count)[0];
      const fmtHour = (h) => `${String(h).padStart(2, "0")}:00 - ${String((h + 1) % 24).padStart(2, "0")}:00`;
      const totalRev = withData.reduce((s, x) => s + x.revenue, 0);
      return { title: "ساعات الذروة", headline: totalRev, summary: [["إجمالي الفواتير المؤرَّخة بالوقت", rows.length], ["ساعة الذروة", top ? fmtHour(top.h) : "—"], ["فواتير ساعة الذروة", top ? top.count : 0]],
        thead: ["الساعة", "عدد الفواتير", "الإيراد"], tbody: withData.length ? withData.sort((a, b) => b.count - a.count).map(x => [fmtHour(x.h), x.count, fmt(x.revenue) + " " + cur]) : [["لا فواتير تحمل بيانات وقت ضمن الفترة (تنطبق فقط على العمليات بعد تفعيل هذه الميزة)", "", ""]],
        chart: withData.length ? { data: [...withData].sort((a, b) => b.revenue - a.revenue).slice(0, 8).map(x => ({ label: fmtHour(x.h), value: x.revenue })), color: C.gold } : null };
    }

    if (type === "rentals") {
      // تقرير تأجير الأجهزة: حسب تاريخ الاستلام ضمن الفترة المختارة
      const rows = (rentals || []).filter(r => inRange(r.startAt.slice(0, 10)));
      const byDevice = {};
      rows.forEach(r => {
        if (!byDevice[r.deviceName]) byDevice[r.deviceName] = { count: 0, days: 0, revenue: 0 };
        byDevice[r.deviceName].count++; byDevice[r.deviceName].days += r.days; byDevice[r.deviceName].revenue += r.total;
      });
      const ranked = Object.entries(byDevice).sort((a, b) => b[1].revenue - a[1].revenue);
      const totalRevenue = rows.reduce((s, r) => s + r.total, 0);
      const totalDays = rows.reduce((s, r) => s + r.days, 0);
      const topDevice = ranked[0];
      return { title: "تقرير تأجير الأجهزة", headline: totalRevenue, summary: [["إجمالي الإيراد", fmt(totalRevenue) + " " + cur], ["عدد عمليات التأجير", rows.length], ["إجمالي أيام التأجير", totalDays], ["الأكثر تأجيراً", topDevice ? topDevice[0] : "—"]],
        thead: ["الجهاز", "الزبون", "الأيام", "تاريخ الاستلام", "تاريخ الانتهاء", "الإجمالي", "الحالة"],
        tbody: rows.length ? rows.map(r => [r.deviceName, r.customer, r.days, arDate(r.startAt.slice(0, 10)), arDate(r.endAt.slice(0, 10)), fmt(r.total) + " " + cur, r.status]) : [["لا عمليات تأجير ضمن الفترة المختارة", "", "", "", "", "", ""]],
        thead2: ["الجهاز", "عدد مرات التأجير", "إجمالي الأيام", "الإيراد"], tbody2: ranked.map(([name, v]) => [name, v.count, v.days, fmt(v.revenue) + " " + cur]), title2: "الإجمالي حسب كل جهاز",
        chart: ranked.length ? { data: ranked.slice(0, 8).map(([label, v]) => ({ label, value: v.revenue })), color: C.purp } : null };
    }

    if (type === "deptProfit") {
      // صافي ربح كل قسم = مبيعات القسم − تكلفة البضاعة المباعة (COGS) − مصاريف التشغيل المرتبطة مباشرة بالقسم
      const catKeys = Object.keys(cats);
      const stats = {};
      catKeys.forEach(k => { stats[k] = { revenue: 0, cogs: 0, expenses: 0 }; });
      let legacyRev = 0; // فواتير قديمة بلا items[] تفصيلية — لا يمكن ربطها بدقة بقسم فتُستثنى من الحساب وتُذكر للشفافية
      invoices.filter(i => i.status === "مدفوعة" && inRange(i.date)).forEach(i => {
        if (i.items && i.items.length) {
          i.items.forEach(it => {
            if (!stats[it.cat]) return;
            stats[it.cat].revenue += it.lineTotal;
            const prod = products.find(p => p.id === it.pid);
            if (prod) stats[it.cat].cogs += (prod.buy || 0) * it.qty;
          });
        } else if (i.source === "منتج") legacyRev += i.total;
      });
      let unlinkedExp = 0;
      expenses.filter(e => inRange(e.date)).forEach(e => {
        if (e.dept && stats[e.dept]) stats[e.dept].expenses += e.amount;
        else unlinkedExp += e.amount;
      });
      const rows = catKeys.map(k => {
        const s = stats[k];
        return { key: k, label: cats[k], ...s, net: s.revenue - s.cogs - s.expenses };
      }).filter(r => r.revenue > 0 || r.expenses > 0);
      const totalNet = rows.reduce((s, r) => s + r.net, 0);
      const sorted = [...rows].sort((a, b) => b.net - a.net);
      const best = sorted[0];
      return { title: "صافي ربح الأقسام", headline: totalNet, summary: [["إجمالي صافي ربح الأقسام", fmt(totalNet) + " " + cur], ["الأكثر ربحية", best ? best.label : "—"], ["مصاريف عامة غير مرتبطة بقسم", fmt(unlinkedExp) + " " + cur]],
        thead: ["القسم", "المبيعات", "تكلفة البضاعة", "مصاريف تشغيل مباشرة", "صافي الربح"],
        tbody: rows.length ? sorted.map(r => [r.label, fmt(r.revenue) + " " + cur, fmt(r.cogs) + " " + cur, fmt(r.expenses) + " " + cur, fmt(r.net) + " " + cur]) : [["لا بيانات كافية ضمن الفترة المختارة — تأكد من ربط تفاصيل الفواتير بالأقسام", "", "", "", ""]],
        note: legacyRev > 0 ? `تنبيه: ${fmt(legacyRev)} ${cur} من فواتير قديمة (قبل تفعيل تفاصيل الأصناف) لم يمكن ربطها بدقة بقسم مُعيّن، فاستُثنيت من هذا التقرير للحفاظ على دقته.` : undefined,
        chart: rows.length ? { data: sorted.slice(0, 8).map(r => ({ label: r.label, value: r.net })), color: C.grl } : null };
    }

    if (type === "catSales") {
      const catKey = cat || Object.keys(cats)[0] || "";
      const catLabel = cats[catKey] || catKey;
      const dayMap = {}; const prodRev = {}; let totalRev = 0;
      invoices.filter(i => i.status === "مدفوعة" && inRange(i.date)).forEach(i => {
        let lineRev = 0;
        if (i.items) {
          i.items.filter(it => it.cat === catKey).forEach(it => { lineRev += it.lineTotal; prodRev[it.name] = (prodRev[it.name] || 0) + it.lineTotal; });
        } else if (i.source !== "حجز") {
          // فواتير أقدم بلا بيانات مفصّلة — أفضل تخمين بمطابقة اسم المنتج ضمن نص الفاتورة
          const names = products.filter(p => p.cat === catKey).map(p => p.name);
          if (names.some(n => i.details && i.details.includes(n))) lineRev = i.total;
        }
        if (lineRev > 0) { dayMap[i.date] = (dayMap[i.date] || 0) + lineRev; totalRev += lineRev; }
      });
      const days = Object.keys(dayMap).sort();
      const avgDaily = days.length ? totalRev / days.length : 0;
      const topProducts = Object.entries(prodRev).sort((a, b) => b[1] - a[1]).slice(0, 6);
      return { title: `تتبع مبيعات قسم — ${catLabel}`, headline: totalRev,
        summary: [["إجمالي مبيعات القسم", fmt(totalRev) + " " + cur], ["أيام نشطة", days.length], ["متوسط يومي", fmt(Math.round(avgDaily)) + " " + cur], ["الأكثر مبيعاً", topProducts.length ? topProducts[0][0] : "—"]],
        thead: ["التاريخ", "إيراد القسم"], tbody: days.length ? days.map(d => [arDate(d), fmt(dayMap[d]) + " " + cur]) : [["لا حركة مبيعات لهذا القسم ضمن الفترة المختارة", ""]],
        thead2: ["المنتج", "الإيراد"], tbody2: topProducts.map(([n, v]) => [n, fmt(v) + " " + cur]), title2: "الأكثر مبيعاً بالقسم",
        chart: topProducts.length ? { data: topProducts.map(([label, value]) => ({ label, value })), color: C.grl } : null };
    }

    if (type === "bookingRev") {
      const dayMap = {}; const tableMap = {}; let totalRev = 0, cnt = 0;
      invoices.filter(i => i.status === "مدفوعة" && i.source === "حجز" && inRange(i.date)).forEach(i => {
        const t = i.resType || Object.keys(TYPE_NAME).find(k => i.details && i.details.includes(TYPE_NAME[k]));
        if (resType && t !== resType) return;
        const tName = i.resName || (i.details ? i.details.split(" — ")[1] : "—");
        dayMap[i.date] = (dayMap[i.date] || 0) + i.total;
        tableMap[tName] = (tableMap[tName] || 0) + i.total;
        totalRev += i.total; cnt++;
      });
      const days = Object.keys(dayMap).sort();
      const tables = Object.entries(tableMap).sort((a, b) => b[1] - a[1]);
      return { title: `تتبع إيراد الحجوزات${resType ? " — " + TYPE_NAME[resType] : ""}`, headline: totalRev,
        summary: [["إجمالي الإيراد", fmt(totalRev) + " " + cur], ["عدد الحجوزات", cnt], ["متوسط الحجز", cnt ? fmt(Math.round(totalRev / cnt)) + " " + cur : "—"], ["الأكثر نشاطاً", tables.length ? tables[0][0] : "—"]],
        thead: ["التاريخ", "الإيراد"], tbody: days.length ? days.map(d => [arDate(d), fmt(dayMap[d]) + " " + cur]) : [["لا حجوزات ضمن الفترة المختارة", ""]],
        thead2: ["الطاولة / الجهاز", "الإيراد"], tbody2: tables.map(([n, v]) => [n, fmt(v) + " " + cur]), title2: "الإيراد حسب الطاولة/الجهاز",
        chart: tables.length ? { data: tables.slice(0, 8).map(([label, value]) => ({ label, value })), color: "#2a78d6" } : null };
    }

    // products — قائمة المنتجات مع لمحة عن إيراد الأقسام (حالة حالية، بلا فلترة تاريخ)
    const rows = products.filter(p => !cat || p.cat === cat);
    const catRevenue = {};
    invoices.filter(i => i.status === "مدفوعة" && i.items).forEach(i => { i.items.forEach(it => { catRevenue[it.cat] = (catRevenue[it.cat] || 0) + it.lineTotal; }); });
    const topCat = Object.entries(catRevenue).sort((a, b) => b[1] - a[1])[0];
    const countByCat = {};
    rows.forEach(p => { countByCat[p.cat] = (countByCat[p.cat] || 0) + 1; });
    return { title: "تقرير مبيعات المنتجات", summary: [["عدد المنتجات", rows.length], ["الأكثر إيراداً", topCat ? (cats[topCat[0]] || topCat[0]) : "—"], ["إيراده", topCat ? fmt(topCat[1]) + " " + cur : "—"]],
      thead: ["المنتج", "القسم", "الباركود", "سعر البيع", "المخزون"], tbody: rows.map(p => [p.name, cats[p.cat] || p.cat, p.bc, fmt(p.sell) + " " + cur, p.stock !== null ? p.stock : "خدمة"]),
      chart: Object.keys(countByCat).length > 1 ? { data: Object.entries(countByCat).map(([k, value]) => ({ label: cats[k] || k, value })), color: C.gold } : null };
  };

  const depsBase = [type, cat, source, resType, invoices, purchases, expenses, products, totals, assets, waste, cats, rentals, ctx.suppliers.length];
  // buildReport is a fresh closure every render by design (it captures the deps above directly) —
  // listing it here would defeat the memoization it exists for, so its own identity is intentionally excluded.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const cfg = useMemo(() => buildReport(from, to), [...depsBase, from, to]);

  // فترة مقارنة بنفس عدد الأيام مباشرة قبل الفترة الحالية — لعرض دلتا الفترة السابقة بجانب رقم التقرير الرئيسي
  const { prevFrom, prevTo } = useMemo(() => {
    const fromD = new Date(from + "T00:00:00Z");
    const prevToD = new Date(fromD.getTime() - 86400000);
    const days = Math.round((new Date(to + "T00:00:00Z") - fromD) / 86400000) + 1;
    const prevFromD = new Date(prevToD.getTime() - (days - 1) * 86400000);
    const iso = (d) => d.toISOString().slice(0, 10);
    return { prevFrom: iso(prevFromD), prevTo: iso(prevToD) };
  }, [from, to]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const prevCfg = useMemo(() => (rangeless ? null : buildReport(prevFrom, prevTo)), [...depsBase, prevFrom, prevTo, rangeless]);
  const headlineDelta = (!rangeless && cfg.headline != null && prevCfg?.headline != null) ? pctDelta(cfg.headline, prevCfg.headline) : null;

  // تصدير التقرير الحالي كملف Excel (xlsx) منسّق — عناوين غامقة، اتجاه RTL، عرض أعمدة تلقائي
  const downloadExcel = async () => {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const addSheet = (name, thead, tbody) => {
      const ws = wb.addWorksheet(name, { views: [{ rightToLeft: true }] });
      ws.addRow(thead);
      ws.getRow(1).font = { bold: true, color: { argb: "FFF0D080" } };
      ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1A5C2E" } };
      tbody.forEach(r => ws.addRow(r));
      ws.columns.forEach((col, i) => {
        const maxLen = Math.max(thead[i]?.length || 10, ...tbody.map(r => String(r[i] ?? "").length));
        col.width = Math.min(40, Math.max(10, maxLen + 2));
      });
    };
    addSheet(cfg.title.slice(0, 31), cfg.thead, cfg.tbody);
    if (cfg.tbody2 && cfg.tbody2.length) addSheet((cfg.title2 || "تفصيل إضافي").slice(0, 31), cfg.thead2, cfg.tbody2);
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${cfg.title.replace(/\s+/g, "-")}-${todayISO()}.xlsx`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // تصدير التقرير الحالي كملف CSV (يفتح مباشرة في Excel)
  const downloadCSV = () => {
    const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
    let csv = cfg.thead.map(esc).join(",") + "\n";
    cfg.tbody.forEach(r => { csv += r.map(esc).join(",") + "\n"; });
    if (cfg.tbody2 && cfg.tbody2.length) {
      csv += "\n" + esc(cfg.title2 || "") + "\n";
      csv += cfg.thead2.map(esc).join(",") + "\n";
      cfg.tbody2.forEach(r => { csv += r.map(esc).join(",") + "\n"; });
    }
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${cfg.title.replace(/\s+/g, "-")}-${todayISO()}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // إعدادات تقارير محفوظة — تلتقط نوع التقرير وفلاتره ونطاقه الزمني تحت اسم يختاره المستخدم لاستدعائها لاحقاً بضغطة واحدة
  const savePreset = () => {
    const name = presetName.trim();
    if (!name) { showToast("اكتب اسماً للإعداد أولاً"); return; }
    const id = Date.now();
    setReportPresets(prev => [...prev, { id, name, type, cat, source, resType, from, to }]);
    setPresetName("");
    setSelectedPreset(String(id));
    showToast(`تم حفظ الإعداد «${name}»`);
  };

  const loadPreset = (id) => {
    setSelectedPreset(id);
    const p = reportPresets.find(p => String(p.id) === String(id));
    if (!p) return;
    setType(p.type); setCat(p.cat || ""); setSource(p.source || ""); setResType(p.resType || "");
    if (p.from) setFrom(p.from);
    if (p.to) setTo(p.to);
  };

  const deletePreset = () => {
    if (!selectedPreset) return;
    setReportPresets(prev => prev.filter(p => String(p.id) !== String(selectedPreset)));
    setSelectedPreset("");
  };

  const doPrint = () => {
    const w = window.open("", "_blank", "width=900,height=650");
    w.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>تقرير نادي النخيل</title>
    <style>*{box-sizing:border-box;margin:0;padding:0;font-family:'Tajawal',sans-serif}body{padding:2cm;direction:rtl;font-size:13px;color:#1a1a18}
    .hd{display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #c9a84c;padding-bottom:.75rem;margin-bottom:1rem}.nm{font-size:15px;font-weight:700;color:#1a5c2e}.sub{font-size:10px;color:#7a7870}.info{text-align:left;font-size:10px;color:#7a7870}
    h3{font-size:15px;font-weight:700;color:#1a5c2e;text-align:center}h4{font-size:13px;font-weight:700;color:#1a5c2e;margin:1.2rem 0 .4rem}p.range{text-align:center;font-size:11px;color:#7a7870;margin:2px 0 1rem}
    .sum{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-bottom:1rem}.sc{background:#f5f2ea;border-radius:7px;padding:.6rem;text-align:center}.sv{font-size:16px;font-weight:700;color:#1a5c2e}.sl{font-size:10px;color:#7a7870;margin-top:2px}
    table{width:100%;border-collapse:collapse;margin-top:.5rem}th{background:#1a5c2e;color:#f0d080;padding:.45rem .6rem;text-align:right;font-size:11px}td{padding:.45rem .6rem;border-bottom:0.5px solid #e8e4d8;font-size:12px}tr:nth-child(even) td{background:#faf8f2}
    .ft{text-align:center;font-size:10px;color:#7a7870;margin-top:1.5rem;padding-top:.75rem;border-top:0.5px solid #c9a84c}</style></head><body>
    <div class="hd"><div><div class="nm">🌴 نادي النخيل</div><div class="sub">النادي الرياضي الترفيهي</div></div><div class="info">مصراتة، ليبيا<br>تاريخ الطباعة: ${new Date().toLocaleDateString("ar-LY")}</div></div>
    <h3>${cfg.title}${cat && (type === "products") ? " — قسم " + (cats[cat] || cat) : ""}</h3>${rangeless ? "" : `<p class="range">الفترة: ${arDate(from)} — ${arDate(to)}</p>`}
    <div class="sum">${cfg.summary.map(s => `<div class="sc"><div class="sv">${s[1]}</div><div class="sl">${s[0]}</div></div>`).join("")}</div>
    ${cfg.note ? `<p style="background:#FFF7EB;border:0.5px dashed #c9a84c;border-radius:8px;padding:8px 12px;font-size:11px;color:#8a6a20;margin:10px 0">📌 ${cfg.note}</p>` : ""}
    <table><thead><tr>${cfg.thead.map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>${cfg.tbody.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>
    ${cfg.tbody2 ? `<h4>${cfg.title2 || ""}</h4><table><thead><tr>${cfg.thead2.map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>${cfg.tbody2.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>` : ""}
    <div class="ft">نادي النخيل — ${cfg.title} — جميع الأرقام بالدينار الليبي</div>
    <script>window.onload=function(){window.print();}</script></body></html>`);
    w.document.close();
  };

  return (
    <>
      <PageTop title="التقارير والإحصاء" />
      <div style={{ background: C.cd, border: `0.5px solid ${C.bc}`, borderRadius: 12, padding: ".9rem 1rem", marginBottom: "1rem", display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap" }}>
        <Field label="نوع التقرير">
          <Sel value={type} onChange={e => setType(e.target.value)} style={{ minWidth: 175 }}>
            <option value="sales">تقرير المبيعات</option>
            <option value="catSales">تتبع مبيعات قسم</option>
            <option value="bookingRev">تتبع إيراد الحجوزات</option>
            <option value="purchases">تقرير المشتريات</option>
            <option value="profit">الأرباح والخسائر</option>
            <option value="products">مبيعات المنتجات</option>
            <option value="expenses">تقرير المصاريف</option>
            <option value="waste">الإتلاف والهالك</option>
            <option value="leaderboard">تصنيف الموظفين</option>
            <option value="utilization">معدل إشغال الموارد</option>
            <option value="peakHours">ساعات الذروة</option>
            <option value="rentals">تأجير الأجهزة</option>
            <option value="deptProfit">صافي ربح الأقسام</option>
            <option value="assets">موارد النادي</option>
          </Sel>
        </Field>
        {type === "sales" && <Field label="المصدر"><Sel value={source} onChange={e => setSource(e.target.value)} style={{ minWidth: 130 }}><option value="">كل المصادر</option><option value="منتج">مبيعات منتجات</option><option value="حجز">حجوزات</option><option value="تأجير">تأجير أجهزة</option><option value="رصيد سابق">أرصدة سابقة</option></Sel></Field>}
        {(type === "products" || type === "catSales") && <Field label="القسم"><Sel value={cat} onChange={e => setCat(e.target.value)} style={{ minWidth: 140 }}>{type === "products" && <option value="">كل الأقسام</option>}{Object.entries(cats).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Sel></Field>}
        {type === "bookingRev" && <Field label="النوع"><Sel value={resType} onChange={e => setResType(e.target.value)} style={{ minWidth: 140 }}><option value="">كل الأنواع</option>{Object.entries(TYPE_NAME).map(([k, l]) => <option key={k} value={k}>{TYPE_ICON[k]} {l}</option>)}</Sel></Field>}
        {!rangeless && <>
          <Field label="من تاريخ"><Inp type="date" value={from} onChange={e => setFrom(e.target.value)} /></Field>
          <Field label="إلى تاريخ"><Inp type="date" value={to} onChange={e => setTo(e.target.value)} /></Field>
        </>}
        <Btn onClick={downloadCSV} style={{ marginBottom: ".75rem" }}>⬇ تصدير CSV</Btn>
        <Btn onClick={downloadExcel} style={{ marginBottom: ".75rem" }}>📊 تصدير Excel</Btn>
        <Btn gold onClick={doPrint} style={{ marginBottom: ".75rem" }}>🖨 طباعة PDF</Btn>
      </div>
      <div style={{ background: C.cd, border: `0.5px solid ${C.bc}`, borderRadius: 12, padding: ".7rem 1rem", marginBottom: "1rem", display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap" }}>
        <Field label="⭐ إعداد محفوظ">
          <Sel value={selectedPreset} onChange={e => loadPreset(e.target.value)} style={{ minWidth: 170 }}>
            <option value="">— اختر إعداداً —</option>
            {reportPresets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Sel>
        </Field>
        {selectedPreset && <Btn onClick={deletePreset} style={{ marginBottom: ".75rem" }}>🗑 حذف الإعداد</Btn>}
        <Field label="حفظ الفلاتر الحالية باسم"><Inp value={presetName} onChange={e => setPresetName(e.target.value)} placeholder="مثال: مبيعات الكافيه الشهرية" style={{ minWidth: 200 }} /></Field>
        <Btn gold onClick={savePreset} style={{ marginBottom: ".75rem" }}>💾 حفظ كإعداد جديد</Btn>
      </div>
      <div ref={printRef} style={{ background: C.cd, border: `0.5px solid ${C.bc}`, borderRadius: 12, padding: "1.1rem 1.2rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem", paddingBottom: ".75rem", borderBottom: `1px solid ${C.bc}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Crest size={32} /><div><div style={{ fontSize: 14, fontWeight: 700, color: C.grn2 }}>نادي النخيل</div><div style={{ fontSize: 10, color: C.mt }}>النادي الرياضي الترفيهي</div></div></div>
          <div style={{ textAlign: "left", fontSize: 11, color: C.mt }}>مصراتة، ليبيا<br />{new Date().toLocaleDateString("ar-LY")}</div>
        </div>
        <div style={{ textAlign: "center", marginBottom: "1rem" }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: C.grn2 }}>{cfg.title}{cat && type === "products" ? " — قسم " + (cats[cat] || cat) : ""}</h3>
          {!rangeless && <p style={{ fontSize: 11, color: C.mt, marginTop: 2 }}>الفترة: {arDate(from)} — {arDate(to)}{headlineDelta != null && (
            <span style={{ marginRight: 8, fontWeight: 700, color: headlineDelta >= 0 ? "#1a8c3e" : C.red }}>{headlineDelta >= 0 ? "▲" : "▼"} {Math.abs(headlineDelta)}% عن فترة مقارنة مساوية الطول ({arDate(prevFrom)} — {arDate(prevTo)})</span>
          )}</p>}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10, marginBottom: "1rem" }}>
          {cfg.summary.map((s, i) => <div key={i} style={{ background: C.crm, borderRadius: 8, padding: ".65rem", textAlign: "center" }}><div style={{ fontSize: 16, fontWeight: 700, color: C.grn2 }}>{s[1]}</div><div style={{ fontSize: 10, color: C.mt, marginTop: 2 }}>{s[0]}</div></div>)}
        </div>
        {cfg.note && <div style={{ background: "#FFF7EB", border: `0.5px dashed ${C.gold}`, borderRadius: 9, padding: "8px 12px", fontSize: 11, color: "#8a6a20", marginBottom: 12 }}>📌 {cfg.note}</div>}
        {cfg.chart && cfg.chart.data.length > 0 && (
          <div style={{ background: C.crm, borderRadius: 10, padding: "1rem 1.1rem", marginBottom: "1.1rem" }}>
            <RankBarChart data={cfg.chart.data} color={cfg.chart.color} cur={ctx.settings?.currency || "د.ل"} />
          </div>
        )}
        <Table cols={cfg.thead.map(h => ({ h, w: (100 / cfg.thead.length) + "%" }))} rows={cfg.tbody} />
        {cfg.tbody2 && cfg.tbody2.length > 0 && (
          <>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.grn2, margin: "1.2rem 0 .5rem" }}>{cfg.title2}</div>
            <Table cols={cfg.thead2.map(h => ({ h, w: (100 / cfg.thead2.length) + "%" }))} rows={cfg.tbody2} />
          </>
        )}
        <div style={{ marginTop: ".85rem", paddingTop: ".6rem", borderTop: `0.5px solid ${C.bc}`, fontSize: 10.5, color: C.mt, textAlign: "center" }}>نادي النخيل — تقرير آلي — جميع الأرقام بالدينار الليبي</div>
      </div>
    </>
  );
}
