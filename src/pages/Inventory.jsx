import { useState } from "react";
import { C, fmt } from "../constants/theme.js";
import { CATS } from "../constants/seeds.js";
import { PageTop, Btn, KCard, Card, CardHead, Sel, Table, Badge, Modal, Field, Inp } from "../components/ui.jsx";
import { openPdfDoc } from "../components/pdfHook.js";
import WasteModal from "../components/WasteModal.jsx";
import { todayISO, arDate, daysBetween, matchesBarcodePartial } from "../utils/format.js";

/* ============================ INVENTORY & SHORTAGE ============================ */
export default function Inventory({ ctx }) {
  const { products, setProducts, suppliers, waste, user, showToast } = ctx;
  const cur = ctx.settings?.currency || "د.ل";
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all"); // all | low | out | ok
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(false);
  const [supplier, setSupplier] = useState("");
  const [orderLines, setOrderLines] = useState([]); // {prodId, qty}
  const [adjust, setAdjust] = useState(null); // product being adjusted
  const [adjustFrom, setAdjustFrom] = useState(0); // المخزون قبل التعديل — لتسجيله في سجل التدقيق عند الحفظ
  const [wasteItem, setWasteItem] = useState(null); // product being marked as damaged/wasted
  const wasteTotal30 = waste.filter(w => daysBetween(w.date, todayISO()) <= 30).reduce((s, w) => s + w.cost, 0);

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
  const PAGE_SIZE = 50;
  const totalPages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pageRows = shown.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  // stock adjustment (manual receive/correct)
  const applyAdjust = (delta) => {
    setProducts(ps => ps.map(p => p.id === adjust.id ? { ...p, stock: Math.max(0, p.stock + delta) } : p));
    setAdjust(a => ({ ...a, stock: Math.max(0, a.stock + delta) }));
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
            </div>
          }
        />
        {shown.length === 0 ? (
          <div style={{ textAlign: "center", color: C.mt, fontSize: 12.5, padding: "1.5rem 0" }}>لا توجد أصناف مطابقة للبحث.</div>
        ) : (
          <>
            <Table
              cols={[{ h: "الباركود", w: "13%" }, { h: "الصنف", w: "20%" }, { h: "القسم", w: "10%" }, { h: "المتوفر", w: "10%" }, { h: "الحد الأدنى", w: "10%" }, { h: "مستوى المخزون", w: "19%" }, { h: "الحالة", w: "10%" }, { h: "إجراء", w: "8%" }]}
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
                  <div style={{ display: "flex", gap: 4 }}><Btn sm onClick={() => { setAdjust(p); setAdjustFrom(p.stock); }}>تعديل</Btn><Btn sm danger onClick={() => setWasteItem(p)}>🗑 إتلاف</Btn></div>,
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
          <div style={{ textAlign: "center", padding: ".5rem 0 1rem" }}>
            <div style={{ fontSize: 11, color: C.mt, marginBottom: 4 }}>الكمية المتوفرة حالياً</div>
            <div style={{ fontSize: 34, fontWeight: 700, color: C.grn2 }}>{adjust.stock}</div>
            <div style={{ fontSize: 11, color: C.mt }}>{adjust.unit}</div>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: "1rem" }}>
            <Btn onClick={() => applyAdjust(-1)}>− 1</Btn>
            <Btn onClick={() => applyAdjust(-10)}>− 10</Btn>
            <Btn onClick={() => applyAdjust(10)}>+ 10</Btn>
            <Btn onClick={() => applyAdjust(1)}>+ 1</Btn>
          </div>
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

      {/* سجل الإتلاف الأخير */}
      {waste.length > 0 && (
        <Card style={{ marginTop: "1rem" }}>
          <CardHead title="🗑 سجل الإتلاف الأخير" sub={`إجمالي الخسائر: ${fmt(waste.reduce((s, w) => s + w.cost, 0))} ${cur}`} />
          <Table cols={[{ h: "التاريخ", w: "13%" }, { h: "الصنف", w: "22%" }, { h: "الكمية", w: "10%" }, { h: "السبب", w: "18%" }, { h: "الخسارة", w: "13%" }, { h: "بواسطة", w: "12%" }, { h: "ملاحظة", w: "12%" }]}
            rows={waste.slice(0, 8).map(w => [arDate(w.date), w.name, w.qty, w.reason, fmt(w.cost) + " " + cur, w.by, w.note || "—"])} />
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
