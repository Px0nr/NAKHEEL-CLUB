import { useState } from "react";
import { Modal, Field, Inp, Btn } from "./ui.jsx";
import { toWa } from "../utils/format.js";

/* ---- Shared quick-add-supplier modal (Purchases & Assets pages) ---- */
export default function QuickAddSupplierModal({ onClose, ctx, onCreated }) {
  const { suppliers, setSuppliers, showToast } = ctx;
  const [newSup, setNewSup] = useState({ name: "", phone: "", spec: "" });
  const save = () => {
    if (!newSup.name.trim()) { showToast("أدخل اسم المورد"); return; }
    const s = { id: Math.max(0, ...suppliers.map(x => x.id)) + 1, name: newSup.name.trim(), phone: newSup.phone, wa: toWa(newSup.phone), spec: newSup.spec || "عام", total: 0, due: 0, status: "نشط" };
    setSuppliers(list => [...list, s]);
    showToast("تمت إضافة المورد واختياره");
    onCreated(s);
    onClose();
  };
  return (
    <Modal title="إضافة مورد جديد" onClose={onClose} width={430}>
      <Field label="اسم المورد *"><Inp value={newSup.name} onChange={e => setNewSup({ ...newSup, name: e.target.value })} /></Field>
      <Field label="رقم الهاتف / الواتساب"><Inp value={newSup.phone} onChange={e => setNewSup({ ...newSup, phone: e.target.value })} placeholder="0913-000-000" /></Field>
      <Field label="التخصص"><Inp value={newSup.spec} onChange={e => setNewSup({ ...newSup, spec: e.target.value })} placeholder="أجهزة ألعاب / مواد كافيه" /></Field>
      <div style={{ display: "flex", gap: 8 }}>
        <Btn gold style={{ flex: 1, justifyContent: "center" }} onClick={save}>✓ حفظ واختيار</Btn>
        <Btn onClick={onClose}>إلغاء</Btn>
      </div>
    </Modal>
  );
}
