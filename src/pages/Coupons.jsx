import { useState } from "react";
import { C } from "../constants/theme.js";
import { PageTop, Btn, Badge, Modal, Field, Inp } from "../components/ui.jsx";
import { arDate } from "../utils/format.js";

/* ============================ COUPONS ============================ */
export default function Coupons({ ctx }) {
  const { coupons, setCoupons, showToast } = ctx;
  const [modal, setModal] = useState(false);
  const [f, setF] = useState({ code: "", desc: "", pct: "", limit: "", exp: "" });
  const save = () => {
    if (!f.code.trim() || !f.pct) { showToast("أدخل الكود ونسبة الخصم"); return; }
    setCoupons(c => [...c, { id: c.length + 1, code: f.code.toUpperCase(), desc: f.desc, pct: parseInt(f.pct), used: 0, limit: parseInt(f.limit) || 100, exp: f.exp, status: "نشط" }]);
    showToast("تم إنشاء الكوبون"); setModal(false); setF({ code: "", desc: "", pct: "", limit: "", exp: "" });
  };
  return (
    <>
      <PageTop title="كوبونات الخصم" action={<Btn gold onClick={() => setModal(true)}>+ إنشاء كوبون</Btn>} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(290px,1fr))", gap: 11 }}>
        {coupons.map(c => (
          <div key={c.id} style={{ background: C.crm, border: `1.5px dashed ${C.gold}`, borderRadius: 12, padding: ".9rem 1rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div><div style={{ fontFamily: "monospace", fontSize: 15, fontWeight: 700, letterSpacing: 2, color: C.grn2 }}>{c.code}</div><div style={{ fontSize: 11, color: C.mt, marginTop: 3 }}>{c.desc}</div><div style={{ fontSize: 10, color: C.k2, marginTop: 4 }}>استُخدم {c.used} / {c.limit} مرة</div></div>
            <div style={{ textAlign: "left" }}><Badge tone={c.status === "نشط" ? "g" : "r"}>{c.status}</Badge><div style={{ fontSize: 10, color: C.mt, marginTop: 5 }}>ينتهي {arDate(c.exp)}</div></div>
          </div>
        ))}
      </div>
      {modal && <Modal title="إنشاء كوبون جديد" onClose={() => setModal(false)} width={440}>
        <Field label="كود الكوبون"><Inp value={f.code} onChange={e => setF({ ...f, code: e.target.value })} placeholder="GAME25" /></Field>
        <Field label="الوصف"><Inp value={f.desc} onChange={e => setF({ ...f, desc: e.target.value })} placeholder="خصم على الألعاب" /></Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="نسبة الخصم %"><Inp type="number" value={f.pct} onChange={e => setF({ ...f, pct: e.target.value })} /></Field>
          <Field label="حد الاستخدام"><Inp type="number" value={f.limit} onChange={e => setF({ ...f, limit: e.target.value })} /></Field>
        </div>
        <Field label="تاريخ الانتهاء"><Inp type="date" value={f.exp} onChange={e => setF({ ...f, exp: e.target.value })} /></Field>
        <div style={{ display: "flex", gap: 8 }}><Btn gold onClick={save} style={{ flex: 1, justifyContent: "center" }}>✓ حفظ</Btn><Btn onClick={() => setModal(false)}>إلغاء</Btn></div>
      </Modal>}
    </>
  );
}
