import { useState, useEffect, useMemo } from "react";
import { C, fmt } from "../constants/theme.js";
import { PageTop, Card, CardHead, KCard, Table, Badge, Btn, Modal, Sel, inputStyle } from "../components/ui.jsx";
import { openPdfDoc } from "../components/pdfHook.js";
import { arDate, todayISO, overdueDays } from "../utils/format.js";
import { applyReversal } from "../utils/invoiceReversal.js";
import { computeReturn, applyReturnToInvoice } from "../utils/invoiceReturn.js";
import { rangePreset, QUICK_RANGES } from "../utils/analytics.js";
import { downloadCsv, downloadExcel } from "../utils/exportTable.js";
import { payBreakdown } from "../utils/payments.js";
import CustomerDetail from "./CustomerDetail.jsx";
import { DB } from "../db/db.js";

/* ============================ SALES ============================ */
export default function Sales({ ctx, can }) {
  const { invoices, setInvoices, setProducts, setCustomers, confirm } = ctx;
  const cur = ctx.settings?.currency || "د.ل";
  const [q, setQ] = useState(() => (ctx.searchIntent && ctx.searchIntent.type === "invoice") ? ctx.searchIntent.query : "");
  const [filter, setFilter] = useState("all");
  const [payFilter, setPayFilter] = useState("all"); // فلترة إضافية بطريقة الدفع — لم تكن موجودة
  const [srcFilter, setSrcFilter] = useState("all"); // فلترة إضافية بمصدر الفاتورة — لم تكن موجودة
  const [sortKey, setSortKey] = useState(null); // null | "total" | "date"
  const [sortDir, setSortDir] = useState("desc");
  const [custDetail, setCustDetail] = useState(null); // ملف الزبون المفتوح من داخل تفاصيل فاتورة
  // النطاق الزمني فارغ افتراضياً = كل الفواتير (السلوك السابق)، فلا يُفاجأ المستخدم
  // بسجل مقصوص عند فتح الصفحة
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  // إرجاع جزئي: { [فهرس السطر]: الكمية } — تُفتح لفاتورة واحدة في كل مرة
  const [returnFor, setReturnFor] = useState(null);
  const [returnQtys, setReturnQtys] = useState({});
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
  // البحث يشمل أسماء الأصناف داخل الفاتورة أيضاً — «من اشترى هذا الصنف؟» سؤال
  // يومي لم يكن ممكناً حين اقتصر البحث على اسم الزبون ورقم الفاتورة
  const matchesQuery = (i) => {
    if (!q) return true;
    const t = q.trim();
    return (i.customer || "").includes(t) || (i.id || "").includes(t) ||
      (i.details || "").includes(t) ||
      (i.items || []).some(it => (it.name || "").includes(t));
  };
  const shown = invoices.filter(i =>
    (filter === "all" || i.status === filter) &&
    (payFilter === "all" || (payFilter === "split" ? (Array.isArray(i.payParts) && i.payParts.length > 0) : i.pay === payFilter)) &&
    (srcFilter === "all" || i.source === srcFilter) &&
    (!from || i.date >= from) && (!to || i.date <= to) &&
    matchesQuery(i)
  );
  // فرز اختياري بالضغط على رأس عمود «الإجمالي»/«التاريخ» — كان الترتيب ثابتاً
  // بترتيب الإدخال (الأحدث أولاً) بلا طريقة لرؤية أكبر فاتورة أولاً مثلاً
  const sortVal = (i) => sortKey === "total" ? i.total : sortKey === "date" ? new Date(i.date + "T" + (i.time || "00:00")).getTime() : 0;
  const sortedShown = sortKey ? [...shown].sort((a, b) => (sortVal(a) - sortVal(b)) * (sortDir === "asc" ? 1 : -1)) : shown;
  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };
  const sortArrow = (key) => sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : " ↕";
  const totalPages = Math.max(1, Math.ceil(sortedShown.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pageRows = sortedShown.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);
  // المؤشرات تتبع ما هو معروض فعلاً: كانت تجمع كل تاريخ النظام فتفقد معناها
  // بعد أشهر من التشغيل، ولا تتأثر بأي فلتر يختاره المستخدم
  const shownPaid = shown.filter(i => i.status === "مدفوعة");
  const shownSales = shownPaid.reduce((s, i) => s + i.total, 0);
  const applyQuickRange = (key) => { const r = rangePreset(key); setFrom(r.from); setTo(r.to); setPage(1); };
  const clearFilters = () => { setFrom(""); setTo(""); setQ(""); setFilter("all"); setPayFilter("all"); setSrcFilter("all"); setPage(1); };

  // حالة الفاتورة الفعلية: فاتورة آجلة معلَّقة تجاوزت موعد الاستحقاق تُعرض
  // «متأخرة» بلون أحمر بدل «معلقة» الكهرمانية العامة نفسها لكل الحالات المعلّقة
  const statusLabel = (i) => overdueDays(i) > 0 ? "متأخرة" : i.status;
  const statusTone = (i) => i.status === "مدفوعة" ? "g" : i.status === "ملغاة" ? "r" : overdueDays(i) > 0 ? "r" : "a";

  // توزيع طرق الدفع ضمن الفترة المعروضة — يفكّك الفواتير المقسَّمة عبر
  // payBreakdown كي لا تُحتسب فاتورة نصفها كاش ونصفها بطاقة كلها لطريقة واحدة
  const payTotals = useMemo(() => {
    const totals = {};
    shownPaid.forEach(i => payBreakdown(i).forEach(p => { totals[p.method] = (totals[p.method] || 0) + p.amount; }));
    return totals;
  }, [shownPaid]);

  // سجل مرتجعات موحَّد عبر كل الفواتير المعروضة — كانت المرتجعات لا تظهر إلا
  // داخل تفاصيل كل فاتورة على حدة بلا أي رؤية إجمالية لفترة معينة
  const allReturns = useMemo(() => shown.flatMap(i => (i.returns || []).map((r, idx) => ({
    key: `${i.id}-${idx}`, invId: i.id, customer: i.customer, ...r,
  }))).sort((a, b) => b.date.localeCompare(a.date)), [shown]);
  const totalReturned = allReturns.reduce((s, r) => s + r.amount, 0);

  // التصدير يتبع الفلاتر الحالية — تصدير كل شيء دائماً يجعل الفلترة بلا فائدة
  const exportSheet = () => [{
    name: "الفواتير",
    thead: ["رقم", "الزبون", "التاريخ", "الوقت", "المصدر", "التفاصيل", "الدفع", "الحالة", "بواسطة", `الإجمالي (${cur})`],
    tbody: shown.map(i => ["#" + i.id, i.customer, i.date, i.time || "", i.source, i.details, i.paidVia ? `آجل ← ${i.paidVia}` : i.pay, i.status, i.by || "", i.total]),
  }];
  const exportName = () => `الفواتير-${from || "الكل"}-${to || todayISO()}`;
  // رسالة تُلحق بالتأكيد حين تكون الفاتورة قديمة (بلا حقل pieces) فقد يكون عدد
  // القطع المُعادة تقريبياً — الشفافية هنا أفضل من عكسٍ صامت بأرقام قد تكون خاطئة
  const reversalNote = (inv) => {
    const approx = (inv?.items || []).some(it => it.pid != null && it.pieces == null);
    return approx ? "\n\nتنبيه: هذه فاتورة قديمة لا تحمل تفصيل عدد القطع، فقد تكون الكمية المُعادة للمخزون تقريبية — راجع المخزون بعدها." : "";
  };

  // الإلغاء يعكس أثر الفاتورة (مخزون، دَين، نقاط) ويُبقيها ظاهرة في السجل بحالة «ملغاة».
  // كان سابقاً يغيّر كلمة الحالة فقط فتبقى البضاعة مخصومة والدَين على الزبون.
  const cancel = async (id) => {
    if (!can("cancel")) return;
    const inv = invoices.find(i => i.id === id);
    if (!inv) return;
    if (!(await confirm(`إلغاء الفاتورة #${inv.id}؟\n\nسيُعاد المخزون المخصوم، ويُخصم أي دين أو نقاط ولاء نتجت عنها. تبقى الفاتورة في السجل بحالة «ملغاة».${reversalNote(inv)}`, { danger: true }))) return;
    applyReversal(inv, { setProducts, setCustomers });
    setInvoices(iv => iv.map(i => i.id === id ? { ...i, status: "ملغاة" } : i));
    ctx.setAuditLog(al => [{ id: "AU-" + Date.now(), date: todayISO(), by: ctx.user?.name || "—", type: "إلغاء فاتورة", detail: `#${inv.id} — ${inv.customer} — ${fmt(inv.total)} ${cur}` }, ...al]);
    DB.flush("invoices"); DB.flush("auditLog");
    ctx.showToast(`أُلغيت الفاتورة #${inv.id} وأُعيد أثرها`);
    setDetail(null);
  };
  const deleteInvoice = async (id) => {
    if (!can("cancel")) return;
    const inv = invoices.find(i => i.id === id);
    if (!inv) return;
    // الفاتورة الملغاة سبق أن عُكس أثرها عند الإلغاء، فلا يُعكس مرتين (applyReversal يحرس ذلك أيضاً)
    const alreadyReversed = inv.status === "ملغاة";
    if (!(await confirm(`حذف هذه الفاتورة نهائياً من السجل؟\n\nهذا مختلف عن «الإلغاء» — الحذف يزيل الفاتورة تماماً ولا يمكن التراجع عنه، ولن تظهر بعدها في أي تقرير. استخدمه فقط لتصحيح خطأ إدخال حقيقي (كفاتورة مكرَّرة بالخطأ).${alreadyReversed ? "\n\nهذه الفاتورة ملغاة أصلاً وقد أُعيد أثرها، فلن يتغيّر المخزون أو الدَين." : `\n\nسيُعاد المخزون المخصوم، ويُخصم أي دين أو نقاط ولاء نتجت عنها.${reversalNote(inv)}`}`, { danger: true }))) return;
    applyReversal(inv, { setProducts, setCustomers });
    setInvoices(iv => iv.filter(i => i.id !== id));
    DB.flush("invoices");
    ctx.setAuditLog(al => [{ id: "AU-" + Date.now(), date: todayISO(), by: ctx.user?.name || "—", type: "حذف فاتورة", detail: `#${inv.id} — ${inv.customer} — ${fmt(inv.total)} ${cur}` }, ...al]);
    DB.flush("auditLog");
    ctx.showToast("تم حذف الفاتورة نهائياً");
    setDetail(null);
  };
  // الإرجاع يخفّض الفاتورة نفسها ويعيد المخزون ويصحّح حساب الزبون — انظر
  // utils/invoiceReturn.js. إبقاء الفاتورة مصدرَ قيمتها الصافية يُبقي كل
  // التقارير صحيحة بلا أن يطرح كل تقرير المرتجعات بنفسه
  const submitReturn = async () => {
    const inv = returnFor;
    const plan = computeReturn(inv, returnQtys, ctx.products);
    if (plan.refund <= 0) { ctx.showToast("حدّد كمية للإرجاع أولاً"); return; }
    const msg = plan.fullyReturned
      ? `إرجاع كل أصناف الفاتورة #${inv.id} بقيمة ${fmt(plan.refund)} ${cur}؟

ستُعتبر الفاتورة ملغاة بعدها.`
      : `إرجاع ${plan.lines.length} صنف من الفاتورة #${inv.id} بقيمة ${fmt(plan.refund)} ${cur}؟

سيُعاد المخزون ويُخفَّض إجمالي الفاتورة إلى ${fmt(plan.nextTotal)} ${cur}.`;
    if (!(await confirm(msg, { danger: true }))) return;

    if (Object.keys(plan.stock).length) {
      setProducts(ps => ps.map(p => (plan.stock[p.id] && p.stock !== null) ? { ...p, stock: p.stock + plan.stock[p.id] } : p));
    }
    if (plan.customer) {
      const adj = plan.customer;
      setCustomers(cs => cs.map(c => c.id === adj.id ? {
        ...c,
        debt: Math.max(0, (c.debt || 0) + adj.debtDelta),
        total: Math.max(0, (c.total || 0) + adj.totalDelta),
        points: Math.max(0, (c.points || 0) + adj.pointsDelta),
      } : c));
    }
    const updated = applyReturnToInvoice(inv, plan, { by: ctx.user?.name || "—", date: todayISO() });
    setInvoices(iv => iv.map(i => i.id === inv.id ? updated : i));
    ctx.setAuditLog(al => [{ id: "AU-" + Date.now(), date: todayISO(), by: ctx.user?.name || "—", type: "إرجاع أصناف", detail: `#${inv.id} — ${plan.lines.map(l => `${l.name} ×${l.qty}`).join("، ")} — ${fmt(plan.refund)} ${cur}` }, ...al]);
    DB.flush("invoices"); DB.flush("auditLog");
    ctx.showToast(`تم إرجاع ${fmt(plan.refund)} ${cur} من الفاتورة #${inv.id}`);
    setReturnFor(null); setReturnQtys({}); setDetail(updated);
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
        <KCard label="مبيعات الفترة المعروضة" value={fmt(shownSales)} sub={cur} bar="#1a8c3e" />
        <KCard label="عدد الفواتير" value={fmt(shown.length)} sub={`من ${fmt(invoices.length)} إجمالاً`} bar="#2a78d6" />
        <KCard label="متوسط الفاتورة" value={shownPaid.length ? fmt(Math.round(shownSales / shownPaid.length)) : 0} sub={cur} bar={C.gold} />
        <KCard label="إجمالي المرتجعات" value={fmt(totalReturned)} sub={`${cur} — ${allReturns.length} عملية`} bar={C.red} />
      </div>
      {Object.keys(payTotals).length > 0 && (
        <Card style={{ marginBottom: "1.1rem" }}>
          <CardHead title="توزيع طرق الدفع" sub="الفترة المعروضة — مهم لتسوية الصندوق اليومية" />
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {Object.entries(payTotals).map(([method, amount]) => (
              <div key={method} style={{ background: C.crm, borderRadius: 10, padding: ".55rem .9rem", minWidth: 120 }}>
                <div style={{ fontSize: 11, color: C.mt }}>{method}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.grn2 }}>{fmt(amount)} {cur}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
      <Card>
        <CardHead title="سجل الفواتير" sub={`الفواتير من الحجوزات تظهر بعلامة (حجز) — ${fmt(shown.length)} فاتورة مطابقة — اضغط أي صف لعرض التفاصيل`} right={
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <input value={q} onChange={e => { setQ(e.target.value); setPage(1); }} placeholder="بحث باسم زبون أو صنف أو رقم..." style={{ ...inputStyle, width: 210 }} />
            <Sel value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }} style={{ width: 110 }}>
              <option value="all">كل الحالات</option><option value="مدفوعة">مدفوعة</option><option value="معلقة">معلقة</option><option value="ملغاة">ملغاة</option>
            </Sel>
            <Sel value={payFilter} onChange={e => { setPayFilter(e.target.value); setPage(1); }} style={{ width: 110 }}>
              <option value="all">كل طرق الدفع</option><option value="كاش">كاش</option><option value="بطاقة">بطاقة</option><option value="تحويل">تحويل</option><option value="آجل">آجل</option><option value="موظف">موظف</option><option value="split">مقسَّم</option>
            </Sel>
            <Sel value={srcFilter} onChange={e => { setSrcFilter(e.target.value); setPage(1); }} style={{ width: 110 }}>
              <option value="all">كل المصادر</option>
              {Object.keys(SRC_TONE).map(s => <option key={s} value={s}>{s}</option>)}
            </Sel>
          </div>
        } />
        {/* شريط النطاق الزمني والتصدير — كان السجل بلا أي تحديد زمني: كل فواتير
            النظام مقسّمة على صفحات، فلا سبيل لسؤال «فواتير أمس» أو تسليم المحاسب ملفاً */}
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center", marginBottom: ".8rem", paddingBottom: ".8rem", borderBottom: `0.5px solid ${C.bc}` }}>
          <Sel value="" onChange={e => e.target.value && applyQuickRange(e.target.value)} style={{ width: 130 }}>
            <option value="">— نطاق سريع —</option>
            {QUICK_RANGES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </Sel>
          <input type="date" value={from} onChange={e => { setFrom(e.target.value); setPage(1); }} aria-label="من تاريخ" style={{ ...inputStyle, width: 145 }} />
          <input type="date" value={to} onChange={e => { setTo(e.target.value); setPage(1); }} aria-label="إلى تاريخ" style={{ ...inputStyle, width: 145 }} />
          {(from || to || q || filter !== "all" || payFilter !== "all" || srcFilter !== "all") && <Btn sm onClick={clearFilters}>✕ مسح الفلاتر</Btn>}
          <div style={{ flex: 1 }} />
          <Btn sm onClick={() => downloadCsv(exportSheet(), exportName())}>⬇ تصدير CSV</Btn>
          <Btn sm onClick={() => downloadExcel(exportSheet(), exportName())}>📊 تصدير Excel</Btn>
        </div>
        <Table cols={[
          { h: "رقم", w: "13%" }, { h: "الزبون", w: "15%" },
          { h: <span onClick={() => toggleSort("date")} style={{ cursor: "pointer", userSelect: "none" }} title="فرز حسب التاريخ">التاريخ{sortArrow("date")}</span>, w: "11%" },
          { h: "المصدر", w: "10%" }, { h: "التفاصيل", w: "15%" }, { h: "الدفع", w: "9%" },
          { h: <span onClick={() => toggleSort("total")} style={{ cursor: "pointer", userSelect: "none" }} title="فرز حسب الإجمالي">الإجمالي{sortArrow("total")}</span>, w: "11%" },
          { h: "الحالة", w: "11%" },
        ]}
          rows={pageRows.map(i => [
            <span onClick={() => setDetail(i)} style={{ cursor: "pointer", fontWeight: 600, color: C.blue }}>#{i.id}</span>,
            <span onClick={() => setDetail(i)} style={{ cursor: "pointer" }}>{i.customer}</span>,
            arDate(i.date),
            <Badge tone={SRC_TONE[i.source] || "b"}>{i.source}</Badge>,
            <span onClick={() => setDetail(i)} style={{ cursor: "pointer" }}>{i.details}</span>,
            <Badge tone={PAY_TONE[i.pay] || "g"}>{i.pay}</Badge>,
            fmt(i.total) + " " + cur,
            <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <Badge tone={statusTone(i)}>{statusLabel(i)}</Badge>
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

      {/* سجل مرتجعات موحَّد — يجمع مرتجعات كل الفواتير المعروضة بدل الاضطرار
          لفتح كل فاتورة على حدة لمعرفة ما أُرجِع منها */}
      {allReturns.length > 0 && (
        <Card style={{ marginTop: 11 }}>
          <CardHead title="↩ سجل المرتجعات" sub={`${allReturns.length} عملية — إجمالي ${fmt(totalReturned)} ${cur} ضمن النطاق المعروض`} />
          <Table cols={[{ h: "التاريخ", w: "14%" }, { h: "الفاتورة", w: "13%" }, { h: "الزبون", w: "18%" }, { h: "الأصناف", w: "38%" }, { h: "القيمة", w: "17%" }]}
            rows={allReturns.slice(0, 50).map(r => [
              arDate(r.date), <span onClick={() => setDetail(invoices.find(i => i.id === r.invId))} style={{ cursor: "pointer", color: C.blue, fontWeight: 600 }}>#{r.invId}</span>,
              r.customer, r.lines.map(l => `${l.name} ×${l.qty}`).join("، "), <span style={{ fontWeight: 700, color: C.red }}>-{fmt(r.amount)} {cur}</span>,
            ])} />
          {allReturns.length > 50 && <div style={{ fontSize: 11, color: C.mt, textAlign: "center", marginTop: 8 }}>يعرض أحدث 50 من {fmt(allReturns.length)} — ضيّق النطاق الزمني لرؤية البقية</div>}
        </Card>
      )}

      {/* نافذة تفاصيل الفاتورة */}
      {detail && (
        <Modal title={`فاتورة #${detail.id}`} onClose={() => setDetail(null)} width={560}>
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: C.mt }}>الزبون</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{detail.customer}</div>
                <button onClick={() => {
                  const cust = ctx.customers.find(c => detail.customerId != null ? c.id === detail.customerId : c.name === detail.customer);
                  if (!cust) { ctx.showToast("لا يوجد ملف زبون مسجَّل بهذا الاسم"); return; }
                  setCustDetail(cust);
                }} title="فتح ملف الزبون" style={{ background: "none", border: "none", cursor: "pointer", color: C.blue, fontSize: 13 }}>👤</button>
              </div>
            </div>
            <div><div style={{ fontSize: 11, color: C.mt }}>التاريخ</div><div style={{ fontSize: 14, fontWeight: 700 }}>{arDate(detail.date)}{detail.time ? " — " + detail.time : ""}</div></div>
            <div><div style={{ fontSize: 11, color: C.mt }}>الحالة</div><Badge tone={statusTone(detail)}>{statusLabel(detail)}</Badge></div>
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
            {Array.isArray(detail.payParts) && detail.payParts.map((pt, n) => (
              <div key={n} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}><span style={{ color: C.mt }}>— {pt.method}</span><span>{fmt(pt.amount)} {cur}</span></div>
            ))}
            {detail.discount && detail.discount !== "—" && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}><span style={{ color: C.mt }}>الخصم</span><span>{detail.discount}</span></div>}
            {detail.coupon && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}><span style={{ color: C.mt }}>الكوبون المستخدم</span><span style={{ fontFamily: "monospace", fontWeight: 700 }}>{detail.coupon}</span></div>}
            {detail.dueDate && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}><span style={{ color: C.mt }}>تاريخ الاستحقاق</span><span>{arDate(detail.dueDate)}</span></div>}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}><span style={{ color: C.mt }}>بواسطة</span><span>{detail.by || "—"}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 800, gridColumn: "1/-1", borderTop: `0.5px solid ${C.bc}`, paddingTop: 8, marginTop: 4 }}><span>الإجمالي</span><span style={{ color: C.grn2 }}>{fmt(detail.total)} {cur}</span></div>
          </div>

          {(detail.returns || []).length > 0 && (
            <div style={{ marginTop: 12, background: C.redbg, border: `0.5px solid ${C.red}44`, borderRadius: 10, padding: ".7rem .9rem" }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: C.red, marginBottom: 5 }}>↩ مرتجعات هذه الفاتورة</div>
              {detail.returns.map((r, n) => (
                <div key={n} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.k2, marginBottom: 3 }}>
                  <span>{arDate(r.date)} — {r.lines.map(l => `${l.name} ×${l.qty}`).join("، ")}</span>
                  <span style={{ fontWeight: 700 }}>-{fmt(r.amount)} {cur}</span>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
            <Btn gold onClick={() => printInvoice(detail)}>🖨 طباعة</Btn>
            {can("cancel") && detail.status !== "ملغاة" && (detail.items || []).length > 0 &&
              <Btn onClick={() => { setReturnFor(detail); setReturnQtys({}); }}>↩ إرجاع أصناف</Btn>}
            {can("cancel") && detail.status !== "ملغاة" && <Btn onClick={() => cancel(detail.id)}>✕ إلغاء الفاتورة</Btn>}
            {can("cancel") && <Btn danger onClick={() => deleteInvoice(detail.id)}>🗑 حذف نهائياً</Btn>}
          </div>
        </Modal>
      )}
      {/* نافذة الإرجاع الجزئي — تُعرض فوق تفاصيل الفاتورة */}
      {returnFor && (() => {
        const plan = computeReturn(returnFor, returnQtys, ctx.products);
        return (
          <Modal title={`إرجاع أصناف — فاتورة #${returnFor.id}`} onClose={() => { setReturnFor(null); setReturnQtys({}); }} width={520}>
            <div style={{ fontSize: 12, color: C.mt, marginBottom: 10 }}>حدّد الكمية المُرجَعة من كل صنف. المبلغ يُحسب بالتناسب مع سعر السطر بعد أي خصم.</div>
            {(returnFor.items || []).map((it, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8, padding: ".5rem 0", borderBottom: `0.5px solid ${C.bc}` }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600 }}>{it.name}</div>
                  <div style={{ fontSize: 11, color: C.mt }}>{it.qty} × {fmt((it.lineTotal || 0) / (it.qty || 1))} {cur}</div>
                </div>
                <input type="number" min="0" max={it.qty} value={returnQtys[idx] ?? ""} placeholder="0"
                  onChange={e => setReturnQtys(q => ({ ...q, [idx]: e.target.value }))}
                  aria-label={`الكمية المُرجَعة من ${it.name}`} style={{ ...inputStyle, width: 80, textAlign: "center" }} />
                <Btn sm onClick={() => setReturnQtys(q => ({ ...q, [idx]: it.qty }))}>الكل</Btn>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, background: C.crm, borderRadius: 10, padding: ".8rem 1rem" }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>قيمة الإرجاع</span>
              <span style={{ fontSize: 16, fontWeight: 800, color: plan.refund > 0 ? C.red : C.mt }}>{fmt(plan.refund)} {cur}</span>
            </div>
            {plan.refund > 0 && (
              <div style={{ fontSize: 11.5, color: C.mt, marginTop: 6 }}>
                {plan.fullyReturned ? "سيُرجَّع كل محتوى الفاتورة وتُصبح ملغاة." : `إجمالي الفاتورة بعد الإرجاع: ${fmt(plan.nextTotal)} ${cur}`}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <Btn danger onClick={submitReturn} style={{ flex: 1, justifyContent: "center" }}>↩ تأكيد الإرجاع</Btn>
              <Btn onClick={() => { setReturnFor(null); setReturnQtys({}); }} style={{ flex: 1, justifyContent: "center" }}>إلغاء</Btn>
            </div>
          </Modal>
        );
      })()}
      {custDetail && <CustomerDetail ctx={ctx} customer={custDetail} onClose={() => setCustDetail(null)} />}
    </>
  );
}
