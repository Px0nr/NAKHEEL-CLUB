import { useState } from "react";
import { C, fmt } from "../constants/theme.js";
import { Modal, Field, Inp, Btn } from "./ui.jsx";
import { todayISO, toWa } from "../utils/format.js";

/* ---- Shared new-customer modal (WhatsApp mandatory) ---- */
export default function NewCustomerModal({ ctx, onClose, onCreated }) {
  const { customers, setCustomers, setInvoices, user, showToast } = ctx;
  const cur = ctx.settings?.currency || "د.ل";
  const [f, setF] = useState({ name: "", phone: "", openingDebt: "", debtDate: todayISO() });
  const save = () => {
    if (!f.name.trim()) { showToast("أدخل اسم الزبون"); return; }
    const wa = toWa(f.phone);
    if (!wa || wa.length < 10) { showToast("رقم الواتساب إلزامي وبصيغة صحيحة"); return; }
    const opening = Math.max(0, parseFloat(f.openingDebt) || 0);
    const c = { id: Math.max(0, ...customers.map(x => x.id)) + 1, name: f.name.trim(), phone: f.phone, wa, invoices: opening > 0 ? 1 : 0, total: opening, debt: opening, points: 0, last: opening > 0 ? f.debtDate : todayISO(), tier: "جديد" };
    setCustomers(cs => [...cs, c]);
    // دين سابق قبل استخدام النظام: يُسجَّل كفاتورة آجلة حقيقية — يدخل تلقائياً ضمن تنبيهات السداد والتحصيل والخزينة عند السداد
    if (opening > 0) {
      const invNum = "INV-OB-" + ctx.nextCounter("obInvoice");
      setInvoices(iv => [{ id: invNum, customer: c.name, customerId: c.id, date: f.debtDate, source: "رصيد سابق", details: "رصيد افتتاحي — دين سابق قبل استخدام النظام", items: [{ cat: "__opening", name: "رصيد افتتاحي", qty: 1, lineTotal: opening }], pay: "آجل", discount: "—", total: opening, cost: 0, status: "معلقة", dueDate: f.debtDate, by: user?.name || "—" }, ...iv]);
    }
    showToast(opening > 0 ? `تمت إضافة الزبون برصيد سابق ${fmt(opening)} ${cur}` : "تمت إضافة الزبون");
    onCreated ? onCreated(c) : onClose();
  };
  return (
    <Modal title="تسجيل زبون جديد" onClose={onClose} width={440}>
      <Field label="اسم الزبون *"><Inp value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></Field>
      <Field label="رقم الواتساب * (إلزامي)"><Inp value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} placeholder="0913-000-000" /></Field>
      {f.phone && <div style={{ fontSize: 11, color: C.mt, marginTop: -6, marginBottom: 10 }}>سيُحفظ كـ: {toWa(f.phone) || "—"}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label={"دين سابق قبل النظام (" + cur + ") — اختياري"}><Inp type="number" min="0" value={f.openingDebt} onChange={e => setF({ ...f, openingDebt: e.target.value })} placeholder="0" /></Field>
        {parseFloat(f.openingDebt) > 0 && <Field label="تاريخ نشوء الدين"><Inp type="date" value={f.debtDate} onChange={e => setF({ ...f, debtDate: e.target.value })} /></Field>}
      </div>
      {parseFloat(f.openingDebt) > 0 && <div style={{ fontSize: 11, color: C.gdd, background: C.gold + "12", borderRadius: 8, padding: ".55rem .75rem", marginBottom: 10, lineHeight: 1.8 }}>سيُسجَّل هذا المبلغ كحساب آجل على الزبون — يظهر في تنبيهات السداد، ويمكن تحصيله جزئياً أو كاملاً لاحقاً من صفحة الزبون تماماً كأي دين آخر.</div>}
      <div style={{ fontSize: 11, color: C.gdd, background: C.gold + "12", borderRadius: 8, padding: ".55rem .75rem", marginBottom: 12 }}>لا يمكن إضافة زبون بدون رقم واتساب — يُستخدم لإرسال الفواتير والتقارير.</div>
      <div style={{ display: "flex", gap: 8 }}><Btn gold onClick={save} style={{ flex: 1, justifyContent: "center" }}>✓ حفظ الزبون</Btn><Btn onClick={onClose}>إلغاء</Btn></div>
    </Modal>
  );
}
