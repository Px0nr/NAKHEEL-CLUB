import { useState, useEffect, useMemo } from "react";
import { C, fmt } from "../constants/theme.js";
import { PageTop, Btn, KCard, Card, CardHead, Sel, inputStyle, Table, Badge } from "../components/ui.jsx";
import NewCustomerModal from "../components/NewCustomerModal.jsx";
import CustomerDetail from "./CustomerDetail.jsx";
import { todayISO, arDate, daysBetween } from "../utils/format.js";
import { downloadCsv, downloadExcel } from "../utils/exportTable.js";

const IDLE_DAYS = 60; // بلا شراء منذ أكثر من شهرين → "خامل" بدل "نشط" إلى الأبد

/* ============================ CUSTOMERS ============================ */
export default function Customers({ ctx, go }) {
  const { customers, invoices, settings, setCustomers, showToast, confirm } = ctx;
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null); // زبون قيد تعديل بياناته
  const [q, setQ] = useState(() => (ctx.searchIntent && ctx.searchIntent.type === "customer") ? ctx.searchIntent.query : "");
  const [filter, setFilter] = useState("all"); // all | debt
  const [sortKey, setSortKey] = useState(null); // null | "total" | "last" | "debt"
  const [sortDir, setSortDir] = useState("desc");
  const [detail, setDetail] = useState(() => {
    if (ctx.searchIntent && ctx.searchIntent.type === "customer") {
      return (ctx.customers || []).find(c => c.id === ctx.searchIntent.id) || null;
    }
    return null;
  });
  useEffect(() => { if (ctx.searchIntent && ctx.searchIntent.type === "customer") ctx.setSearchIntent(null); }, []);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;
  const cur = settings?.currency || "د.ل";
  const totalDebt = customers.reduce((s, c) => s + (c.debt || 0), 0);
  const debtorsCount = customers.filter(c => (c.debt || 0) > 0).length;

  const deleteCustomer = async (c) => {
    if ((c.debt || 0) > 0) { showToast("لا يمكن حذف زبون عليه رصيد آجل مستحق — حصّل الدين أولاً"); return; }
    if (!(await confirm(`حذف الزبون «${c.name}» نهائياً؟ سجل فواتيره السابقة يبقى محفوظاً بلا ربط بزبون.`))) return;
    setCustomers(cs => cs.filter(x => x.id !== c.id));
    showToast("تم حذف الزبون");
  };

  // تصنيف تلقائي: يُحسب من سجل مشتريات الزبون الفعلي — بمرور واحد على الفواتير (لا فلترة لكل زبون على حدة)
  // الفواتير الحديثة مرتبطة بمعرّف الزبون (customerId) فلا تتأثر بتعديل الاسم لاحقاً؛
  // الفواتير القديمة (قبل هذه الميزة) لا تحمل معرّفاً فتُطابَق بالاسم كما كان سابقاً
  const statsByCustomer = useMemo(() => {
    const byId = {}, byName = {};
    invoices.forEach(i => {
      if (i.status !== "مدفوعة") return;
      if (i.customerId != null) {
        if (!byId[i.customerId]) byId[i.customerId] = { count: 0, total: 0 };
        byId[i.customerId].count++; byId[i.customerId].total += i.total;
      } else {
        if (!byName[i.customer]) byName[i.customer] = { count: 0, total: 0 };
        byName[i.customer].count++; byName[i.customer].total += i.total;
      }
    });
    return { byId, byName };
  }, [invoices]);
  // "نشط" كانت تُمنح لأي زبون له فاتورة واحدة ولو قبل سنة، فتبقى كذلك للأبد
  // بلا أي تمييز عن زبون خامل — رغم توفر تاريخ آخر شراء (c.last) لحسابه فعلياً
  const computeTier = (c, stats) => {
    if (stats.total >= 3000 || stats.count >= 15) return "VIP";
    if (stats.count === 0) return "جديد";
    if (c.last && daysBetween(c.last, todayISO()) > IDLE_DAYS) return "خامل";
    return "نشط";
  };
  const TIER_TONE = { "VIP": "gold", "جديد": "b", "خامل": "a", "نشط": "g" };
  const TIER_LABEL = { "VIP": "⭐ VIP" };

  // إثراء كل زبون بإحصاءاته وتصنيفه مرة واحدة — يُستخدم للفلترة والفرز والتصدير معاً
  const enriched = useMemo(() => customers.map(c => {
    const a = statsByCustomer.byId[c.id] || { count: 0, total: 0 };
    const b = statsByCustomer.byName[c.name] || { count: 0, total: 0 };
    const stats = { count: a.count + b.count, total: a.total + b.total };
    return { c, stats, tier: computeTier(c, stats) };
  }), [customers, statsByCustomer]);

  const shown = enriched.filter(({ c }) => {
    if (!(c.name.includes(q) || c.phone.includes(q))) return false;
    if (filter === "debt") return (c.debt || 0) > 0;
    return true;
  });
  // فرز اختياري بالضغط على رأس عمود «إجمالي الشراء»/«آخر شراء»/«الرصيد الآجل» —
  // كان الترتيب ثابتاً بترتيب الإدخال بلا طريقة لرؤية أكبر مدين أو أعلى شراء أولاً
  const sortVal = ({ c, stats }) => {
    if (sortKey === "total") return stats.total;
    if (sortKey === "debt") return c.debt || 0;
    if (sortKey === "last") return c.last ? new Date(c.last).getTime() : 0;
    return 0;
  };
  const sortedShown = sortKey ? [...shown].sort((a, b) => (sortVal(a) - sortVal(b)) * (sortDir === "asc" ? 1 : -1)) : shown;
  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };
  const sortArrow = (key) => sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : " ↕";
  const totalPages = Math.max(1, Math.ceil(sortedShown.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pageRows = sortedShown.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);
  // تصدير قائمة الزبائن (النطاق المفلتَر) — لم يكن لهذا الجدول أي تصدير خلافاً
  // لبقية سجلات النظام
  const customersExportSheet = () => [{
    name: "الزبائن",
    thead: ["الاسم", "الهاتف", "الفواتير", "إجمالي الشراء", "آخر شراء", "الرصيد الآجل", "التصنيف", ...(settings?.loyaltyOn ? ["النقاط"] : [])],
    tbody: shown.map(({ c, stats, tier }) => [
      c.name, c.phone, stats.count, Math.round(stats.total * 10) / 10, c.last ? arDate(c.last) : "—", c.debt || 0, tier,
      ...(settings?.loyaltyOn ? [c.points || 0] : []),
    ]),
  }];

  return (
    <>
      <PageTop title="نظام الزبائن" action={
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
          {debtorsCount > 0 && go && <Btn onClick={() => go("alerts")}>🔔 تنبيهات السداد ({debtorsCount})</Btn>}
          <Btn gold onClick={() => setModal(true)}>+ إضافة زبون</Btn>
        </div>
      } />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 11, marginBottom: "1.1rem" }}>
        <KCard label="إجمالي الزبائن" value={customers.length} sub="زبون مسجّل" bar={C.grl} />
        <KCard label="أصحاب حسابات آجلة" value={debtorsCount} sub="عليهم مستحقات" bar={C.gold} />
        <KCard label="إجمالي الديون الآجلة" value={fmt(totalDebt)} sub={cur} bar={C.red} />
      </div>
      <Card>
        <CardHead title="قائمة الزبائن" sub={`${fmt(shown.length)} زبون مطابق`} right={
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            <input value={q} onChange={e => { setQ(e.target.value); setPage(1); }} placeholder="بحث بالاسم أو الهاتف..." style={{ ...inputStyle, width: 170 }} />
            <Sel value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }} style={{ width: 150 }}>
              <option value="all">كل الزبائن</option>
              <option value="debt">أصحاب حسابات آجلة</option>
            </Sel>
            <Btn sm onClick={() => downloadCsv(customersExportSheet(), `الزبائن-${todayISO()}`)}>⬇ CSV</Btn>
            <Btn sm onClick={() => downloadExcel(customersExportSheet(), `الزبائن-${todayISO()}`)}>📊 Excel</Btn>
          </div>
        } />
        <Table cols={[
          { h: "الاسم", w: "14%" }, { h: "واتساب", w: "13%" }, { h: "الفواتير", w: "7%" },
          { h: <span onClick={() => toggleSort("total")} style={{ cursor: "pointer", userSelect: "none" }} title="فرز حسب إجمالي الشراء">إجمالي الشراء{sortArrow("total")}</span>, w: "12%" },
          { h: <span onClick={() => toggleSort("last")} style={{ cursor: "pointer", userSelect: "none" }} title="فرز حسب تاريخ آخر شراء">آخر شراء{sortArrow("last")}</span>, w: "10%" },
          { h: <span onClick={() => toggleSort("debt")} style={{ cursor: "pointer", userSelect: "none" }} title="فرز حسب الرصيد الآجل">الرصيد الآجل{sortArrow("debt")}</span>, w: "11%" },
          ...(settings?.loyaltyOn ? [{ h: "🎁 النقاط", w: "8%" }] : []),
          { h: "التصنيف", w: "9%" }, { h: "إجراءات", w: "16%" },
        ]}
          rows={pageRows.map(({ c, stats, tier }) => [
            <span style={{ fontWeight: 600 }}>{c.name}</span>,
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>{c.wa ? <span style={{ color: "#25D366" }}>📱</span> : "—"} {c.phone}</span>,
            stats.count, fmt(stats.total) + " " + cur,
            <span style={{ fontSize: 11 }}>{c.last ? arDate(c.last) : "—"}</span>,
            (c.debt || 0) > 0 ? <Badge tone="a">{fmt(c.debt)} {cur}</Badge> : <Badge tone="g">مسدّد</Badge>,
            ...(settings?.loyaltyOn ? [<span>🎁 {c.points || 0}</span>] : []),
            <Badge tone={TIER_TONE[tier]}>{TIER_LABEL[tier] || tier}</Badge>,
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              <Btn sm onClick={() => setDetail(c)}>عرض</Btn>
              <Btn sm onClick={() => setEditing(c)}>✎</Btn>
              <Btn sm danger onClick={() => deleteCustomer(c)}>🗑</Btn>
            </div>,
          ])} />
        {shown.length === 0 && <div style={{ textAlign: "center", color: C.mt, fontSize: 12.5, padding: "1.5rem" }}>لا زبائن مطابقون</div>}
        {totalPages > 1 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 12, paddingTop: 10, borderTop: `0.5px solid ${C.bc}` }}>
            <Btn sm onClick={() => setPage(p => Math.max(1, p - 1))} style={{ opacity: pageSafe === 1 ? .4 : 1 }}>‹ السابق</Btn>
            <span style={{ fontSize: 12, color: C.mt }}>صفحة {pageSafe} من {totalPages}</span>
            <Btn sm onClick={() => setPage(p => Math.min(totalPages, p + 1))} style={{ opacity: pageSafe === totalPages ? .4 : 1 }}>التالي ›</Btn>
          </div>
        )}
      </Card>

      {modal && <NewCustomerModal ctx={ctx} onClose={() => setModal(false)} onCreated={() => setModal(false)} />}
      {editing && <NewCustomerModal ctx={ctx} customer={editing} onClose={() => setEditing(null)} onCreated={() => setEditing(null)} />}
      {detail && <CustomerDetail ctx={ctx} customer={customers.find(c => c.id === detail.id)} onClose={() => setDetail(null)} />}
    </>
  );
}
