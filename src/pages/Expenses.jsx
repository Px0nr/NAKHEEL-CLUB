import { useState } from "react";
import { C, fmt } from "../constants/theme.js";
import { PageTop, Btn, KCard, Card, CardHead, Sel, Table, Badge, Modal, Field, Inp } from "../components/ui.jsx";
import { todayISO, arDate } from "../utils/format.js";

/* ============================ EXPENSES ============================ */
export default function Expenses({ ctx }) {
  const { expenses, setExpenses, employees, user, showToast, cats } = ctx;
  const cur = ctx.settings?.currency || "د.ل";
  const [modal, setModal] = useState(false);
  const [empFilter, setEmpFilter] = useState("all");
  const [f, setF] = useState({ date: todayISO(), cat: "أجار", desc: "", amount: "", pay: "نقداً", empId: "", dept: "" });
  const save = () => {
    if (!f.desc.trim() || !f.amount) { showToast("أدخل الوصف والمبلغ"); return; }
    const isEmp = f.cat === "سلفة موظف" && f.empId;
    const emp = isEmp ? employees.find(e => e.id == f.empId) : null;
    setExpenses(e => [{ id: Math.max(0, ...e.map(x => x.id)) + 1, date: f.date, cat: f.cat, desc: f.desc, amount: parseFloat(f.amount), pay: f.pay, by: user.name.split(" ")[0], empId: isEmp ? parseInt(f.empId) : null, empName: emp ? emp.name : null, dept: f.dept || null }, ...e]);
    showToast(isEmp ? `تم تسجيل سلفة ${fmt(parseFloat(f.amount))} ${cur} على ${emp.name}` : "تمت إضافة المصروف");
    setModal(false); setF({ date: todayISO(), cat: "أجار", desc: "", amount: "", pay: "نقداً", empId: "", dept: "" });
  };
  const byCat = (c) => expenses.filter(e => e.cat === c).reduce((s, e) => s + e.amount, 0);
  const CAT_TONE = { "أجار": "b", "مرتبات": "gold", "كهرباء": "r", "صيانة": "g", "سلفة موظف": "p", "أخرى": "a" };
  const shown = empFilter === "all" ? expenses : empFilter === "none" ? expenses.filter(e => !e.empId) : expenses.filter(e => e.empId == empFilter);

  return (
    <>
      <PageTop title="نظام المصاريف" action={<Btn gold onClick={() => setModal(true)}>+ إضافة مصروف</Btn>} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 11, marginBottom: "1.1rem" }}>
        <KCard label="أجار الموقع" value={fmt(byCat("أجار"))} sub="شهري" bar="#2a78d6" />
        <KCard label="سلف الموظفين" value={fmt(byCat("سلفة موظف"))} sub={cur} bar={C.purp} />
        <KCard label="الصيانة" value={fmt(byCat("صيانة"))} bar={C.red} />
        <KCard label="إجمالي المصاريف" value={fmt(expenses.reduce((s, e) => s + e.amount, 0))} sub={cur} bar={C.gold} />
      </div>
      <Card>
        <CardHead title="سجل المصاريف" right={
          <Sel value={empFilter} onChange={e => setEmpFilter(e.target.value)} style={{ width: 175 }}>
            <option value="all">كل المصاريف</option>
            <option value="none">مصاريف عامة فقط</option>
            <option disabled>── سلف موظف معيّن ──</option>
            {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </Sel>
        } />
        <Table cols={[{ h: "التاريخ", w: "12%" }, { h: "الفئة", w: "13%" }, { h: "الوصف", w: "21%" }, { h: "القسم", w: "11%" }, { h: "الموظف", w: "13%" }, { h: "المبلغ", w: "12%" }, { h: "الدفع", w: "8%" }, { h: "بواسطة", w: "8%" }]}
          rows={shown.map(e => [arDate(e.date), <Badge tone={CAT_TONE[e.cat] || "g"}>{e.cat}</Badge>, e.desc, e.dept ? <Badge tone="a">{cats[e.dept] || e.dept}</Badge> : <span style={{ color: C.mt, fontSize: 11 }}>عام</span>, e.empName || "—", fmt(e.amount) + " " + cur, e.pay, e.by])} />
        {shown.length === 0 && <div style={{ textAlign: "center", color: C.mt, fontSize: 12, padding: "1.5rem" }}>لا مصاريف مطابقة</div>}
      </Card>
      {modal && <Modal title="إضافة مصروف" onClose={() => setModal(false)} width={470}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="التاريخ"><Inp type="date" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} /></Field>
          <Field label="الفئة"><Sel value={f.cat} onChange={e => setF({ ...f, cat: e.target.value, empId: "" })}>{["أجار", "مرتبات", "كهرباء", "صيانة", "سلفة موظف", "أخرى"].map(c => <option key={c}>{c}</option>)}</Sel></Field>
          {f.cat === "سلفة موظف" && (
            <Field label="الموظف (تُخصم من مرتبه)" full>
              <Sel value={f.empId} onChange={e => setF({ ...f, empId: e.target.value })}>
                <option value="">اختر الموظف...</option>
                {employees.filter(e => e.status === "نشط").map(e => <option key={e.id} value={e.id}>{e.name} — راتب {fmt(e.salary)} {cur}</option>)}
              </Sel>
            </Field>
          )}
          <Field label="الوصف" full><Inp value={f.desc} onChange={e => setF({ ...f, desc: e.target.value })} placeholder={f.cat === "سلفة موظف" ? "سلفة على الراتب" : "وصف المصروف"} /></Field>
          <Field label={"المبلغ (" + cur + ")"}><Inp type="number" value={f.amount} onChange={e => setF({ ...f, amount: e.target.value })} /></Field>
          <Field label="طريقة الدفع"><Sel value={f.pay} onChange={e => setF({ ...f, pay: e.target.value })}>{["نقداً", "تحويل", "بطاقة"].map(p => <option key={p}>{p}</option>)}</Sel></Field>
          <Field label="القسم المرتبط (اختياري)" full>
            <Sel value={f.dept} onChange={e => setF({ ...f, dept: e.target.value })}>
              <option value="">عام — غير مرتبط بقسم مبيعات معيّن</option>
              {Object.entries(cats).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </Sel>
          </Field>
        </div>
        <div style={{ fontSize: 10.5, color: C.mt, marginTop: -6, marginBottom: 10, lineHeight: 1.7 }}>💡 اربط مصاريف التشغيل المباشرة (بن، أكواب، حليب لقسم الكافيه مثلاً) بقسمها — سيُحتسب هذا تلقائياً في تقرير «صافي ربح الأقسام» لمعرفة الربح الحقيقي لكل قسم شاملاً تكاليف تشغيله.</div>
        {f.cat === "سلفة موظف" && f.empId && (() => {
          const emp = employees.find(e => e.id == f.empId);
          const taken = expenses.filter(e => e.empId == f.empId && e.cat === "سلفة موظف").reduce((s, e) => s + e.amount, 0);
          const remain = emp.salary - taken - (parseFloat(f.amount) || 0);
          return <div style={{ background: remain < 0 ? "#fdeaea" : "rgba(26,140,62,.07)", border: `0.5px solid ${remain < 0 ? "rgba(192,57,43,.3)" : "rgba(26,140,62,.2)"}`, borderRadius: 9, padding: ".6rem .85rem", marginBottom: 12, fontSize: 12, lineHeight: 1.9 }}>
            الراتب: <b>{fmt(emp.salary)} {cur}</b> · سلف سابقة: <b>{fmt(taken)} {cur}</b><br />
            المتبقي بعد هذه السلفة: <b style={{ color: remain < 0 ? C.red : C.grn2 }}>{fmt(remain)} {cur}</b>{remain < 0 && " ⚠ تجاوز الراتب!"}
          </div>;
        })()}
        <div style={{ display: "flex", gap: 8 }}><Btn gold onClick={save} style={{ flex: 1, justifyContent: "center" }}>✓ حفظ</Btn><Btn onClick={() => setModal(false)}>إلغاء</Btn></div>
      </Modal>}
    </>
  );
}
