import { useState } from "react";
import { C, fmt } from "../constants/theme.js";
import { Modal, Field, Inp, Sel, Btn } from "./ui.jsx";
import { todayISO } from "../utils/format.js";

const WASTE_REASONS = ["سكب / انسكاب", "تسريب عبوة", "كسر", "انتهاء الصلاحية", "تلف بالتخزين", "أخرى"];

/* ---- Shared damage/waste-registration modal (Products & Inventory pages) ---- */
export default function WasteModal({ product, onClose, ctx, cur }) {
  const { setProducts, setWaste, user, showToast } = ctx;
  const [wasteForm, setWasteForm] = useState({ qty: 1, reason: "سكب / انسكاب", note: "", date: todayISO() });
  if (!product) return null;
  const applyWaste = () => {
    const qty = Math.min(product.stock, Math.max(1, parseInt(wasteForm.qty) || 1));
    const cost = Math.round((product.buy || 0) * qty * 100) / 100;
    setProducts(ps => ps.map(p => p.id === product.id ? { ...p, stock: Math.max(0, p.stock - qty) } : p));
    setWaste(w => [{ id: "WS-" + Date.now(), date: wasteForm.date, pid: product.id, name: product.name, cat: product.cat, qty, reason: wasteForm.reason, note: wasteForm.note.trim(), cost, by: user?.name || "—" }, ...w]);
    showToast(`تم تسجيل إتلاف ${qty} ${product.unit} من «${product.name}» — خسارة ${fmt(cost)} ${cur}`);
    onClose();
  };
  return (
    <Modal title={`تسجيل إتلاف — ${product.name}`} onClose={onClose} width={440}>
      <div style={{ fontSize: 12, color: C.mt, marginBottom: 12, background: C.crm, borderRadius: 8, padding: ".55rem .8rem" }}>المتوفر حالياً: <b>{product.stock} {product.unit}</b> — سعر الشراء: <b>{fmt(product.buy || 0)} {cur}</b> / {product.unit}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label={"الكمية التالفة (" + product.unit + ")"}><Inp type="number" min="1" max={product.stock} value={wasteForm.qty} onChange={e => setWasteForm({ ...wasteForm, qty: e.target.value })} /></Field>
        <Field label="التاريخ"><Inp type="date" value={wasteForm.date} onChange={e => setWasteForm({ ...wasteForm, date: e.target.value })} /></Field>
        <Field label="السبب" full><Sel value={wasteForm.reason} onChange={e => setWasteForm({ ...wasteForm, reason: e.target.value })}>{WASTE_REASONS.map(r => <option key={r}>{r}</option>)}</Sel></Field>
        <Field label="ملاحظة (اختياري)" full><Inp value={wasteForm.note} onChange={e => setWasteForm({ ...wasteForm, note: e.target.value })} placeholder="مثال: سقط كوب أثناء التقديم" /></Field>
      </div>
      <div style={{ background: "#fdeaea", border: "0.5px solid rgba(192,57,43,.25)", borderRadius: 9, padding: ".6rem .85rem", margin: ".4rem 0 1rem", fontSize: 12.5, display: "flex", justifyContent: "space-between" }}>
        <span>الخسارة المقدّرة</span><b style={{ color: C.red }}>{fmt(Math.round((product.buy || 0) * (Math.max(1, parseInt(wasteForm.qty) || 1)) * 100) / 100)} {cur}</b>
      </div>
      <div style={{ display: "flex", gap: 8 }}><Btn danger onClick={applyWaste} style={{ flex: 1, justifyContent: "center" }}>🗑 تأكيد الإتلاف وخصمه من المخزون</Btn><Btn onClick={onClose}>إلغاء</Btn></div>
    </Modal>
  );
}
