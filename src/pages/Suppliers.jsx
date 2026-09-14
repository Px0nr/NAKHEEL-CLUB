import { useState } from "react";
import { C, fmt } from "../constants/theme.js";
import { PageTop, Btn, KCard, Card, CardHead, Sel, inputStyle, Table, Badge, Modal, Field, Inp } from "../components/ui.jsx";
import { downloadCsv, downloadExcel } from "../utils/exportTable.js";
import { todayISO } from "../utils/format.js";
import SupplierDetail from "./SupplierDetail.jsx";

const PAGE_SIZE = 20;

/* ============================ SUPPLIERS ============================ */
export default function Suppliers({ ctx }) {
  const { suppliers, setSuppliers, purchases, showToast, confirm, settings } = ctx;
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null); // مورد قيد التعديل — null يعني إضافة جديد
  const [filter, setFilter] = useState("all"); // all | due
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState("asc");
  const [detail, setDetail] = useState(null);
  const [f, setF] = useState({ name: "", phone: "", spec: "" });
  const cur = settings?.currency || "د.ل";
  const toWa = (phone) => {
    let d = (phone || "").replace(/\D/g, "");
    if (d.startsWith("0")) d = "218" + d.slice(1);
    return d;
  };
  const openAdd = () => { setEditing(null); setF({ name: "", phone: "", spec: "" }); setModal(true); };
  const openEdit = (s) => { setEditing(s); setF({ name: s.name, phone: s.phone || "", spec: s.spec || "" }); setModal(true); };
  const save = () => {
    if (!f.name.trim()) { showToast("أدخل اسم المورد"); return; }
    if (editing) {
      setSuppliers(s => s.map(x => x.id === editing.id ? { ...x, name: f.name.trim(), phone: f.phone, wa: toWa(f.phone), spec: f.spec || "عام" } : x));
      showToast("تم تحديث بيانات المورد");
    } else {
      setSuppliers(s => [...s, { id: Math.max(0, ...s.map(x => x.id)) + 1, name: f.name.trim(), phone: f.phone, wa: toWa(f.phone), spec: f.spec || "عام", total: 0, due: 0, status: "نشط" }]);
      showToast("تمت إضافة المورد");
    }
    setModal(false); setEditing(null); setF({ name: "", phone: "", spec: "" });
  };
  const deleteSupplier = async (s) => {
    const purchCount = purchases.filter(p => p.supplier === s.name).length;
    const warn = purchCount > 0
      ? ` لدى هذا المورد ${purchCount} فاتورة توريد سابقة${(s.due || 0) > 0 ? ` ومستحقات غير مسددة (${fmt(s.due)} ${cur})` : ""} — حذفه لن يحذف فواتيره، لكنها ستبقى بلا مورد مرتبط قابل للفتح من هذه القائمة.`
      : "";
    if (!(await confirm(`حذف المورد «${s.name}» نهائياً؟${warn}`, { danger: true }))) return;
    setSuppliers(list => list.filter(x => x.id !== s.id));
    showToast("تم حذف المورد");
  };

  const filtered = suppliers.filter(s => {
    if (!(s.name.includes(q) || (s.phone || "").includes(q))) return false;
    if (filter === "due") return (s.due || 0) > 0;
    if (filter.startsWith("spec:")) return s.spec === filter.slice(5);
    return true;
  });
  const sorted = [...filtered].sort((x, y) => {
    let vx = x[sortKey], vy = y[sortKey];
    if (sortKey === "total" || sortKey === "due") { vx = x[sortKey] || 0; vy = y[sortKey] || 0; }
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
  const sortHeader = (key, label) => (
    <span onClick={() => toggleSort(key)} style={{ cursor: "pointer", userSelect: "none" }}>
      {label}{sortKey === key ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
    </span>
  );
  const exportSheet = () => [{
    name: "الموردون",
    thead: ["الاسم", "الهاتف", "التخصص", "إجمالي الطلبات", "المستحقات", "الحالة"],
    tbody: sorted.map(s => [s.name, s.phone || "—", s.spec, s.total, s.due || 0, s.status]),
  }];
  const totalDue = suppliers.reduce((s, x) => s + (x.due || 0), 0);
  const dueCount = suppliers.filter(s => (s.due || 0) > 0).length;
  // تصنيفات الموردين (حسب التخصص)
  const specs = [...new Set(suppliers.map(s => s.spec).filter(Boolean))];

  return (
    <>
      <PageTop title="إدارة الموردين" action={<Btn gold onClick={openAdd}>+ إضافة مورد</Btn>} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 11, marginBottom: "1.1rem" }}>
        <KCard label="الموردون النشطون" value={suppliers.filter(s => s.status === "نشط").length} sub="مورد" bar={C.grl} />
        <KCard label="موردون غير مسدّدين" value={dueCount} sub="عليهم مستحقات" bar={C.gold} />
        <KCard label="إجمالي المستحقات" value={fmt(totalDue)} sub={cur} bar={C.red} />
      </div>

      {totalDue > 0 && (
        <div style={{ background: "linear-gradient(135deg,#fdeaea,#fff)", border: "1px solid rgba(192,57,43,.28)", borderRadius: 12, padding: ".7rem 1rem", marginBottom: "1rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div style={{ fontSize: 12.5, color: "#922" }}>💰 يوجد <b>{dueCount}</b> مورد بمستحقات غير مسددة بإجمالي <b>{fmt(totalDue)} {cur}</b></div>
          <Btn sm danger onClick={() => setFilter("due")}>عرض غير المسدّدين →</Btn>
        </div>
      )}

      <Card>
        <CardHead title="قائمة الموردين" sub={`${fmt(shown.length)} من ${fmt(sorted.length)} معروضة`} right={
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <input value={q} onChange={e => { setQ(e.target.value); setPage(1); }} placeholder="بحث..." style={{ ...inputStyle, width: 160 }} />
            <Sel value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }} style={{ width: 165 }}>
              <option value="all">كل الموردين</option>
              <option value="due">غير المسدّدين</option>
              {specs.length > 0 && <option disabled>── حسب التخصص ──</option>}
              {specs.map(sp => <option key={sp} value={"spec:" + sp}>{sp}</option>)}
            </Sel>
            <Btn sm onClick={() => downloadCsv(exportSheet(), `الموردون-${todayISO()}`)}>⬇ CSV</Btn>
            <Btn sm onClick={() => downloadExcel(exportSheet(), `الموردون-${todayISO()}`)}>📊 Excel</Btn>
          </div>
        } />
        {/* شرائح التصنيف السريع حسب التخصص */}
        {specs.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
            <span onClick={() => { setFilter("all"); setPage(1); }} style={{ cursor: "pointer", fontSize: 11.5, fontWeight: 600, padding: ".3rem .8rem", borderRadius: 20, background: filter === "all" ? C.grn : C.crm, color: filter === "all" ? C.gld : C.k2, border: `0.5px solid ${C.bc}` }}>الكل ({suppliers.length})</span>
            {specs.map(sp => {
              const n = suppliers.filter(s => s.spec === sp).length;
              const active = filter === "spec:" + sp;
              return <span key={sp} onClick={() => { setFilter("spec:" + sp); setPage(1); }} style={{ cursor: "pointer", fontSize: 11.5, fontWeight: 600, padding: ".3rem .8rem", borderRadius: 20, background: active ? C.grn : C.crm, color: active ? C.gld : C.k2, border: `0.5px solid ${C.bc}` }}>{sp} ({n})</span>;
            })}
          </div>
        )}
        <Table cols={[
          { h: sortHeader("name", "الاسم"), w: "17%" }, { h: "الهاتف", w: "13%" }, { h: "واتساب", w: "7%" },
          { h: sortHeader("spec", "التخصص"), w: "14%" }, { h: sortHeader("total", "إجمالي الطلبات"), w: "12%" },
          { h: sortHeader("due", "المستحقات"), w: "12%" }, { h: "إجراءات", w: "16%" },
        ]}
          rows={shown.map(s => [
            <span style={{ fontWeight: 600 }}>{s.name}</span>, s.phone,
            s.wa ? <span style={{ color: "#25D366", fontSize: 15 }} title="متصل بواتساب">📱</span> : <span style={{ color: C.mt }}>—</span>,
            <Badge tone={s.spec.includes("ألعاب") ? "g" : s.spec.includes("كافيه") ? "a" : "p"}>{s.spec}</Badge>,
            fmt(s.total) + " " + cur,
            (s.due || 0) > 0 ? <Badge tone="a">{fmt(s.due)} {cur}</Badge> : <Badge tone="g">مسدّد</Badge>,
            <div style={{ display: "flex", gap: 4 }}>
              <Btn sm onClick={() => setDetail(s)}>عرض</Btn>
              <Btn sm onClick={() => openEdit(s)}>✎</Btn>
              <Btn sm danger onClick={() => deleteSupplier(s)}>🗑</Btn>
            </div>,
          ])} />
        {shown.length === 0 && <div style={{ textAlign: "center", color: C.mt, fontSize: 12, padding: "1.5rem" }}>لا موردون مطابقون</div>}
        {totalPages > 1 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 12, paddingTop: 10, borderTop: `0.5px solid ${C.bc}` }}>
            <Btn sm onClick={() => setPage(p => Math.max(1, p - 1))} style={{ opacity: pageSafe === 1 ? .4 : 1 }}>‹ السابق</Btn>
            <span style={{ fontSize: 12, color: C.mt }}>صفحة {pageSafe} من {totalPages}</span>
            <Btn sm onClick={() => setPage(p => Math.min(totalPages, p + 1))} style={{ opacity: pageSafe === totalPages ? .4 : 1 }}>التالي ›</Btn>
          </div>
        )}
      </Card>

      {modal && <Modal title={editing ? `تعديل مورد — ${editing.name}` : "إضافة مورد جديد"} onClose={() => { setModal(false); setEditing(null); }} width={440}>
        <Field label="اسم المورد"><Inp value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="رقم الهاتف / الواتساب"><Inp value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} placeholder="0913-000-000" /></Field>
        {f.phone && <div style={{ fontSize: 11, color: C.mt, marginTop: -6, marginBottom: 10 }}>سيُحفظ رقم الواتساب كـ: {toWa(f.phone) || "—"}</div>}
        <Field label="التخصص"><Inp value={f.spec} onChange={e => setF({ ...f, spec: e.target.value })} placeholder="أجهزة ألعاب / مواد كافيه" /></Field>
        <div style={{ display: "flex", gap: 8 }}><Btn gold onClick={save} style={{ flex: 1, justifyContent: "center" }}>✓ {editing ? "حفظ التعديلات" : "حفظ"}</Btn><Btn onClick={() => { setModal(false); setEditing(null); }}>إلغاء</Btn></div>
      </Modal>}

      {detail && <SupplierDetail ctx={ctx} supplier={suppliers.find(s => s.id === detail.id)} onClose={() => setDetail(null)} />}
    </>
  );
}
