import { useState } from "react";
import { C, fmt } from "../constants/theme.js";
import { PageTop, Btn, KCard, Card, CardHead, Sel, inputStyle, Table, Badge, Modal, Field, Inp } from "../components/ui.jsx";
import SupplierDetail from "./SupplierDetail.jsx";

/* ============================ SUPPLIERS ============================ */
export default function Suppliers({ ctx }) {
  const { suppliers, setSuppliers, showToast, settings } = ctx;
  const [modal, setModal] = useState(false);
  const [filter, setFilter] = useState("all"); // all | due
  const [q, setQ] = useState("");
  const [detail, setDetail] = useState(null);
  const [f, setF] = useState({ name: "", phone: "", spec: "" });
  const cur = settings?.currency || "د.ل";
  const toWa = (phone) => {
    let d = (phone || "").replace(/\D/g, "");
    if (d.startsWith("0")) d = "218" + d.slice(1);
    return d;
  };
  const save = () => {
    if (!f.name.trim()) { showToast("أدخل اسم المورد"); return; }
    setSuppliers(s => [...s, { id: Math.max(0, ...s.map(x => x.id)) + 1, name: f.name, phone: f.phone, wa: toWa(f.phone), spec: f.spec || "عام", total: 0, due: 0, status: "نشط" }]);
    showToast("تمت إضافة المورد"); setModal(false); setF({ name: "", phone: "", spec: "" });
  };

  const shown = suppliers.filter(s => {
    if (!(s.name.includes(q) || (s.phone || "").includes(q))) return false;
    if (filter === "due") return (s.due || 0) > 0;
    if (filter.startsWith("spec:")) return s.spec === filter.slice(5);
    return true;
  });
  const totalDue = suppliers.reduce((s, x) => s + (x.due || 0), 0);
  const dueCount = suppliers.filter(s => (s.due || 0) > 0).length;
  // تصنيفات الموردين (حسب التخصص)
  const specs = [...new Set(suppliers.map(s => s.spec).filter(Boolean))];

  return (
    <>
      <PageTop title="إدارة الموردين" action={<Btn gold onClick={() => setModal(true)}>+ إضافة مورد</Btn>} />
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
        <CardHead title="قائمة الموردين" sub="اضغط «عرض» لكشف الحساب والسداد" right={
          <div style={{ display: "flex", gap: 7 }}>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="بحث..." style={{ ...inputStyle, width: 160 }} />
            <Sel value={filter} onChange={e => setFilter(e.target.value)} style={{ width: 165 }}>
              <option value="all">كل الموردين</option>
              <option value="due">غير المسدّدين</option>
              {specs.length > 0 && <option disabled>── حسب التخصص ──</option>}
              {specs.map(sp => <option key={sp} value={"spec:" + sp}>{sp}</option>)}
            </Sel>
          </div>
        } />
        {/* شرائح التصنيف السريع حسب التخصص */}
        {specs.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
            <span onClick={() => setFilter("all")} style={{ cursor: "pointer", fontSize: 11.5, fontWeight: 600, padding: ".3rem .8rem", borderRadius: 20, background: filter === "all" ? C.grn : C.crm, color: filter === "all" ? C.gld : C.k2, border: `0.5px solid ${C.bc}` }}>الكل ({suppliers.length})</span>
            {specs.map(sp => {
              const n = suppliers.filter(s => s.spec === sp).length;
              const active = filter === "spec:" + sp;
              return <span key={sp} onClick={() => setFilter("spec:" + sp)} style={{ cursor: "pointer", fontSize: 11.5, fontWeight: 600, padding: ".3rem .8rem", borderRadius: 20, background: active ? C.grn : C.crm, color: active ? C.gld : C.k2, border: `0.5px solid ${C.bc}` }}>{sp} ({n})</span>;
            })}
          </div>
        )}
        <Table cols={[{ h: "الاسم", w: "19%" }, { h: "الهاتف", w: "15%" }, { h: "واتساب", w: "8%" }, { h: "التخصص", w: "16%" }, { h: "إجمالي الطلبات", w: "13%" }, { h: "المستحقات", w: "14%" }, { h: "عرض", w: "9%" }]}
          rows={shown.map(s => [
            <span style={{ fontWeight: 600 }}>{s.name}</span>, s.phone,
            s.wa ? <span style={{ color: "#25D366", fontSize: 15 }} title="متصل بواتساب">📱</span> : <span style={{ color: C.mt }}>—</span>,
            <Badge tone={s.spec.includes("ألعاب") ? "g" : s.spec.includes("كافيه") ? "a" : "p"}>{s.spec}</Badge>,
            fmt(s.total) + " " + cur,
            (s.due || 0) > 0 ? <Badge tone="a">{fmt(s.due)} {cur}</Badge> : <Badge tone="g">مسدّد</Badge>,
            <Btn sm onClick={() => setDetail(s)}>عرض</Btn>,
          ])} />
      </Card>

      {modal && <Modal title="إضافة مورد جديد" onClose={() => setModal(false)} width={440}>
        <Field label="اسم المورد"><Inp value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="رقم الهاتف / الواتساب"><Inp value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} placeholder="0913-000-000" /></Field>
        {f.phone && <div style={{ fontSize: 11, color: C.mt, marginTop: -6, marginBottom: 10 }}>سيُحفظ رقم الواتساب كـ: {toWa(f.phone) || "—"}</div>}
        <Field label="التخصص"><Inp value={f.spec} onChange={e => setF({ ...f, spec: e.target.value })} placeholder="أجهزة ألعاب / مواد كافيه" /></Field>
        <div style={{ display: "flex", gap: 8 }}><Btn gold onClick={save} style={{ flex: 1, justifyContent: "center" }}>✓ حفظ</Btn><Btn onClick={() => setModal(false)}>إلغاء</Btn></div>
      </Modal>}

      {detail && <SupplierDetail ctx={ctx} supplier={suppliers.find(s => s.id === detail.id)} onClose={() => setDetail(null)} />}
    </>
  );
}
