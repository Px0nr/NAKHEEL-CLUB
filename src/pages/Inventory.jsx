import { useState } from "react";
import { C, fmt } from "../constants/theme.js";
import { CATS } from "../constants/seeds.js";
import { PageTop, Btn, KCard, Card, CardHead, Sel, Table, Badge, Modal, Field, Inp } from "../components/ui.jsx";
import { openPdfDoc } from "../components/pdfHook.js";
import WasteModal from "../components/WasteModal.jsx";
import { todayISO, arDate, daysBetween, matchesBarcodePartial } from "../utils/format.js";
import { rangePreset, QUICK_RANGES } from "../utils/analytics.js";
import { downloadCsv, downloadExcel } from "../utils/exportTable.js";

/* ============================ INVENTORY & SHORTAGE ============================ */
export default function Inventory({ ctx }) {
  const { products, setProducts, suppliers, waste, auditLog, user, showToast } = ctx;
  const cur = ctx.settings?.currency || "د.ل";
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all"); // all | low | out | ok
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState(null); // null | "stock" | "pct"
  const [sortDir, setSortDir] = useState("asc");
  const [modal, setModal] = useState(false);
  const [supplier, setSupplier] = useState("");
  const [orderLines, setOrderLines] = useState([]); // {prodId, qty}
  const [adjust, setAdjust] = useState(null); // product being adjusted
  const [adjustFrom, setAdjustFrom] = useState(0); // المخزون قبل التعديل — لتسجيله في سجل التدقيق عند الحفظ
  const [directQty, setDirectQty] = useState(""); // إدخال الكمية النهائية مباشرة بدل الضغط المتكرر على ±
  const [wasteItem, setWasteItem] = useState(null); // product being marked as damaged/wasted
  const wasteTotal30 = waste.filter(w => daysBetween(w.date, todayISO()) <= 30).reduce((s, w) => s + w.cost, 0);
  // فلترة/بحث/تصدير سجل الإتلاف — كان يعرض آخر 8 حركات فقط بلا أي بحث أو نطاق
  // تاريخ أو تصدير، خلافاً لبقية سجلات النظام (المبيعات، الحجوزات...)
  const [wq, setWq] = useState("");
  const [wFrom, setWFrom] = useState("");
  const [wTo, setWTo] = useState("");
  const wApplyQuickRange = (key) => { const r = rangePreset(key); setWFrom(r.from); setWTo(r.to); };
  const wasteShown = waste.filter(w => (!wq || w.name.includes(wq)) && (!wFrom || w.date >= wFrom) && (!wTo || w.date <= wTo));
  const wasteExportSheet = () => [{
    name: "سجل الإتلاف",
    thead: ["التاريخ", "الصنف", "الكمية", "السبب", "الخسارة", "بواسطة", "ملاحظة"],
    tbody: wasteShown.map(w => [arDate(w.date), w.name, w.qty, w.reason, Math.round(w.cost * 10) / 10, w.by, w.note || "—"]),
  }];

  // only stocked products (services have stock=null)
  const stocked = products.filter(p => p.stock !== null);
  const lowItems = stocked.filter(p => p.min && p.stock < p.min);
  const outItems = stocked.filter(p => p.stock === 0);
  const stockValue = stocked.reduce((s, p) => s + (p.buy || 0) * p.stock, 0);

  const statusOf = (p) => {
    if (p.stock === 0) return { label: "نفد", tone: "r", pct: 0 };
    if (p.min && p.stock < p.min) return { label: "منخفض", tone: "a", pct: Math.min(100, Math.round(p.stock / (p.min * 2) * 100)) };
    return { label: "متوفر", tone: "g", pct: Math.min(100, p.min ? Math.round(p.stock / (p.min * 2) * 100) : 100) };
  };

  const shown = stocked.filter(p => {
    if (!(p.name.includes(q) || matchesBarcodePartial(p, q))) return false;
    const st = statusOf(p);
    if (filter === "low") return st.tone === "a";
    if (filter === "out") return st.tone === "r";
    if (filter === "ok") return st.tone === "g";
    return true;
  });
  // فرز اختياري بالضغط على رأس عمود «المتوفر» أو «مستوى المخزون» — كان الترتيب
  // ثابتاً بترتيب الإدخال فلا طريقة لرؤية الأصناف الأكثر إلحاحاً أولاً بلا فلتر
  const sortVal = (p) => sortKey === "stock" ? p.stock : sortKey === "pct" ? statusOf(p).pct : 0;
  const sortedShown = sortKey ? [...shown].sort((a, b) => (sortVal(a) - sortVal(b)) * (sortDir === "asc" ? 1 : -1)) : shown;
  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };
  const sortArrow = (key) => sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : " ↕";
  const PAGE_SIZE = 50;
  const totalPages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pageRows = sortedShown.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);
  // تصدير جرد المخزون بالكامل (النطاق المفلتَر) — لم يكن لهذا الجدول أي تصدير
  // خلافاً لبقية سجلات النظام
  const inventoryExportSheet = () => [{
    name: "جرد المخزون",
    thead: ["الباركود", "الصنف", "القسم", "المتوفر", "الحد الأدنى", "الحالة"],
    tbody: shown.map(p => [p.bc, p.name, CATS[p.cat] || p.cat, p.stock, p.min || "—", statusOf(p).label]),
  }];

  // stock adjustment (manual receive/correct)
  const applyAdjust = (delta) => {
    setProducts(ps => ps.map(p => p.id === adjust.id ? { ...p, stock: Math.max(0, p.stock + delta) } : p));
    setAdjust(a => ({ ...a, stock: Math.max(0, a.stock + delta) }));
  };
  // تعيين الكمية إلى رقم مطلق مباشرة — بديل أسرع من تكرار ±10 لشحنة كبيرة
  const setAbsolute = (val) => {
    const v = Math.max(0, val);
    setProducts(ps => ps.map(p => p.id === adjust.id ? { ...p, stock: v } : p));
    setAdjust(a => ({ ...a, stock: v }));
  };

  /* ---- shortage order builder ---- */
  const openShortageForm = () => {
    // auto-fill with low/out items, suggested qty = (min*2 - stock)
    const suggestions = lowItems.map(p => ({ prodId: p.id, qty: Math.max(1, (p.min * 2) - p.stock) }));
    setOrderLines(suggestions.length ? suggestions : []);
    // preselect supplier of first low item if available
    const firstSup = lowItems.find(p => p.supplier)?.supplier || "";
    setSupplier(firstSup);
    setModal(true);
  };
  const addOrderLine = () => setOrderLines(l => [...l, { prodId: "", qty: 1 }]);
  const setOrderLine = (i, k, v) => setOrderLines(l => l.map((ln, idx) => idx === i ? { ...ln, [k]: v } : ln));
  const delOrderLine = (i) => setOrderLines(l => l.filter((_, idx) => idx !== i));

  const supplierObj = suppliers.find(s => s.name === supplier);
  // تكلفة تقديرية لفاتورة النواقص قبل إرسالها — كانت الفاتورة تُبنى وتُرسل بلا
  // أي فكرة عن حجم الالتزام المالي حتى فتح المستند نفسه
  const orderEstCost = orderLines.reduce((s, l) => {
    const p = products.find(x => x.id == l.prodId);
    return s + (p?.buy || 0) * (parseInt(l.qty) || 0);
  }, 0);

  const sendWhatsApp = () => {
    const valid = orderLines.filter(l => l.prodId && l.qty > 0);
    if (!valid.length) { showToast("أضف صنفاً واحداً على الأقل للطلب"); return; }
    if (!supplier) { showToast("اختر المورد المستلم للطلب"); return; }
    // توليد فاتورة النواقص PDF — يفتحها المستخدم ويشاركها بنفسه عبر واتساب
    const docNo = "SHORT-" + Date.now().toString().slice(-6);
    openPdfDoc(ctx.settings, {
      title: "فاتورة نواقص — طلب توريد",
      recipientLabel: "المورد", recipientName: supplier, recipientPhone: supplierObj?.phone,
      docNo,
      columns: ["#", "الصنف", "الباركود", "الكمية المطلوبة", "الوحدة", "المتوفر حالياً"],
      rows: valid.map((l, i) => {
        const p = products.find(x => x.id == l.prodId);
        return [i + 1, p?.name || "—", p?.bc || "—", l.qty, p?.unit || "قطعة", (p?.stock ?? "—") + " قطعة"];
      }),
      totals: [["إجمالي الأصناف المطلوبة", valid.length + " صنف"]],
      note: "يرجى تأكيد التوفر والأسعار وموعد التسليم. هذا الطلب مُولّد آلياً حسب نواقص المخزون.",
    });
    showToast("فُتحت فاتورة النواقص — احفظها كـ PDF ثم شاركها عبر واتساب المورد");
    setModal(false);
  };

  return (
    <>
      <PageTop title="المخزون والنواقص" action={
        <Btn gold onClick={openShortageForm}><span style={{ fontSize: 14 }}>🟢</span> إنشاء فاتورة نواقص</Btn>
      } />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 11, marginBottom: "1.1rem" }}>
        <KCard label="أصناف بالمخزون" value={stocked.length} sub="صنف قابل للجرد" bar={C.grl} />
        <KCard label="منخفض المخزون" value={lowItems.length} sub="تحت الحد الأدنى" bar={C.gold} />
        <KCard label="نفد كلياً" value={outItems.length} sub="بحاجة طلب عاجل" bar={C.red} />
        <KCard label="قيمة المخزون" value={fmt(stockValue)} sub="دينار ليبي" bar="#2a78d6" />
        <KCard label="خسائر الإتلاف" value={fmt(wasteTotal30)} sub="آخر 30 يوم" bar={C.red} />
      </div>

      {(lowItems.length > 0) && (
        <div style={{ background: "linear-gradient(135deg,#fff7eb,#fff)", border: `1px solid ${C.gold}`, borderRadius: 12, padding: ".8rem 1rem", marginBottom: "1rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div style={{ fontSize: 12.5, color: C.gdd }}>⚠️ يوجد <b>{lowItems.length}</b> صنف تحت الحد الأدنى{outItems.length ? `، منها ${outItems.length} نفد كلياً` : ""}. يمكنك إنشاء فاتورة نواقص وإرسالها للمورد عبر واتساب مباشرة.</div>
          <Btn gold sm onClick={openShortageForm}>مراجعة النواقص →</Btn>
        </div>
      )}

      <Card>
        <CardHead
          title="جرد المخزون"
          sub="ابحث بالاسم أو الباركود للتأكد من الكمية المتوفرة"
          right={
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, background: C.crm, border: `0.5px solid ${C.bc}`, borderRadius: 8, padding: ".3rem .7rem", width: 220 }}>
                <span style={{ color: C.mt, fontSize: 14 }}>🔍</span>
                <input value={q} onChange={e => { setQ(e.target.value); setPage(1); }} placeholder="ابحث عن صنف أو باركود..." style={{ border: "none", outline: "none", background: "transparent", fontSize: 12.5, width: "100%", fontFamily: "inherit" }} />
              </div>
              <Sel value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }} style={{ width: 130 }}>
                <option value="all">كل الأصناف</option>
                <option value="ok">متوفر</option>
                <option value="low">منخفض</option>
                <option value="out">نفد</option>
              </Sel>
              <Btn sm onClick={() => downloadCsv(inventoryExportSheet(), `جرد-المخزون-${todayISO()}`)}>⬇ CSV</Btn>
              <Btn sm onClick={() => downloadExcel(inventoryExportSheet(), `جرد-المخزون-${todayISO()}`)}>📊 Excel</Btn>
            </div>
          }
        />
        {shown.length === 0 ? (
          <div style={{ textAlign: "center", color: C.mt, fontSize: 12.5, padding: "1.5rem 0" }}>لا توجد أصناف مطابقة للبحث.</div>
        ) : (
          <>
            <Table
              cols={[
                { h: "الباركود", w: "13%" }, { h: "الصنف", w: "20%" }, { h: "القسم", w: "10%" },
                { h: <span onClick={() => toggleSort("stock")} style={{ cursor: "pointer", userSelect: "none" }} title="فرز حسب الكمية المتوفرة">المتوفر{sortArrow("stock")}</span>, w: "10%" },
                { h: "الحد الأدنى", w: "10%" },
                { h: <span onClick={() => toggleSort("pct")} style={{ cursor: "pointer", userSelect: "none" }} title="فرز حسب مستوى المخزون">مستوى المخزون{sortArrow("pct")}</span>, w: "19%" },
                { h: "الحالة", w: "10%" }, { h: "إجراء", w: "8%" },
              ]}
              rows={pageRows.map(p => {
                const st = statusOf(p);
                return [
                  <span style={{ fontFamily: "monospace", fontSize: 11, background: C.crm, padding: "2px 6px", borderRadius: 5 }}>{p.bc}</span>,
                  <span style={{ fontWeight: 600 }}>{p.name}</span>,
                  <Badge tone={p.cat === "games" ? "g" : "a"}>{CATS[p.cat]}</Badge>,
                  <span style={{ fontWeight: 700, color: st.tone === "r" ? C.red : st.tone === "a" ? C.gdd : C.grn2 }}>{p.stock} {p.unit}</span>,
                  p.min || "—",
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ flex: 1, height: 6, borderRadius: 3, background: "#eee", overflow: "hidden" }}><div style={{ width: st.pct + "%", height: "100%", background: st.tone === "r" ? "#e34948" : st.tone === "a" ? C.gold : C.grl }} /></div>
                    <span style={{ fontSize: 10, color: C.mt, minWidth: 28 }}>{st.pct}%</span>
                  </div>,
                  <Badge tone={st.tone}>{st.label}</Badge>,
                  <div style={{ display: "flex", gap: 4 }}><Btn sm onClick={() => { setAdjust(p); setAdjustFrom(p.stock); setDirectQty(String(p.stock)); }}>تعديل</Btn><Btn sm danger onClick={() => setWasteItem(p)}>🗑 إتلاف</Btn></div>,
                ];
              })}
            />
            {totalPages > 1 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 12, paddingTop: 10, borderTop: `0.5px solid ${C.bc}` }}>
                <Btn sm onClick={() => setPage(p => Math.max(1, p - 1))} style={{ opacity: pageSafe === 1 ? .4 : 1 }}>‹ السابق</Btn>
                <span style={{ fontSize: 12, color: C.mt }}>صفحة {pageSafe} من {totalPages}</span>
                <Btn sm onClick={() => setPage(p => Math.min(totalPages, p + 1))} style={{ opacity: pageSafe === totalPages ? .4 : 1 }}>التالي ›</Btn>
              </div>
            )}
          </>
        )}
      </Card>

      {/* stock adjust modal */}
      {adjust && (
        <Modal title={`تعديل مخزون — ${adjust.name}`} onClose={() => setAdjust(null)} width={400}>
          <div style={{ fontSize: 11.5, color: C.mt, marginBottom: 10, background: C.crm, borderRadius: 8, padding: ".5rem .75rem", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
            <span>آخر سعر شراء: <b style={{ color: C.k2 }}>{adjust.buy ? fmt(adjust.buy) + " " + cur : "—"}</b></span>
            <span>المورد الافتراضي: <b style={{ color: C.k2 }}>{adjust.supplier || "—"}</b></span>
          </div>
          <div style={{ textAlign: "center", padding: ".5rem 0 1rem" }}>
            <div style={{ fontSize: 11, color: C.mt, marginBottom: 4 }}>الكمية المتوفرة حالياً</div>
            <div style={{ fontSize: 34, fontWeight: 700, color: C.grn2 }}>{adjust.stock}</div>
            <div style={{ fontSize: 11, color: C.mt }}>{adjust.unit}</div>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: "1rem" }}>
            <Btn onClick={() => { applyAdjust(-1); setDirectQty(String(Math.max(0, adjust.stock - 1))); }}>− 1</Btn>
            <Btn onClick={() => { applyAdjust(-10); setDirectQty(String(Math.max(0, adjust.stock - 10))); }}>− 10</Btn>
            <Btn onClick={() => { applyAdjust(10); setDirectQty(String(adjust.stock + 10)); }}>+ 10</Btn>
            <Btn onClick={() => { applyAdjust(1); setDirectQty(String(adjust.stock + 1)); }}>+ 1</Btn>
          </div>
          {/* إدخال مباشر للكمية النهائية — الشحنات الكبيرة كانت تحتاج عشرات
              الضغطات على ±10 بلا أي طريقة لكتابة الرقم مباشرة */}
          <div style={{ display: "flex", gap: 7, alignItems: "flex-end", marginBottom: "1rem" }}>
            <div style={{ flex: 1 }}><Field label={`تعيين الكمية مباشرة (${adjust.unit})`}><Inp type="number" min="0" value={directQty} onChange={e => setDirectQty(e.target.value)} /></Field></div>
            <Btn onClick={() => setAbsolute(parseInt(directQty) || 0)}>تعيين</Btn>
          </div>
          {(() => {
            const history = auditLog.filter(a => a.type === "تعديل مخزون يدوي" && a.detail.startsWith(adjust.name + ":")).slice(0, 5);
            return history.length > 0 && (
              <div style={{ marginBottom: "1rem" }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: C.mt, marginBottom: 5 }}>آخر تعديلات هذا الصنف</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {history.map(a => (
                    <div key={a.id} style={{ fontSize: 10.5, color: C.mt, background: C.crm, borderRadius: 6, padding: ".3rem .6rem", display: "flex", justifyContent: "space-between", gap: 6 }}>
                      <span>{a.detail.split(": ")[1]}</span><span>{arDate(a.date)} · {a.by}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
          <Btn gold onClick={() => {
            if (adjust.stock !== adjustFrom) {
              ctx.setAuditLog(al => [{ id: "AU-" + Date.now(), date: todayISO(), by: user?.name || "—", type: "تعديل مخزون يدوي", detail: `${adjust.name}: ${adjustFrom} ← ${adjust.stock} ${adjust.unit}` }, ...al]);
            }
            showToast("تم تحديث المخزون"); setAdjust(null);
          }} style={{ width: "100%", justifyContent: "center" }}>✓ حفظ التعديل</Btn>
        </Modal>
      )}

      {/* damage / waste modal */}
      {wasteItem && <WasteModal product={wasteItem} onClose={() => setWasteItem(null)} ctx={ctx} cur={cur} />}

      {/* سجل الإتلاف — بحث بالاسم ونطاق تاريخ وتصدير، بدل عرض ثابت لآخر 8 حركات فقط */}
      {waste.length > 0 && (
        <Card style={{ marginTop: "1rem" }}>
          <CardHead title="🗑 سجل الإتلاف" sub={`${fmt(wasteShown.length)} من ${fmt(waste.length)} — إجمالي خسائر النطاق: ${fmt(wasteShown.reduce((s, w) => s + w.cost, 0))} ${cur}`} right={
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, background: C.crm, border: `0.5px solid ${C.bc}`, borderRadius: 8, padding: ".3rem .7rem", width: 160 }}>
                <span style={{ color: C.mt, fontSize: 14 }}>🔍</span>
                <input value={wq} onChange={e => setWq(e.target.value)} placeholder="ابحث عن صنف..." style={{ border: "none", outline: "none", background: "transparent", fontSize: 12.5, width: "100%", fontFamily: "inherit" }} />
              </div>
              <Sel value="" onChange={e => e.target.value && wApplyQuickRange(e.target.value)} style={{ width: 120 }}>
                <option value="">— نطاق سريع —</option>
                {QUICK_RANGES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </Sel>
              <Inp type="date" value={wFrom} onChange={e => setWFrom(e.target.value)} aria-label="من تاريخ" style={{ width: 135 }} />
              <Inp type="date" value={wTo} onChange={e => setWTo(e.target.value)} aria-label="إلى تاريخ" style={{ width: 135 }} />
              <Btn sm onClick={() => downloadCsv(wasteExportSheet(), `سجل-الإتلاف-${todayISO()}`)}>⬇ CSV</Btn>
              <Btn sm onClick={() => downloadExcel(wasteExportSheet(), `سجل-الإتلاف-${todayISO()}`)}>📊 Excel</Btn>
            </div>
          } />
          {wasteShown.length === 0 ? <div style={{ color: C.mt, fontSize: 12, padding: "1rem 0", textAlign: "center" }}>لا توجد حركات إتلاف ضمن هذا النطاق</div> : <>
            <Table cols={[{ h: "التاريخ", w: "13%" }, { h: "الصنف", w: "22%" }, { h: "الكمية", w: "10%" }, { h: "السبب", w: "18%" }, { h: "الخسارة", w: "13%" }, { h: "بواسطة", w: "12%" }, { h: "ملاحظة", w: "12%" }]}
              rows={wasteShown.slice(0, 100).map(w => [arDate(w.date), w.name, w.qty, w.reason, fmt(w.cost) + " " + cur, w.by, w.note || "—"])} />
            {wasteShown.length > 100 && <div style={{ fontSize: 11, color: C.mt, textAlign: "center", marginTop: 8 }}>يعرض أحدث 100 من {fmt(wasteShown.length)} — ضيّق النطاق الزمني أو صدِّر الكل</div>}
          </>}
        </Card>
      )}

      {/* shortage order modal */}
      {modal && (
        <Modal title="فاتورة نواقص — طلب من المورد" onClose={() => setModal(false)} width={580}>
          <Field label="المورد (للإرسال عبر واتساب)">
            <Sel value={supplier} onChange={e => setSupplier(e.target.value)}>
              <option value="">اختر المورد...</option>
              {suppliers.map(s => <option key={s.id} value={s.name}>{s.name}{s.wa ? "" : " (لا يوجد واتساب)"}</option>)}
            </Sel>
          </Field>
          {supplierObj && supplierObj.wa && (
            <div style={{ fontSize: 11.5, color: "#1a8c3e", marginBottom: 10, display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ fontSize: 14 }}>🟢</span> سيُرسَل الطلب إلى واتساب: {supplierObj.phone}
            </div>
          )}

          <div style={{ fontSize: 11, fontWeight: 700, color: C.mt, margin: ".3rem 0 .5rem" }}>الأصناف المطلوبة (تم اقتراح النواقص تلقائياً)</div>
          {orderLines.length === 0 && <div style={{ fontSize: 12, color: C.mt, padding: ".5rem 0" }}>لا توجد نواقص حالياً — أضف أصنافاً يدوياً إن رغبت.</div>}
          {orderLines.map((ln, i) => {
            const p = products.find(x => x.id == ln.prodId);
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6, background: C.crm, borderRadius: 8, padding: ".45rem .7rem" }}>
                <Sel value={ln.prodId} onChange={e => setOrderLine(i, "prodId", e.target.value)} style={{ flex: 2.5, background: C.cd }}>
                  <option value="">اختر الصنف...</option>
                  {stocked.map(pr => <option key={pr.id} value={pr.id}>{pr.name} (متوفر: {pr.stock})</option>)}
                </Sel>
                <Inp type="number" value={ln.qty} onChange={e => setOrderLine(i, "qty", parseInt(e.target.value) || 1)} style={{ width: 70, background: C.cd }} />
                <span style={{ fontSize: 11, color: C.mt, minWidth: 34 }}>{p?.unit || ""}</span>
                <button onClick={() => delOrderLine(i)} aria-label="إزالة الصنف" style={{ background: "none", border: "none", cursor: "pointer", color: C.mt, fontSize: 15 }}>✕</button>
              </div>
            );
          })}
          <Btn sm onClick={addOrderLine} style={{ marginTop: 5 }}>+ إضافة صنف</Btn>

          {/* تكلفة تقديرية إجمالية — حسب آخر سعر شراء مسجَّل لكل صنف، قبل إرسال
              الطلب كي يعرف المدير حجم الالتزام المالي مسبقاً */}
          {orderLines.filter(l => l.prodId).length > 0 && (
            <div style={{ background: "rgba(26,140,62,.07)", border: "0.5px solid rgba(26,140,62,.22)", borderRadius: 9, padding: ".65rem .85rem", margin: ".8rem 0 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: C.mt, fontWeight: 600 }}>التكلفة التقديرية (حسب آخر سعر شراء)</span>
              <span style={{ fontSize: 17, fontWeight: 800, color: C.grn2 }}>{fmt(orderEstCost)} {cur}</span>
            </div>
          )}

          {/* PDF flow explanation */}
          {orderLines.filter(l => l.prodId).length > 0 && (
            <div style={{ marginTop: "1rem", background: C.bluebg, border: `0.5px solid ${C.blue}33`, borderRadius: 10, padding: ".7rem .85rem", fontSize: 11.5, color: C.blue, lineHeight: 1.8 }}>
              📄 عند الضغط على الزر تُفتح فاتورة النواقص مباشرة كمستند رسمي: اضغط <b>«💾 حفظ كـ PDF»</b> داخل المستند، ثم شارك الملف المحفوظ عبر واتساب المورد 📎 من جهازك.
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: "1rem" }}>
            <button onClick={sendWhatsApp} style={{ flex: 1, justifyContent: "center", display: "inline-flex", alignItems: "center", gap: 7, padding: ".55rem", borderRadius: 10, background: "#25D366", color: "#fff", border: "none", fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              <span style={{ fontSize: 16 }}>📄</span> فتح فاتورة النواقص PDF
            </button>
            <Btn onClick={() => setModal(false)}>إغلاق</Btn>
          </div>
        </Modal>
      )}
    </>
  );
}
