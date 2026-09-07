import { useState, useEffect } from "react";
import { C, fmt } from "../constants/theme.js";
import { PageTop, Card, CardHead, KCard, Table, Badge, Btn, Modal, Sel, inputStyle } from "../components/ui.jsx";
import { openPdfDoc } from "../components/pdfHook.js";
import { arDate, todayISO } from "../utils/format.js";
import { DB } from "../db/db.js";

/* ============================ SALES ============================ */
export default function Sales({ ctx, can }) {
  const { invoices, setInvoices, confirm } = ctx;
  const cur = ctx.settings?.currency || "د.ل";
  const [q, setQ] = useState(() => (ctx.searchIntent && ctx.searchIntent.type === "invoice") ? ctx.searchIntent.query : "");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState(() => {
    if (ctx.searchIntent && ctx.searchIntent.type === "invoice") {
      return (ctx.invoices || []).find(i => i.id === ctx.searchIntent.id) || null;
    }
    return null;
  }); // الفاتورة المعروضة تفصيلياً
  useEffect(() => { if (ctx.searchIntent && ctx.searchIntent.type === "invoice") ctx.setSearchIntent(null); }, []);
  const PAGE_SIZE = 50;
  const PAY_TONE = { "كاش": "g", "بطاقة": "b", "تحويل": "p", "آجل": "a" };
  const SRC_TONE = { "منتج": "b", "حجز": "gold", "تأجير": "p", "رصيد سابق": "a" };
  const shown = invoices.filter(i =>
    (filter === "all" || i.status === filter) &&
    (i.customer.includes(q) || i.id.includes(q))
  );
  const totalPages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pageRows = shown.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);
  const monthSales = invoices.filter(i => i.status === "مدفوعة").reduce((s, i) => s + i.total, 0);
  const cancel = (id) => { if (!can("cancel")) return; setInvoices(iv => iv.map(i => i.id === id ? { ...i, status: "ملغاة" } : i)); setDetail(null); };
  const deleteInvoice = async (id) => {
    if (!can("cancel")) return;
    if (!(await confirm("حذف هذه الفاتورة نهائياً من السجل؟\n\nهذا مختلف عن «الإلغاء» — الحذف يزيل الفاتورة تماماً ولا يمكن التراجع عنه، ولن تظهر بعدها في أي تقرير. استخدمه فقط لتصحيح خطأ إدخال حقيقي (كفاتورة مكرَّرة بالخطأ).", { danger: true }))) return;
    const inv = invoices.find(i => i.id === id);
    setInvoices(iv => iv.filter(i => i.id !== id));
    DB.flush("invoices");
    if (inv) {
      ctx.setAuditLog(al => [{ id: "AU-" + Date.now(), date: todayISO(), by: ctx.user?.name || "—", type: "حذف فاتورة", detail: `#${inv.id} — ${inv.customer} — ${fmt(inv.total)} ${cur}` }, ...al]);
      DB.flush("auditLog");
    }
    ctx.showToast("تم حذف الفاتورة نهائياً");
    setDetail(null);
  };
  const printInvoice = (i) => {
    openPdfDoc(ctx.settings, {
      title: "فاتورة مبيعات", recipientLabel: "الزبون", recipientName: i.customer,
      docNo: i.id,
      columns: i.items && i.items.length ? ["الصنف", "القسم", "الكمية", "الإجمالي"] : ["التفاصيل"],
      rows: i.items && i.items.length ? i.items.map(it => [it.name, it.cat, it.qty, fmt(it.lineTotal) + " " + cur]) : [[i.details]],
      totals: [["طريقة الدفع", i.pay], ["الحالة", i.status], ["الإجمالي", fmt(i.total) + " " + cur]],
      note: `التاريخ: ${arDate(i.date)}${i.time ? " — " + i.time : ""} — بواسطة: ${i.by || "—"}`,
    });
  };
  return (
    <>
      <PageTop title="المبيعات والفواتير" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 11, marginBottom: "1.1rem" }}>
        <KCard label="إجمالي المبيعات" value={fmt(monthSales)} sub="دينار ليبي" bar="#1a8c3e" />
        <KCard label="عدد الفواتير" value={invoices.length} bar="#2a78d6" />
        <KCard label="متوسط الفاتورة" value={(() => { const paid = invoices.filter(i => i.status === "مدفوعة"); return paid.length ? fmt(Math.round(monthSales / paid.length)) : 0; })()} sub="د.ل" bar={C.gold} />
      </div>
      <Card>
        <CardHead title="سجل الفواتير" sub={`الفواتير من الحجوزات تظهر بعلامة (حجز) — ${fmt(shown.length)} فاتورة مطابقة — اضغط أي صف لعرض التفاصيل`} right={
          <div style={{ display: "flex", gap: 7 }}>
            <input value={q} onChange={e => { setQ(e.target.value); setPage(1); }} placeholder="بحث..." style={{ ...inputStyle, width: 150 }} />
            <Sel value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }} style={{ width: 110 }}>
              <option value="all">كل الحالات</option><option value="مدفوعة">مدفوعة</option><option value="معلقة">معلقة</option><option value="ملغاة">ملغاة</option>
            </Sel>
          </div>
        } />
        <Table cols={[{ h: "رقم", w: "13%" }, { h: "الزبون", w: "16%" }, { h: "التاريخ", w: "12%" }, { h: "المصدر", w: "11%" }, { h: "التفاصيل", w: "16%" }, { h: "الدفع", w: "10%" }, { h: "الإجمالي", w: "11%" }, { h: "الحالة", w: "11%" }]}
          rows={pageRows.map(i => [
            <span onClick={() => setDetail(i)} style={{ cursor: "pointer", fontWeight: 600, color: C.blue }}>#{i.id}</span>,
            <span onClick={() => setDetail(i)} style={{ cursor: "pointer" }}>{i.customer}</span>,
            arDate(i.date),
            <Badge tone={SRC_TONE[i.source] || "b"}>{i.source}</Badge>,
            <span onClick={() => setDetail(i)} style={{ cursor: "pointer" }}>{i.details}</span>,
            <Badge tone={PAY_TONE[i.pay] || "g"}>{i.pay}</Badge>,
            fmt(i.total) + " د.ل",
            <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <Badge tone={i.status === "مدفوعة" ? "g" : i.status === "ملغاة" ? "r" : "a"}>{i.status}</Badge>
              <button onClick={() => setDetail(i)} title="عرض التفاصيل" style={{ background: "none", border: "none", cursor: "pointer", color: C.blue, fontSize: 13 }}>👁</button>
            </span>,
          ])} />
        {shown.length === 0 && <div style={{ textAlign: "center", color: C.mt, fontSize: 12.5, padding: "1.5rem" }}>لا فواتير مطابقة</div>}
        {totalPages > 1 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 12, paddingTop: 10, borderTop: `0.5px solid ${C.bc}` }}>
            <Btn sm onClick={() => setPage(p => Math.max(1, p - 1))} style={{ opacity: pageSafe === 1 ? .4 : 1 }}>‹ السابق</Btn>
            <span style={{ fontSize: 12, color: C.mt }}>صفحة {pageSafe} من {totalPages}</span>
            <Btn sm onClick={() => setPage(p => Math.min(totalPages, p + 1))} style={{ opacity: pageSafe === totalPages ? .4 : 1 }}>التالي ›</Btn>
          </div>
        )}
      </Card>

      {/* نافذة تفاصيل الفاتورة */}
      {detail && (
        <Modal title={`فاتورة #${detail.id}`} onClose={() => setDetail(null)} width={560}>
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
            <div><div style={{ fontSize: 11, color: C.mt }}>الزبون</div><div style={{ fontSize: 14, fontWeight: 700 }}>{detail.customer}</div></div>
            <div><div style={{ fontSize: 11, color: C.mt }}>التاريخ</div><div style={{ fontSize: 14, fontWeight: 700 }}>{arDate(detail.date)}{detail.time ? " — " + detail.time : ""}</div></div>
            <div><div style={{ fontSize: 11, color: C.mt }}>الحالة</div><Badge tone={detail.status === "مدفوعة" ? "g" : detail.status === "ملغاة" ? "r" : "a"}>{detail.status}</Badge></div>
          </div>

          {detail.items && detail.items.length > 0 ? (
            <Table cols={[{ h: "الصنف", w: "45%" }, { h: "القسم", w: "20%" }, { h: "الكمية", w: "15%" }, { h: "الإجمالي", w: "20%" }]}
              rows={detail.items.map(it => [it.name, it.cat, it.qty, fmt(it.lineTotal) + " " + cur])} />
          ) : (
            <div style={{ background: C.crm, borderRadius: 8, padding: ".7rem .9rem", fontSize: 13, marginBottom: 10 }}>{detail.details}</div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14, background: C.crm, borderRadius: 10, padding: ".8rem 1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}><span style={{ color: C.mt }}>المصدر</span><Badge tone={SRC_TONE[detail.source] || "b"}>{detail.source}</Badge></div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}><span style={{ color: C.mt }}>طريقة الدفع</span><Badge tone={PAY_TONE[detail.pay] || "g"}>{detail.pay}</Badge></div>
            {detail.discount && detail.discount !== "—" && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}><span style={{ color: C.mt }}>الخصم</span><span>{detail.discount}</span></div>}
            {detail.dueDate && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}><span style={{ color: C.mt }}>تاريخ الاستحقاق</span><span>{arDate(detail.dueDate)}</span></div>}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}><span style={{ color: C.mt }}>بواسطة</span><span>{detail.by || "—"}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 800, gridColumn: "1/-1", borderTop: `0.5px solid ${C.bc}`, paddingTop: 8, marginTop: 4 }}><span>الإجمالي</span><span style={{ color: C.grn2 }}>{fmt(detail.total)} {cur}</span></div>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
            <Btn gold onClick={() => printInvoice(detail)}>🖨 طباعة</Btn>
            {can("cancel") && detail.status !== "ملغاة" && <Btn onClick={() => cancel(detail.id)}>✕ إلغاء الفاتورة</Btn>}
            {can("cancel") && <Btn danger onClick={() => deleteInvoice(detail.id)}>🗑 حذف نهائياً</Btn>}
          </div>
        </Modal>
      )}
    </>
  );
}
