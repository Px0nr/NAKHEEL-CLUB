import { useState, useMemo } from "react";
import { C, fmt } from "../constants/theme.js";
import { TYPE_NAME } from "../constants/seeds.js";
import { PageTop, Badge, KCard, Card, CardHead, Sel, Btn, Table } from "../components/ui.jsx";
import { TrendChart, RankBarChart, CompareBarChart } from "../components/charts.jsx";
import { categoryTotals, catLabel, pctDelta, deltaLabel, rangePreset, inRange } from "../utils/analytics.js";
import { arDate, daysBetween, todayISO } from "../utils/format.js";

const RANGE_OPTIONS = [
  ["last7", "آخر 7 أيام"],
  ["last30", "آخر 30 يوماً"],
  ["thisMonth", "هذا الشهر"],
  ["thisQuarter", "هذا الربع"],
  ["thisYear", "هذه السنة"],
];
// الفترات التقويمية الجارية (شهر/ربع/سنة) لها نهاية طبيعية في المستقبل فيُتاح لها "توقّع نهاية الفترة"؛
// النوافذ المتحركة (آخر 7/30 يوماً) مكتملة دائماً حتى اليوم فلا معنى لتوقّع نهايتها
const PROJECTABLE = { thisMonth: "lastMonth", thisQuarter: "lastQuarter", thisYear: "lastYear" };
const STAGNANT_DAYS = 30; // صنف لم يُبَع خلال هذه المدة رغم وجود مخزون منه يُعتبر راكداً

