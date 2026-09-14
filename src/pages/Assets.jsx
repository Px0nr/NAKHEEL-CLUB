import { useState } from "react";
import { C, fmt } from "../constants/theme.js";
import { ASSET_STATUS } from "../constants/seeds.js";
import { PageTop, Btn, KCard, Card, CardHead, Sel, inputStyle, Badge, Modal, Field, Inp } from "../components/ui.jsx";
import QuickAddSupplierModal from "../components/QuickAddSupplierModal.jsx";
import { todayISO, arDate, daysBetween } from "../utils/format.js";
import { downloadCsv, downloadExcel } from "../utils/exportTable.js";
import { normalizeAsset, activeQtyOf } from "../utils/assetsHelpers.js";

const actBtn = (color) => ({ background: color + "18", border: "none", borderRadius: 6, color, fontSize: 12, fontWeight: 700, padding: "4px 8px", cursor: "pointer", fontFamily: "inherit" });

const emptyForm = { name: "", cat: "أجهزة ألعاب", qty: 1, addedAt: todayISO(), supplier: "", cost: "", pay: "نقداً" };
const PAGE_SIZE = 20;

/* ============================ ASSETS (موارد النادي) ============================ */
export default function Assets({ ctx }) {
  const { assets, setAssets, setExpenses, suppliers, user, showToast, confirm } = ctx;
  const cur = ctx.settings?.currency || "د.ل";
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState("addedAt");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null); // مورد قيد التعديل — null يعني إضافة جديد
  const [supModal, setSupModal] = useState(false);
  const [actionAsset, setActionAsset] = useState(null); // { asset, type, maxQty }
  const [detail, setDetail] = useState(null);

  const [f, setF] = useState(emptyForm);
  const [act, setAct] = useState({ date: todayISO(), note: "", cost: "", qty: 1, pay: "نقداً" });

  const CATS_A = ["أجهزة ألعاب", "معدات رياضية", "أثاث", "إلكترونيات", "أخرى"];

  const list = assets.map(normalizeAsset);

  const counts = {
    all: list.length,
    active: list.reduce((s, a) => s + activeQtyOf(a), 0),
    maintenance: list.reduce((s, a) => s + (a.maintQty || 0), 0),
    damaged: list.reduce((s, a) => s + (a.damagedQty || 0), 0),
    lost: list.reduce((s, a) => s + (a.lostQty || 0), 0),
    retired: list.reduce((s, a) => s + (a.retiredQty || 0), 0),
  };
  const totalValue = list.reduce((s, a) => s + (a.cost || 0) * (activeQtyOf(a) + (a.maintQty || 0)), 0);

  const openAdd = () => { setEditing(null); setF(emptyForm); setModal(true); };
  const openEdit = (a) => {
    setEditing(a);
    setF({ name: a.name, cat: a.cat, qty: String(a.qty), addedAt: a.addedAt, supplier: a.supplier || "", cost: a.cost ? String(a.cost) : "", pay: a.pay || "نقداً" });
    setModal(true);
  };

  const save = () => {
    if (!f.name.trim()) { showToast("أدخل اسم المورد"); return; }
    const qty = Math.max(1, parseInt(f.qty) || 1);
    const cost = parseFloat(f.cost) || 0;
    if (editing) {
      const allocated = (editing.maintQty || 0) + (editing.damagedQty || 0) + (editing.lostQty || 0) + (editing.retiredQty || 0);
      if (qty < allocated) { showToast(`لا يمكن تقليل العدد إلى ${qty} — ${allocated} وحدة مخصّصة بالفعل بين الصيانة/التالف/المفقود/المستبعد`); return; }
      setAssets(list => list.map(a => a.id === editing.id ? { ...a, name: f.name.trim(), cat: f.cat, qty, addedAt: f.addedAt, supplier: f.supplier, cost, pay: f.pay } : a));
      showToast("تم تحديث بيانات المورد");
    } else {
      setAssets(a => [...a, { id: "a" + Date.now(), name: f.name.trim(), cat: f.cat, qty, addedAt: f.addedAt, supplier: f.supplier, cost, pay: f.pay, maintQty: 0, damagedQty: 0, lostQty: 0, retiredQty: 0, history: [] }]);
      // ربط تكلفة الشراء بالمصاريف/الخزينة فعلياً — كانت تُسجَّل كرقم داخل سجل
      // المورد فقط بلا أي أثر على النقد المتاح في تقارير الخزينة
      if (cost > 0) {
        setExpenses(ex => [{
          id: Math.max(0, ...ex.map(x => x.id)) + 1, date: f.addedAt, cat: "شراء موارد",
          desc: `شراء مورد: ${f.name.trim()}${qty > 1 ? ` (×${qty})` : ""}`,
          amount: cost * qty, pay: f.pay, empId: null, empName: null, dept: null,
          supplierId: null, supplierName: f.supplier || null, by: (user?.name || "—").split(" ")[0], recurring: false,
        }, ...ex]);
      }
      showToast("تمت إضافة المورد للنادي" + (cost > 0 ? " وتسجيل تكلفته في المصاريف" : ""));
    }
    setModal(false); setEditing(null); setF(emptyForm);
  };

  const deleteAsset = async (a) => {
    if (!(await confirm(`حذف مورد «${a.name}» نهائياً؟ سيُحذف سجل تاريخه بالكامل ولن يمكن التراجع.`, { danger: true }))) return;
    setAssets(list => list.filter(x => x.id !== a.id));
    showToast("تم حذف المورد");
  };

  const openAction = (asset, type) => {
    const maxQty = type === "returnMaint" ? (asset.maintQty || 0)
      : type === "restoreDamaged" ? (asset.damagedQty || 0)
        : type === "restoreLost" ? (asset.lostQty || 0)
          : activeQtyOf(asset);
    setActionAsset({ asset, type, maxQty });
    setAct({ date: todayISO(), note: "", cost: "", qty: Math.min(1, maxQty) || 1, pay: "نقداً" });
  };

  // تنفيذ إجراء على كمية جزئية من المورد (لا على السطر بأكمله)
  const applyAction = () => {
    const { asset, type, maxQty } = actionAsset;
    const qty = Math.max(1, Math.min(maxQty, parseInt(act.qty) || 1));
    const doneBy = user?.name || "—";
    setAssets(list => list.map(a => {
      if (a.id !== asset.id) return a;
      const hist = [...(a.history || [])];
      if (type === "maintenance") { hist.push({ event: `إرسال ${qty} للصيانة`, qty, date: act.date, note: act.note || "—", by: doneBy }); return { ...a, maintQty: (a.maintQty || 0) + qty, history: hist }; }
      if (type === "returnMaint") { hist.push({ event: `عودة ${qty} من الصيانة`, qty, date: act.date, from: a.maintStart, note: act.note || "تم الإصلاح", cost: parseFloat(act.cost) || 0, by: doneBy }); return { ...a, maintQty: Math.max(0, (a.maintQty || 0) - qty), history: hist }; }
      if (type === "damaged") { hist.push({ event: `تسجيل ${qty} كتالف`, qty, date: act.date, note: act.note || "—", by: doneBy }); return { ...a, damagedQty: (a.damagedQty || 0) + qty, history: hist }; }
      if (type === "lost") { hist.push({ event: `تسجيل ${qty} كمفقود`, qty, date: act.date, note: act.note || "—", by: doneBy }); return { ...a, lostQty: (a.lostQty || 0) + qty, history: hist }; }
      if (type === "restoreDamaged") { hist.push({ event: `استعادة ${qty} من التلف`, qty, date: act.date, note: act.note || "—", by: doneBy }); return { ...a, damagedQty: Math.max(0, (a.damagedQty || 0) - qty), history: hist }; }
      if (type === "restoreLost") { hist.push({ event: `استعادة ${qty} من الفقد`, qty, date: act.date, note: act.note || "—", by: doneBy }); return { ...a, lostQty: Math.max(0, (a.lostQty || 0) - qty), history: hist }; }
      if (type === "retire") { hist.push({ event: `استبعاد ${qty} (بيع/تصرف)`, qty, date: act.date, note: act.note || "—", by: doneBy }); return { ...a, retiredQty: (a.retiredQty || 0) + qty, history: hist }; }
      return a;
    }));
    // ربط تكلفة الإصلاح بالمصاريف فعلياً — كانت تُسجَّل فقط داخل سجل المورد بلا أي أثر في الخزينة
    if (type === "returnMaint") {
      const repairCost = parseFloat(act.cost) || 0;
      if (repairCost > 0) {
        setExpenses(ex => [{
          id: Math.max(0, ...ex.map(x => x.id)) + 1, date: act.date, cat: "صيانة",
          desc: `صيانة ${asset.name}${act.note ? " — " + act.note : ""}`,
          amount: repairCost, pay: act.pay, empId: null, empName: null, dept: null,
          supplierId: null, supplierName: null, by: doneBy.split(" ")[0], recurring: false,
        }, ...ex]);
      }
    }
    const labels = { maintenance: "أُرسل للصيانة", returnMaint: "عاد من الصيانة", damaged: "سُجّل كتالف", lost: "سُجّل كمفقود", restoreDamaged: "استُعيد من التلف", restoreLost: "استُعيد من الفقد", retire: "استُبعد" };
    showToast(`${asset.name}: ${qty} وحدة — ${labels[type]}`);
    setActionAsset(null); setAct({ date: todayISO(), note: "", cost: "", qty: 1, pay: "نقداً" });
  };

  const actionTitle = (type) => ({ maintenance: "إرسال للصيانة", returnMaint: "إرجاع من الصيانة", damaged: "تسجيل كتالف", lost: "تسجيل كمفقود", restoreDamaged: "استعادة من التلف", restoreLost: "استعادة من الفقد", retire: "استبعاد (بيع/تصرف نهائي)" }[type]);

  const matchesFilter = (a) => {
    if (filter === "all") return true;
    if (filter === "active") return activeQtyOf(a) > 0;
    if (filter === "maintenance") return (a.maintQty || 0) > 0;
    if (filter === "damaged") return (a.damagedQty || 0) > 0;
    if (filter === "lost") return (a.lostQty || 0) > 0;
    if (filter === "retired") return (a.retiredQty || 0) > 0;
    return true;
  };
  const filtered = list.filter(a => matchesFilter(a) && (!q || a.name.includes(q) || a.cat.includes(q) || (a.supplier || "").includes(q)));

  const sorted = [...filtered].sort((x, y) => {
    let vx = x[sortKey], vy = y[sortKey];
    if (sortKey === "cost") { vx = x.cost || 0; vy = y.cost || 0; }
    if (typeof vx === "string") { vx = vx.toLowerCase(); vy = (vy || "").toLowerCase(); }
    if (vx < vy) return sortDir === "asc" ? -1 : 1;
    if (vx > vy) return sortDir === "asc" ? 1 : -1;
    return 0;
  });
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const shown = sorted.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
    setPage(1);
  };
  const sortArrow = (key) => sortKey === key ? (sortDir === "asc" ? " ▲" : " ▼") : "";

  const exportSheet = () => [{
    name: "موارد النادي",
    thead: ["المورد", "الفئة", "العدد الكلي", "نشط", "صيانة", "تالف", "مفقود", "مستبعد", "تاريخ الإضافة", "التكلفة/وحدة", "المورّد"],
    tbody: sorted.map(a => [a.name, a.cat, a.qty, activeQtyOf(a), a.maintQty || 0, a.damagedQty || 0, a.lostQty || 0, a.retiredQty || 0, a.addedAt, a.cost || 0, a.supplier || "—"]),
  }];

  const thStyle = (key) => ({ background: C.grn, color: C.gld, padding: "8px 10px", textAlign: "right", fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap", cursor: key ? "pointer" : "default", userSelect: "none" });

  return (
    <>
      <PageTop title="موارد النادي" action={<Btn gold onClick={openAdd}>+ إضافة مورد</Btn>} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 11, marginBottom: "1.1rem" }}>
        <KCard label="إجمالي أنواع الموارد" value={counts.all} sub="نوع" bar={C.gold} />
        <KCard label="قيمة الموجودات" value={fmt(totalValue)} sub={cur} bar="#1a8c3e" />
        <KCard label="في الصيانة" value={counts.maintenance} sub="وحدة" bar="#2a78d6" />
        <KCard label="تالف / مفقود" value={counts.damaged + counts.lost} sub="وحدة" bar={C.red} />
      </div>

      <Card>
        <CardHead title="سجل الموارد" sub={`${fmt(shown.length)} من ${fmt(sorted.length)} معروضة`} right={
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <input value={q} onChange={e => { setQ(e.target.value); setPage(1); }} placeholder="بحث بالاسم أو الفئة أو المورّد..." style={{ ...inputStyle, width: 210 }} />
            <Btn sm onClick={() => downloadCsv(exportSheet(), `موارد-النادي-${todayISO()}`)}>⬇ CSV</Btn>
            <Btn sm onClick={() => downloadExcel(exportSheet(), `موارد-النادي-${todayISO()}`)}>📊 Excel</Btn>
          </div>
        } />
        {/* شرائح الفلترة حسب الحالة */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          {[["all", "الكل", C.gold], ["active", "موجود ✅", "#1a8c3e"], ["maintenance", "صيانة 🔧", "#2a78d6"], ["damaged", "تالف ⚠️", "#c0392b"], ["lost", "مفقود ❓", "#8a6a20"], ["retired", "مستبعد 📤", "#6a4d8a"]].map(([k, l, c]) => (
            <span key={k} onClick={() => { setFilter(k); setPage(1); }} style={{ cursor: "pointer", fontSize: 11.5, fontWeight: 600, padding: ".35rem .85rem", borderRadius: 20, background: filter === k ? c : C.crm, color: filter === k ? "#fff" : C.k2, border: `0.5px solid ${filter === k ? c : C.bc}` }}>{l} ({counts[k]})</span>
          ))}
        </div>

        <div className="nk-tbl-wrap">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th onClick={() => toggleSort("name")} style={thStyle("name")}>المورد{sortArrow("name")}</th>
                <th onClick={() => toggleSort("cat")} style={thStyle("cat")}>الفئة{sortArrow("cat")}</th>
                <th onClick={() => toggleSort("qty")} style={thStyle("qty")}>العدد{sortArrow("qty")}</th>
                <th onClick={() => toggleSort("addedAt")} style={thStyle("addedAt")}>تاريخ الإضافة{sortArrow("addedAt")}</th>
                <th onClick={() => toggleSort("cost")} style={thStyle("cost")}>التكلفة{sortArrow("cost")}</th>
                <th style={thStyle()}>الحالة</th>
                <th style={thStyle()}>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {shown.map(a => {
                const active = activeQtyOf(a);
                return (
                  <tr key={a.id} style={{ borderBottom: `0.5px solid ${C.bc}` }}>
                    <td style={{ padding: "8px 10px", fontSize: 12.5, fontWeight: 600 }}>{a.name}</td>
                    <td style={{ padding: "8px 10px", fontSize: 12, color: C.mt }}>{a.cat}</td>
                    <td style={{ padding: "8px 10px", fontSize: 12 }}>{a.qty}</td>
                    <td style={{ padding: "8px 10px", fontSize: 11.5, color: C.mt }}>{arDate(a.addedAt)}</td>
                    <td style={{ padding: "8px 10px", fontSize: 12 }}>{a.cost ? fmt(a.cost) + " " + cur : "—"}</td>
                    <td style={{ padding: "8px 10px" }}>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {active > 0 && <Badge tone={ASSET_STATUS.active.tone}>{ASSET_STATUS.active.icon} {active}</Badge>}
                        {(a.maintQty || 0) > 0 && <Badge tone={ASSET_STATUS.maintenance.tone}>{ASSET_STATUS.maintenance.icon} {a.maintQty}</Badge>}
                        {(a.damagedQty || 0) > 0 && <Badge tone={ASSET_STATUS.damaged.tone}>{ASSET_STATUS.damaged.icon} {a.damagedQty}</Badge>}
                        {(a.lostQty || 0) > 0 && <Badge tone={ASSET_STATUS.lost.tone}>{ASSET_STATUS.lost.icon} {a.lostQty}</Badge>}
                        {(a.retiredQty || 0) > 0 && <Badge tone={ASSET_STATUS.retired.tone}>{ASSET_STATUS.retired.icon} {a.retiredQty}</Badge>}
                      </div>
                    </td>
                    <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        <button onClick={() => setDetail(a)} title="السجل" style={actBtn(C.mt)}>📋</button>
                        <button onClick={() => openEdit(a)} title="تعديل" style={actBtn(C.gdd)}>✎</button>
                        <button onClick={() => deleteAsset(a)} title="حذف" style={actBtn(C.red)}>🗑</button>
                        {active > 0 && <>
                          <button onClick={() => openAction(a, "maintenance")} title="صيانة" style={actBtn("#2a78d6")}>🔧</button>
                          <button onClick={() => openAction(a, "damaged")} title="تالف" style={actBtn("#c0392b")}>⚠️</button>
                          <button onClick={() => openAction(a, "lost")} title="مفقود" style={actBtn("#8a6a20")}>❓</button>
                          <button onClick={() => openAction(a, "retire")} title="استبعاد (بيع/تصرف)" style={actBtn("#6a4d8a")}>📤</button>
                        </>}
                        {(a.maintQty || 0) > 0 && <button onClick={() => openAction(a, "returnMaint")} title="إرجاع من الصيانة" style={actBtn("#1a8c3e")}>✅ إرجاع</button>}
                        {(a.damagedQty || 0) > 0 && <button onClick={() => openAction(a, "restoreDamaged")} title="استعادة من التلف" style={actBtn("#1a8c3e")}>↩ من التلف</button>}
                        {(a.lostQty || 0) > 0 && <button onClick={() => openAction(a, "restoreLost")} title="استعادة من الفقد" style={actBtn("#1a8c3e")}>↩ من الفقد</button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {shown.length === 0 && <div style={{ textAlign: "center", color: C.mt, fontSize: 12.5, padding: "2rem" }}>لا موارد مطابقة</div>}
        </div>
        {totalPages > 1 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 12, paddingTop: 10, borderTop: `0.5px solid ${C.bc}` }}>
            <Btn sm onClick={() => setPage(p => Math.max(1, p - 1))} style={{ opacity: pageSafe === 1 ? .4 : 1 }}>‹ السابق</Btn>
            <span style={{ fontSize: 12, color: C.mt }}>صفحة {pageSafe} من {totalPages}</span>
            <Btn sm onClick={() => setPage(p => Math.min(totalPages, p + 1))} style={{ opacity: pageSafe === totalPages ? .4 : 1 }}>التالي ›</Btn>
          </div>
        )}
      </Card>

      {/* نافذة الإجراء */}
      {actionAsset && (
        <Modal title={`${actionTitle(actionAsset.type)} — ${actionAsset.asset.name}`} onClose={() => setActionAsset(null)} width={440}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="التاريخ"><Inp type="date" value={act.date} onChange={e => setAct({ ...act, date: e.target.value })} /></Field>
            <Field label={`العدد (الحد الأقصى ${actionAsset.maxQty})`}>
              <Inp type="number" min="1" max={actionAsset.maxQty} value={act.qty} onChange={e => setAct({ ...act, qty: Math.max(1, Math.min(actionAsset.maxQty, parseInt(e.target.value) || 1)) })} />
            </Field>
          </div>
          {actionAsset.type === "returnMaint" ? (
            <>
              <Field label="العطل الذي تم إصلاحه"><Inp value={act.note} onChange={e => setAct({ ...act, note: e.target.value })} placeholder="مثال: استبدال زر التحكم" /></Field>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Field label={"تكلفة الإصلاح (" + cur + ")"}><Inp type="number" value={act.cost} onChange={e => setAct({ ...act, cost: e.target.value })} placeholder="0" /></Field>
                {parseFloat(act.cost) > 0 && <Field label="طريقة الدفع"><Sel value={act.pay} onChange={e => setAct({ ...act, pay: e.target.value })}>{["نقداً", "تحويل", "بطاقة"].map(p => <option key={p}>{p}</option>)}</Sel></Field>}
              </div>
              {parseFloat(act.cost) > 0 && <div style={{ fontSize: 10.5, color: C.mt, marginTop: -6, marginBottom: 10 }}>💡 ستُسجَّل هذه التكلفة تلقائياً كمصروف «صيانة» ليظهر أثرها في تقارير الخزينة.</div>}
            </>
          ) : (
            <Field label={actionAsset.type === "maintenance" ? "وصف العطل" : "ملاحظة"}><Inp value={act.note} onChange={e => setAct({ ...act, note: e.target.value })} placeholder={actionAsset.type === "maintenance" ? "مثال: لا يستجيب زر X" : "سبب التلف/الفقد/الاستبعاد"} /></Field>
          )}
          <div style={{ display: "flex", gap: 8 }}><Btn gold onClick={applyAction} style={{ flex: 1, justifyContent: "center" }}>✓ تأكيد</Btn><Btn onClick={() => setActionAsset(null)}>إلغاء</Btn></div>
        </Modal>
      )}

      {/* نافذة سجل المورد */}
      {detail && (
        <Modal title={`سجل — ${detail.name}`} onClose={() => setDetail(null)} width={520}>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", background: C.crm, borderRadius: 10, padding: ".7rem 1rem", marginBottom: 12, fontSize: 12 }}>
            <span>الفئة: <b>{detail.cat}</b></span><span>العدد الكلي: <b>{detail.qty}</b></span>
            <span>أُضيف: <b>{arDate(detail.addedAt)}</b></span>
            {detail.supplier && <span>المورّد: <b>{detail.supplier}</b></span>}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
            {activeQtyOf(detail) > 0 && <Badge tone={ASSET_STATUS.active.tone}>{ASSET_STATUS.active.icon} {activeQtyOf(detail)} {ASSET_STATUS.active.label}</Badge>}
            {(detail.maintQty || 0) > 0 && <Badge tone={ASSET_STATUS.maintenance.tone}>{ASSET_STATUS.maintenance.icon} {detail.maintQty} {ASSET_STATUS.maintenance.label}</Badge>}
            {(detail.damagedQty || 0) > 0 && <Badge tone={ASSET_STATUS.damaged.tone}>{ASSET_STATUS.damaged.icon} {detail.damagedQty} {ASSET_STATUS.damaged.label}</Badge>}
            {(detail.lostQty || 0) > 0 && <Badge tone={ASSET_STATUS.lost.tone}>{ASSET_STATUS.lost.icon} {detail.lostQty} {ASSET_STATUS.lost.label}</Badge>}
            {(detail.retiredQty || 0) > 0 && <Badge tone={ASSET_STATUS.retired.tone}>{ASSET_STATUS.retired.icon} {detail.retiredQty} {ASSET_STATUS.retired.label}</Badge>}
          </div>
          {(!detail.history || detail.history.length === 0) ? <div style={{ textAlign: "center", color: C.mt, fontSize: 12.5, padding: "1.5rem" }}>لا أحداث مسجّلة — المورد بحالته الأصلية.</div> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {detail.history.map((h, i) => (
                <div key={i} style={{ borderRight: `3px solid ${C.gold}`, background: C.crm, borderRadius: 8, padding: ".55rem .8rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, fontWeight: 700 }}><span>{h.event}</span><span style={{ color: C.mt, fontWeight: 500 }}>{arDate(h.date)}</span></div>
                  {h.note && h.note !== "—" && <div style={{ fontSize: 11.5, color: C.k2, marginTop: 3 }}>📝 {h.note}</div>}
                  {h.from && <div style={{ fontSize: 11, color: C.mt, marginTop: 2 }}>مدة الصيانة: {daysBetween(h.from, h.date)} يوم</div>}
                  {h.cost > 0 && <div style={{ fontSize: 11, color: "#c0392b", marginTop: 2 }}>تكلفة الإصلاح: {fmt(h.cost)} {cur}</div>}
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}

      {/* نافذة إضافة/تعديل مورد */}
      {modal && (
        <Modal title={editing ? `تعديل مورد — ${editing.name}` : "إضافة مورد جديد للنادي"} onClose={() => { setModal(false); setEditing(null); }} width={480}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="اسم المورد *" full><Inp value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="مثال: يد تحكم PS5" /></Field>
            <Field label="الفئة"><Sel value={f.cat} onChange={e => setF({ ...f, cat: e.target.value })}>{CATS_A.map(c => <option key={c}>{c}</option>)}</Sel></Field>
            <Field label="العدد"><Inp type="number" value={f.qty} onChange={e => setF({ ...f, qty: e.target.value })} min="1" /></Field>
            <Field label="تاريخ الإضافة"><Inp type="date" value={f.addedAt} onChange={e => setF({ ...f, addedAt: e.target.value })} /></Field>
            <Field label={"التكلفة للوحدة (" + cur + ")"}><Inp type="number" value={f.cost} onChange={e => setF({ ...f, cost: e.target.value })} placeholder="0" /></Field>
            {!editing && parseFloat(f.cost) > 0 && <Field label="طريقة الدفع"><Sel value={f.pay} onChange={e => setF({ ...f, pay: e.target.value })}>{["نقداً", "تحويل", "بطاقة"].map(p => <option key={p}>{p}</option>)}</Sel></Field>}
            <Field label="المورّد (اختياري)" full>
              <div style={{ display: "flex", gap: 6 }}>
                <Sel value={f.supplier} onChange={e => setF({ ...f, supplier: e.target.value })} style={{ flex: 1 }}><option value="">— بدون —</option>{suppliers.map(s => <option key={s.id}>{s.name}</option>)}</Sel>
                <Btn sm gold onClick={() => setSupModal(true)} style={{ whiteSpace: "nowrap" }}>+ مورّد</Btn>
              </div>
            </Field>
          </div>
          {!editing && parseFloat(f.cost) > 0 && <div style={{ fontSize: 10.5, color: C.mt, marginTop: -4, marginBottom: 10 }}>💡 ستُسجَّل تكلفة الشراء الإجمالية ({fmt((parseFloat(f.cost) || 0) * Math.max(1, parseInt(f.qty) || 1))} {cur}) تلقائياً كمصروف «شراء موارد».</div>}
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}><Btn gold onClick={save} style={{ flex: 1, justifyContent: "center" }}>✓ {editing ? "حفظ التعديلات" : "إضافة"}</Btn><Btn onClick={() => { setModal(false); setEditing(null); }}>إلغاء</Btn></div>
        </Modal>
      )}

      {/* نافذة إضافة مورّد سريع */}
      {supModal && <QuickAddSupplierModal onClose={() => setSupModal(false)} ctx={ctx} onCreated={(s) => setF(ff => ({ ...ff, supplier: s.name }))} />}
    </>
  );
}
