import { useMemo } from "react";
import { C, fmt } from "../constants/theme.js";
import { TYPE_NAME } from "../constants/seeds.js";
import { PageTop, Badge, KCard, Card, CardHead } from "../components/ui.jsx";
import { TrendChart, RankBarChart, CompareBarChart } from "../components/charts.jsx";

/* ============================ INSIGHTS (لوحة الرؤى والتحليلات البيانية) ============================ */
export default function Insights({ ctx }) {
  const { invoices, expenses, cats, products, employees, rentals } = ctx;
  const cur = ctx.settings?.currency || "د.ل";

  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  const curStart = new Date(y, m, 1);
  const prevStart = new Date(y, m - 1, 1);
  const daysElapsed = now.getDate();
  const daysInPrevMonth = new Date(y, m, 0).getDate();
  const daysInCurMonth = new Date(y, m + 1, 0).getDate();
  const iso = (d) => d.toISOString().slice(0, 10);
  const dateOf = (base, day) => iso(new Date(base.getFullYear(), base.getMonth(), day));

  const paid = useMemo(() => invoices.filter(i => i.status === "مدفوعة"), [invoices]);

  // إيراد يوم بعينه من شهر بعينه
  const revOnDay = (base, day) => paid.filter(i => i.date === dateOf(base, day)).reduce((s, i) => s + i.total, 0);

  // ------- 1) مقارنة KPI: نفس عدد الأيام من كل شهر (مقارنة عادلة) -------
  const sumRange = (base, fromDay, toDay) => {
    let rev = 0, count = 0, cost = 0;
    for (let d = fromDay; d <= toDay; d++) {
      const dISO = dateOf(base, d);
      paid.filter(i => i.date === dISO).forEach(i => { rev += i.total; count++; cost += i.cost || 0; });
    }
    return { rev, count, cost };
  };
  const curPeriod = sumRange(curStart, 1, daysElapsed);
  const prevPeriod = sumRange(prevStart, 1, Math.min(daysElapsed, daysInPrevMonth));
  const expInRange = (base, fromDay, toDay) => expenses.filter(e => e.date >= dateOf(base, fromDay) && e.date <= dateOf(base, toDay)).reduce((s, e) => s + e.amount, 0);
  const curExp = expInRange(curStart, 1, daysElapsed);
  const prevExp = expInRange(prevStart, 1, Math.min(daysElapsed, daysInPrevMonth));
  const curProfit = curPeriod.rev - curPeriod.cost - curExp;
  const prevProfit = prevPeriod.rev - prevPeriod.cost - prevExp;
  const pctDelta = (a, b) => b === 0 ? (a > 0 ? 100 : 0) : Math.round(((a - b) / b) * 100);
  // نسبة التغيّر مضلِّلة رياضياً عند تقاطع الصفر أو القيم السالبة (كصافي الربح) — نعرض فرقاً بالعملة عندها بدل نسبة مربكة
  const deltaLabel = (a, b, suffix = "") => {
    if (a >= 0 && b >= 0) return `${pctDelta(a, b)}%${suffix}`;
    const diff = Math.round(a - b);
    return `${diff >= 0 ? "+" : ""}${fmt(diff)} ${cur}${suffix}`;
  };

  // ------- 2) الرؤية المستقبلية: توقّع نهاية الشهر بمعدل الأداء الحالي -------
  const dailyAvg = daysElapsed ? curPeriod.rev / daysElapsed : 0;
  const projectedMonthTotal = Math.round(dailyAvg * daysInCurMonth);
  const prevMonthFullTotal = paid.filter(i => i.date >= iso(prevStart) && i.date < iso(curStart)).reduce((s, i) => s + i.total, 0);
  const projDelta = pctDelta(projectedMonthTotal, prevMonthFullTotal);

  // ------- 3) المبيعات حسب الأقسام: الشهر الحالي مقابل الماضي (نفس عدد الأيام) -------
  const catRevInRange = (base, fromDay, toDay) => {
    const map = {};
    for (let d = fromDay; d <= toDay; d++) {
      const dISO = dateOf(base, d);
      paid.filter(i => i.date === dISO).forEach(i => {
        if (i.items) i.items.forEach(it => { map[it.cat] = (map[it.cat] || 0) + it.lineTotal; });
      });
    }
    return map;
  };
  const curCat = catRevInRange(curStart, 1, daysElapsed);
  const prevCat = catRevInRange(prevStart, 1, Math.min(daysElapsed, daysInPrevMonth));
  const catKeys = Object.keys(cats);
  const catData = catKeys.map(k => ({ label: cats[k], a: curCat[k] || 0, b: prevCat[k] || 0 })).filter(d => d.a + d.b > 0);

  // ------- 4) اتجاه الإيراد اليومي: الشهر الحالي مقابل الماضي (كامل) -------
  const curSeries = Array.from({ length: daysInCurMonth }, (_, i) => i < daysElapsed ? revOnDay(curStart, i + 1) : null);
  const prevSeries = Array.from({ length: daysInPrevMonth }, (_, i) => revOnDay(prevStart, i + 1));

  // ------- 5) إيراد الحجوزات حسب المورد -------
  const resRevInRange = (base, fromDay, toDay) => {
    const map = {};
    for (let d = fromDay; d <= toDay; d++) {
      const dISO = dateOf(base, d);
      paid.filter(i => i.date === dISO && i.source === "حجز").forEach(i => {
        const t = i.resType || Object.keys(TYPE_NAME).find(k => i.details && i.details.includes(TYPE_NAME[k]));
        if (t) map[t] = (map[t] || 0) + i.total;
      });
    }
    return map;
  };
  const curRes = resRevInRange(curStart, 1, daysElapsed);
  const prevRes = resRevInRange(prevStart, 1, Math.min(daysElapsed, daysInPrevMonth));
  const resData = Object.keys(TYPE_NAME).map(k => ({ label: TYPE_NAME[k], a: curRes[k] || 0, b: prevRes[k] || 0 })).filter(d => d.a + d.b > 0);

  // ------- 6) أفضل 5 موظفين هذا الشهر -------
  const empRev = {};
  paid.filter(i => i.date >= iso(curStart) && i.by).forEach(i => { empRev[i.by] = (empRev[i.by] || 0) + i.total; });
  const topEmployees = Object.entries(empRev).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([label, value]) => ({ label, value }));

  const hasCatData = catData.length > 0, hasResData = resData.length > 0, hasEmpData = topEmployees.length > 0;

  return (
    <>
      <PageTop title="📈 الرؤى والتحليلات البيانية" action={<Badge tone="gold">حتى يوم {daysElapsed} من {daysInCurMonth}</Badge>} />

      {/* KPI: الشهر الحالي مقابل نفس الفترة من الشهر الماضي */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 11, marginBottom: "1.1rem" }}>
        <KCard label="الإيراد (حتى الآن)" value={fmt(curPeriod.rev)} sub={cur} bar="#1a8c3e" delta={{ up: curPeriod.rev >= prevPeriod.rev, text: `${pctDelta(curPeriod.rev, prevPeriod.rev)}% عن نفس فترة الشهر الماضي` }} />
        <KCard label="عدد الفواتير" value={curPeriod.count} bar="#2a78d6" delta={{ up: curPeriod.count >= prevPeriod.count, text: `${pctDelta(curPeriod.count, prevPeriod.count)}%` }} />
        <KCard label="متوسط الفاتورة" value={fmt(curPeriod.count ? Math.round(curPeriod.rev / curPeriod.count) : 0)} sub={cur} bar={C.gold} />
        <KCard label="صافي الربح التقديري" value={fmt(curProfit)} sub={cur} bar={C.purp} delta={{ up: curProfit >= prevProfit, text: deltaLabel(curProfit, prevProfit) + " عن نفس الفترة الماضية" }} />
      </div>

      {/* الرؤية المستقبلية — العنصر المميّز بالصفحة */}
      <Card className="nk-card-hover" style={{ marginBottom: "1.1rem", background: "linear-gradient(135deg,#14431f,#1a5c2e)", border: "none", color: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 18 }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 12, color: C.gld, fontWeight: 700, marginBottom: 6 }}>🔮 الرؤية المستقبلية — توقّع نهاية الشهر</div>
            <div style={{ fontSize: 26, fontWeight: 900 }}>{fmt(projectedMonthTotal)} <span style={{ fontSize: 13, fontWeight: 500, color: C.gld }}>{cur}</span></div>
            <div style={{ fontSize: 11.5, color: "rgba(255,255,255,.75)", marginTop: 4 }}>بمعدل الأداء الحالي ({fmt(Math.round(dailyAvg))} {cur}/يوم) — تقدير تقريبي وليس تنبؤاً دقيقاً</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: projDelta >= 0 ? "#8ee6a8" : "#ff9b9b" }}>{projDelta >= 0 ? "▲" : "▼"} {Math.abs(projDelta)}%</div>
            <div style={{ fontSize: 10.5, color: "rgba(255,255,255,.7)" }}>مقارنة بالشهر الماضي كاملاً<br />({fmt(prevMonthFullTotal)} {cur})</div>
          </div>
          <div style={{ minWidth: 140 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: "rgba(255,255,255,.75)", marginBottom: 4 }}><span>اكتمل الشهر</span><span>{Math.round(daysElapsed / daysInCurMonth * 100)}%</span></div>
            <div style={{ height: 8, borderRadius: 4, background: "rgba(255,255,255,.2)", overflow: "hidden" }}><div style={{ width: (daysElapsed / daysInCurMonth * 100) + "%", height: "100%", background: C.gold }} /></div>
          </div>
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: ctx.scr?.isTab ? "1fr" : "1.3fr 1fr", gap: 12, marginBottom: 12 }}>
        <Card className="nk-card-hover">
          <CardHead title="اتجاه الإيراد اليومي" sub="الشهر الحالي (مساحة) مقابل الشهر الماضي (متقطّع)" />
          <TrendChart curSeries={curSeries} prevSeries={prevSeries} colorA={C.grl} colorB={C.gold} />
          <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 4 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: C.k2 }}><i style={{ width: 14, height: 3, borderRadius: 2, background: C.grl, display: "inline-block" }} />هذا الشهر</span>
            <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: C.k2 }}><i style={{ width: 14, height: 3, borderRadius: 2, background: C.gold, display: "inline-block" }} />الشهر الماضي</span>
          </div>
        </Card>
        <Card className="nk-card-hover">
          <CardHead title="🏆 أفضل الموظفين هذا الشهر" sub="حسب إيراد المبيعات المسجَّلة" />
          {hasEmpData ? <RankBarChart data={topEmployees} color={C.grl} cur={cur} /> : <div style={{ textAlign: "center", color: C.mt, fontSize: 12, padding: "2rem 0" }}>لا بيانات كافية بعد هذا الشهر</div>}
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: ctx.scr?.isTab ? "1fr" : "1fr 1fr", gap: 12 }}>
        <Card className="nk-card-hover">
          <CardHead title="المبيعات حسب الأقسام" sub="هذا الشهر مقابل نفس الفترة من الشهر الماضي" />
          {hasCatData ? <CompareBarChart data={catData} labelA="هذا الشهر" labelB="الشهر الماضي" colorA={C.grl} colorB={C.gold} cur={cur} /> : <div style={{ textAlign: "center", color: C.mt, fontSize: 12, padding: "2rem 0" }}>لا بيانات أقسام كافية (تنطبق على الفواتير المُصدرة بعد تفعيل هذه الميزة)</div>}
        </Card>
        <Card className="nk-card-hover">
          <CardHead title="إيراد الحجوزات حسب المورد" sub="هذا الشهر مقابل نفس الفترة من الشهر الماضي" />
          {hasResData ? <CompareBarChart data={resData} labelA="هذا الشهر" labelB="الشهر الماضي" colorA="#2a78d6" colorB={C.gold} cur={cur} /> : <div style={{ textAlign: "center", color: C.mt, fontSize: 12, padding: "2rem 0" }}>لا حجوزات كافية للمقارنة بعد</div>}
        </Card>
      </div>
    </>
  );
}