/* ============================ INSIGHTS (لوحة الرؤى والتحليلات البيانية) ============================ */
export default function Insights({ ctx }) {
  const { invoices, expenses, cats, products } = ctx;
  const cur = ctx.settings?.currency || "د.ل";
  const [range, setRange] = useState("thisMonth");

  const { from, to } = useMemo(() => rangePreset(range), [range]);
  const daysElapsed = useMemo(() => daysBetween(from, to) + 1, [from, to]);
  // فترة مقارنة بنفس عدد الأيام مباشرة قبل الفترة الحالية — تعميم لفكرة "نفس الفترة من الشهر الماضي" لأي نطاق
  const { prevFrom, prevTo } = useMemo(() => {
    const toD = new Date(from + "T00:00:00Z");
    const prevToD = new Date(toD.getTime() - 86400000);
    const prevFromD = new Date(prevToD.getTime() - (daysElapsed - 1) * 86400000);
    const iso = (d) => d.toISOString().slice(0, 10);
    return { prevFrom: iso(prevFromD), prevTo: iso(prevToD) };
  }, [from, daysElapsed]);

  const paid = useMemo(() => invoices.filter(i => i.status === "مدفوعة"), [invoices]);
  const curInvoices = useMemo(() => paid.filter(i => inRange(i.date, from, to)), [paid, from, to]);
  const prevInvoices = useMemo(() => paid.filter(i => inRange(i.date, prevFrom, prevTo)), [paid, prevFrom, prevTo]);

  const sumOf = (list) => ({ rev: list.reduce((s, i) => s + i.total, 0), count: list.length, cost: list.reduce((s, i) => s + (i.cost || 0), 0) });
  const curPeriod = sumOf(curInvoices);
  const prevPeriod = sumOf(prevInvoices);
  const curExp = expenses.filter(e => inRange(e.date, from, to)).reduce((s, e) => s + e.amount, 0);
  const prevExp = expenses.filter(e => inRange(e.date, prevFrom, prevTo)).reduce((s, e) => s + e.amount, 0);
  const curProfit = curPeriod.rev - curPeriod.cost - curExp;
  const prevProfit = prevPeriod.rev - prevPeriod.cost - prevExp;

  // ------- الرؤية المستقبلية: توقّع نهاية الفترة، مرجَّح بمتوسط أداء كل يوم أسبوع تاريخياً (لا معدّل خطي بسيط) -------
  // مثال: لو الجمعة والسبت تاريخياً أعلى إيراداً من أيام الأسبوع، يُحتسب هذا في توقّع الأيام المتبقية بدل توزيعها بالتساوي
  const weekdayAvg = useMemo(() => {
    const sums = Array(7).fill(0), counts = Array(7).fill(0);
    paid.forEach(i => {
      const dow = new Date(i.date + "T00:00:00Z").getUTCDay();
      sums[dow] += i.total; counts[dow]++;
    });
    return sums.map((s, i) => counts[i] ? s / counts[i] : 0);
  }, [paid]);
  const projection = useMemo(() => {
    const presetKey = PROJECTABLE[range];
    if (!presetKey) return null;
    const toD = new Date(to + "T00:00:00Z");
    let periodEnd;
    if (range === "thisMonth") periodEnd = new Date(Date.UTC(toD.getUTCFullYear(), toD.getUTCMonth() + 1, 0));
    else if (range === "thisQuarter") { const q = Math.floor(toD.getUTCMonth() / 3) * 3; periodEnd = new Date(Date.UTC(toD.getUTCFullYear(), q + 3, 0)); }
    else periodEnd = new Date(Date.UTC(toD.getUTCFullYear(), 11, 31));
    const remainingDays = Math.round((periodEnd - toD) / 86400000);
    let projectedRest = 0;
    for (let d = 1; d <= remainingDays; d++) {
      const dow = new Date(toD.getTime() + d * 86400000).getUTCDay();
      projectedRest += weekdayAvg[dow];
    }
    const projectedTotal = Math.round(curPeriod.rev + projectedRest);
    const fullPrev = rangePreset(presetKey);
    const prevFullTotal = paid.filter(i => inRange(i.date, fullPrev.from, fullPrev.to)).reduce((s, i) => s + i.total, 0);
    const periodTotalDays = daysBetween(from, to) + 1 + remainingDays;
    return { projectedTotal, prevFullTotal, delta: pctDelta(projectedTotal, prevFullTotal), pctComplete: Math.round((daysElapsed / periodTotalDays) * 100) };
  }, [range, to, from, daysElapsed, curPeriod.rev, weekdayAvg, paid]);

  // ------- المبيعات حسب الأقسام (الفترة الحالية مقابل المقارنة) -------
  const curCat = categoryTotals(curInvoices);
  const prevCat = categoryTotals(prevInvoices);
  const catKeys = [...new Set([...Object.keys(cats), ...Object.keys(curCat), ...Object.keys(prevCat)])];
  const catData = catKeys.map(k => ({ label: catLabel(k, cats), a: curCat[k] || 0, b: prevCat[k] || 0 })).filter(d => d.a + d.b > 0);

  // ------- اتجاه الإيراد اليومي: الفترة الحالية مقابل فترة المقارنة (نفس عدد الأيام) -------
  const revOn = (list, iso) => list.filter(i => i.date === iso).reduce((s, i) => s + i.total, 0);
  const seriesFor = (list, fromIso) => Array.from({ length: daysElapsed }, (_, i) => {
    const iso = new Date(new Date(fromIso + "T00:00:00Z").getTime() + i * 86400000).toISOString().slice(0, 10);
    return revOn(list, iso);
  });
  const curSeries = seriesFor(curInvoices, from);
  const prevSeries = seriesFor(prevInvoices, prevFrom);

  // ------- إيراد الحجوزات حسب المورد -------
  const resOf = (list) => {
    const map = {};
    list.forEach(i => {
      if (i.source !== "حجز") return;
      const t = i.resType || Object.keys(TYPE_NAME).find(k => i.details && i.details.includes(TYPE_NAME[k]));
      if (t) map[t] = (map[t] || 0) + i.total;
    });
    return map;
  };
  const curRes = resOf(curInvoices), prevRes = resOf(prevInvoices);
  const resData = Object.keys(TYPE_NAME).map(k => ({ label: TYPE_NAME[k], a: curRes[k] || 0, b: prevRes[k] || 0 })).filter(d => d.a + d.b > 0);

  // ------- أفضل 5 موظفين في الفترة -------
  const empRev = {};
  curInvoices.filter(i => i.by).forEach(i => { empRev[i.by] = (empRev[i.by] || 0) + i.total; });
  const topEmployees = Object.entries(empRev).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([label, value]) => ({ label, value }));

  // ------- أفضل 5 زبائن في الفترة -------
  const custRev = {};
  curInvoices.filter(i => i.customer && i.customer !== "زبون نقدي").forEach(i => { custRev[i.customer] = (custRev[i.customer] || 0) + i.total; });
  const topCustomers = Object.entries(custRev).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([label, value]) => ({ label, value }));

  // ------- هامش الربح بالقسم (الفترة الحالية) — الإيراد ناقص تكلفة البضاعة لكل قسم -------
  const marginByCat = useMemo(() => {
    const rev = {}, cost = {};
    curInvoices.forEach(inv => (inv.items || []).forEach(it => {
      const k = it.cat || "__uncat";
      rev[k] = (rev[k] || 0) + (it.lineTotal || 0);
      const p = it.pid != null ? products.find(x => x.id === it.pid) : null;
      cost[k] = (cost[k] || 0) + (p ? (p.buy || 0) * it.qty : 0);
    }));
    return Object.keys(rev).filter(k => rev[k] > 0 && k !== "__opening").map(k => {
      const r = rev[k], c = cost[k] || 0;
      return { key: k, label: catLabel(k, cats), rev: r, margin: r > 0 ? Math.round(((r - c) / r) * 100) : 0 };
    }).sort((a, b) => b.rev - a.rev);
  }, [curInvoices, products, cats]);

  // ------- المخزون الراكد: مخزون موجود لم يُبَع خلال آخر 30 يوماً (أو لم يُبَع إطلاقاً) -------
  const stagnant = useMemo(() => {
    const today = todayISO();
    const lastSoldByPid = {};
    paid.forEach(inv => (inv.items || []).forEach(it => {
      if (it.pid == null) return;
      if (!lastSoldByPid[it.pid] || inv.date > lastSoldByPid[it.pid]) lastSoldByPid[it.pid] = inv.date;
    }));
    return products
      .filter(p => p.stock > 0)
      .map(p => {
        const last = lastSoldByPid[p.id];
        return { ...p, lastSold: last || null, daysSince: last ? daysBetween(last, today) : null };
      })
      .filter(p => p.daysSince === null || p.daysSince >= STAGNANT_DAYS)
      .sort((a, b) => (b.daysSince ?? 9999) - (a.daysSince ?? 9999))
      .slice(0, 8);
  }, [products, paid]);

  const hasCatData = catData.length > 0, hasResData = resData.length > 0, hasEmpData = topEmployees.length > 0, hasCustData = topCustomers.length > 0;

  // ------- تصدير ملخص الرؤى إلى Excel -------
  const exportExcel = async () => {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const addSheet = (name, thead, tbody) => {
      const ws = wb.addWorksheet(name.slice(0, 31), { views: [{ rightToLeft: true }] });
      ws.addRow(thead);
      ws.getRow(1).font = { bold: true, color: { argb: "FFF0D080" } };
      ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1A5C2E" } };
      tbody.forEach(r => ws.addRow(r));
      ws.columns.forEach((col, i) => { const maxLen = Math.max(String(thead[i] ?? "").length, ...tbody.map(r => String(r[i] ?? "").length)); col.width = Math.min(40, Math.max(10, maxLen + 2)); });
    };
    addSheet("ملخص", ["المؤشر", "القيمة"], [
      ["الفترة", `${arDate(from)} — ${arDate(to)}`],
      ["الإيراد", curPeriod.rev], ["عدد الفواتير", curPeriod.count],
      ["صافي الربح التقديري", curProfit],
    ]);
    if (hasCatData) addSheet("المبيعات حسب الأقسام", ["القسم", "الفترة الحالية", "فترة المقارنة"], catData.map(d => [d.label, d.a, d.b]));
    if (hasEmpData) addSheet("أفضل الموظفين", ["الموظف", "الإيراد"], topEmployees.map(d => [d.label, d.value]));
    if (hasCustData) addSheet("أفضل الزبائن", ["الزبون", "الإجمالي"], topCustomers.map(d => [d.label, d.value]));
    if (marginByCat.length) addSheet("هامش الربح بالقسم", ["القسم", "الإيراد", "الهامش %"], marginByCat.map(d => [d.label, d.rev, d.margin]));
    if (stagnant.length) addSheet("مخزون راكد", ["المنتج", "المخزون", "آخر بيع"], stagnant.map(p => [p.name, p.stock, p.lastSold ? arDate(p.lastSold) : "لم يُبَع إطلاقاً"]));
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `رؤى-${range}-${todayISO()}.xlsx`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <>
      <PageTop title="📈 الرؤى والتحليلات البيانية" action={
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Sel value={range} onChange={e => setRange(e.target.value)} style={{ minWidth: 130 }}>
            {RANGE_OPTIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </Sel>
          <Badge tone="gold">{arDate(from)} — {arDate(to)}</Badge>
          <Btn sm onClick={exportExcel}>📊 تصدير Excel</Btn>
        </div>
      } />

      {/* KPI: الفترة الحالية مقابل فترة مقارنة بنفس عدد الأيام مباشرة قبلها */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 11, marginBottom: "1.1rem" }}>
        <KCard label="الإيراد" value={fmt(curPeriod.rev)} sub={cur} bar="#1a8c3e" delta={{ up: curPeriod.rev >= prevPeriod.rev, text: `${pctDelta(curPeriod.rev, prevPeriod.rev)}% عن الفترة السابقة` }} />
        <KCard label="عدد الفواتير" value={curPeriod.count} bar="#2a78d6" delta={{ up: curPeriod.count >= prevPeriod.count, text: `${pctDelta(curPeriod.count, prevPeriod.count)}%` }} />
        <KCard label="متوسط الفاتورة" value={fmt(curPeriod.count ? Math.round(curPeriod.rev / curPeriod.count) : 0)} sub={cur} bar={C.gold} />
        <KCard label="صافي الربح التقديري" value={fmt(curProfit)} sub={cur} bar={C.purp} delta={{ up: curProfit >= prevProfit, text: deltaLabel(curProfit, prevProfit, cur) + " عن الفترة السابقة" }} />
      </div>

      {/* الرؤية المستقبلية — فقط للفترات التقويمية الجارية (شهر/ربع/سنة) حيث توجد نهاية طبيعية في المستقبل */}
      {projection && (
        <Card className="nk-card-hover" style={{ marginBottom: "1.1rem", background: "linear-gradient(135deg,#14431f,#1a5c2e)", border: "none", color: "#fff" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 18 }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontSize: 12, color: C.gld, fontWeight: 700, marginBottom: 6 }}>🔮 الرؤية المستقبلية — توقّع نهاية الفترة</div>
              <div style={{ fontSize: 26, fontWeight: 900 }}>{fmt(projection.projectedTotal)} <span style={{ fontSize: 13, fontWeight: 500, color: C.gld }}>{cur}</span></div>
              <div style={{ fontSize: 11.5, color: "rgba(255,255,255,.75)", marginTop: 4 }}>مرجَّح بمتوسط أداء كل يوم أسبوع تاريخياً — تقدير تقريبي وليس تنبؤاً دقيقاً</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: projection.delta >= 0 ? "#8ee6a8" : "#ff9b9b" }}>{projection.delta >= 0 ? "▲" : "▼"} {Math.abs(projection.delta)}%</div>
              <div style={{ fontSize: 10.5, color: "rgba(255,255,255,.7)" }}>مقارنة بالفترة المكافئة الكاملة الماضية<br />({fmt(projection.prevFullTotal)} {cur})</div>
            </div>
            <div style={{ minWidth: 140 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: "rgba(255,255,255,.75)", marginBottom: 4 }}><span>اكتملت الفترة</span><span>{projection.pctComplete}%</span></div>
              <div style={{ height: 8, borderRadius: 4, background: "rgba(255,255,255,.2)", overflow: "hidden" }}><div style={{ width: projection.pctComplete + "%", height: "100%", background: C.gold }} /></div>
            </div>
          </div>
        </Card>
      )}

      <div style={{ display: "grid", gridTemplateColumns: ctx.scr?.isTab ? "1fr" : "1.3fr 1fr", gap: 12, marginBottom: 12 }}>
        <Card className="nk-card-hover">
          <CardHead title="اتجاه الإيراد اليومي" sub="الفترة الحالية (مساحة) مقابل فترة المقارنة (متقطّع)" />
          <TrendChart curSeries={curSeries} prevSeries={prevSeries} colorA={C.grl} colorB={C.gold} cur={cur} />
          <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 4 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: C.k2 }}><i style={{ width: 14, height: 3, borderRadius: 2, background: C.grl, display: "inline-block" }} />الفترة الحالية</span>
            <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: C.k2 }}><i style={{ width: 14, height: 3, borderRadius: 2, background: C.gold, display: "inline-block" }} />فترة المقارنة</span>
          </div>
        </Card>
        <Card className="nk-card-hover">
          <CardHead title="🏆 أفضل الموظفين" sub="حسب إيراد المبيعات المسجَّلة في الفترة" />
          {hasEmpData ? <RankBarChart data={topEmployees} color={C.grl} cur={cur} /> : <div style={{ textAlign: "center", color: C.mt, fontSize: 12, padding: "2rem 0" }}>لا بيانات كافية بعد لهذه الفترة</div>}
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: ctx.scr?.isTab ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <Card className="nk-card-hover">
          <CardHead title="المبيعات حسب الأقسام" sub="الفترة الحالية مقابل فترة المقارنة" />
          {hasCatData ? <CompareBarChart data={catData} labelA="الفترة الحالية" labelB="فترة المقارنة" colorA={C.grl} colorB={C.gold} cur={cur} /> : <div style={{ textAlign: "center", color: C.mt, fontSize: 12, padding: "2rem 0" }}>لا بيانات كافية للمقارنة بعد</div>}
        </Card>
        <Card className="nk-card-hover">
          <CardHead title="إيراد الحجوزات حسب المورد" sub="الفترة الحالية مقابل فترة المقارنة" />
          {hasResData ? <CompareBarChart data={resData} labelA="الفترة الحالية" labelB="فترة المقارنة" colorA="#2a78d6" colorB={C.gold} cur={cur} /> : <div style={{ textAlign: "center", color: C.mt, fontSize: 12, padding: "2rem 0" }}>لا حجوزات كافية للمقارنة بعد</div>}
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: ctx.scr?.isTab ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <Card className="nk-card-hover">
          <CardHead title="👑 أفضل الزبائن" sub="حسب إجمالي المشتريات في الفترة" />
          {hasCustData ? <RankBarChart data={topCustomers} color={C.gold} cur={cur} /> : <div style={{ textAlign: "center", color: C.mt, fontSize: 12, padding: "2rem 0" }}>لا بيانات زبائن كافية بعد لهذه الفترة</div>}
        </Card>
        <Card className="nk-card-hover">
          <CardHead title="💹 هامش الربح بالقسم" sub="الإيراد ناقص تكلفة البضاعة — الفترة الحالية" />
          {marginByCat.length ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {marginByCat.map(d => (
                <div key={d.key}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                    <span style={{ fontWeight: 600 }}>{d.label}</span>
                    <span style={{ color: d.margin >= 40 ? "#1a8c3e" : d.margin >= 15 ? C.gdd : C.red, fontWeight: 700 }}>{d.margin}%</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 4, background: C.crm, overflow: "hidden" }}>
                    <div style={{ width: Math.max(2, Math.min(100, d.margin)) + "%", height: "100%", background: d.margin >= 40 ? "#1a8c3e" : d.margin >= 15 ? C.gold : C.red }} />
                  </div>
                </div>
              ))}
            </div>
          ) : <div style={{ textAlign: "center", color: C.mt, fontSize: 12, padding: "2rem 0" }}>لا مبيعات منتجات كافية بعد لهذه الفترة</div>}
        </Card>
      </div>

      <Card className="nk-card-hover">
        <CardHead title="📦 مخزون راكد" sub={`منتجات لديها مخزون لكنها لم تُبَع منذ ${STAGNANT_DAYS} يوماً أو أكثر (أو لم تُبَع إطلاقاً)`} />
        {stagnant.length === 0 ? <div style={{ textAlign: "center", color: C.mt, fontSize: 12, padding: "1.5rem 0" }}>لا يوجد مخزون راكد حالياً ✓</div> : (
          <Table cols={[{ h: "المنتج", w: "40%" }, { h: "المخزون", w: "20%" }, { h: "آخر بيع", w: "40%" }]}
            rows={stagnant.map(p => [p.name, `${p.stock} ${p.unit || ""}`, p.lastSold ? <Badge tone="a">{arDate(p.lastSold)} ({p.daysSince} يوم)</Badge> : <Badge tone="r">لم يُبَع إطلاقاً</Badge>])} />
        )}
      </Card>
    </>
  );
}
