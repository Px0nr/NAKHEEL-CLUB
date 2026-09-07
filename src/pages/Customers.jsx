import { useState, useEffect, useMemo } from "react";
import { C, fmt } from "../constants/theme.js";
import { PageTop, Btn, KCard, Card, CardHead, Sel, inputStyle, Table, Badge } from "../components/ui.jsx";
import NewCustomerModal from "../components/NewCustomerModal.jsx";
import CustomerDetail from "./CustomerDetail.jsx";

/* ============================ CUSTOMERS ============================ */
export default function Customers({ ctx }) {
  const { customers, invoices, settings } = ctx;
  const [modal, setModal] = useState(false);
  const [q, setQ] = useState(() => (ctx.searchIntent && ctx.searchIntent.type === "customer") ? ctx.searchIntent.query : "");
  const [filter, setFilter] = useState("all"); // all | debt
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

  const shown = customers.filter(c => {
    if (!(c.name.includes(q) || c.phone.includes(q))) return false;
    if (filter === "debt") return (c.debt || 0) > 0;
    return true;
  });
  const totalPages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pageRows = shown.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);
  const totalDebt = customers.reduce((s, c) => s + (c.debt || 0), 0);
  const debtorsCount = customers.filter(c => (c.debt || 0) > 0).length;

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
  const custStats = (c) => {
    const a = statsByCustomer.byId[c.id] || { count: 0, total: 0 };
    const b = statsByCustomer.byName[c.name] || { count: 0, total: 0 };
    return { count: a.count + b.count, total: a.total + b.total };
  };
  const computeTier = (stats) => {
    if (stats.total >= 3000 || stats.count >= 15) return "VIP";
    if (stats.count === 0) return "جديد";
    return "نشط";
  };

  return (
    <>
      <PageTop title="نظام الزبائن" action={<Btn gold onClick={() => setModal(true)}>+ إضافة زبون</Btn>} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 11, marginBottom: "1.1rem" }}>
        <KCard label="إجمالي الزبائن" value={customers.length} sub="زبون مسجّل" bar={C.grl} />
        <KCard label="أصحاب حسابات آجلة" value={debtorsCount} sub="عليهم مستحقات" bar={C.gold} />
        <KCard label="إجمالي الديون الآجلة" value={fmt(totalDebt)} sub={cur} bar={C.red} />
      </div>
      <Card>
        <CardHead title="قائمة الزبائن" sub={`${fmt(shown.length)} زبون مطابق`} right={
          <div style={{ display: "flex", gap: 7 }}>
            <input value={q} onChange={e => { setQ(e.target.value); setPage(1); }} placeholder="بحث بالاسم أو الهاتف..." style={{ ...inputStyle, width: 170 }} />
            <Sel value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }} style={{ width: 150 }}>
              <option value="all">كل الزبائن</option>
              <option value="debt">أصحاب حسابات آجلة</option>
            </Sel>
          </div>
        } />
        <Table cols={[{ h: "الاسم", w: "20%" }, { h: "واتساب", w: "17%" }, { h: "الفواتير", w: "11%" }, { h: "إجمالي الشراء", w: "16%" }, { h: "الرصيد الآجل", w: "15%" }, { h: "التصنيف", w: "11%" }, { h: "عرض", w: "10%" }]}
          rows={pageRows.map(c => {
            const stats = custStats(c);
            const tier = computeTier(stats);
            return [
              <span style={{ fontWeight: 600 }}>{c.name}</span>,
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>{c.wa ? <span style={{ color: "#25D366" }}>📱</span> : "—"} {c.phone}</span>,
              stats.count, fmt(stats.total) + " " + cur,
              (c.debt || 0) > 0 ? <Badge tone="a">{fmt(c.debt)} {cur}</Badge> : <Badge tone="g">مسدّد</Badge>,
              <Badge tone={tier === "VIP" ? "gold" : tier === "جديد" ? "b" : "g"}>{tier === "VIP" ? "⭐ VIP" : tier}</Badge>,
              <Btn sm onClick={() => setDetail(c)}>عرض</Btn>,
            ];
          })} />
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
      {detail && <CustomerDetail ctx={ctx} customer={customers.find(c => c.id === detail.id)} onClose={() => setDetail(null)} />}
    </>
  );
}
