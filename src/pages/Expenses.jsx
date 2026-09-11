import { useState } from "react";
import { C, fmt } from "../constants/theme.js";
import { PageTop, Btn, KCard, Card, CardHead, Sel, Table, Badge, Modal, Field, Inp, inputStyle } from "../components/ui.jsx";
import { todayISO, arDate } from "../utils/format.js";
import { rangePreset, QUICK_RANGES } from "../utils/analytics.js";
import { downloadCsv, downloadExcel } from "../utils/exportTable.js";

const emptyForm = { date: todayISO(), cat: "أجار", desc: "", amount: "", pay: "نقداً", empId: "", dept: "", supplierId: "", recurring: false };

/* ============================ EXPENSES ============================ */
export default function Expenses({ ctx }) {
  const { expenses, setExpenses, employees, suppliers, user, showToast, confirm, cats } = ctx;
  const cur = ctx.settings?.currency || "د.ل";
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null); // مصروف قيد التعديل — null يعني إضافة جديد
  const [empFilter, setEmpFilter] = useState("all");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;
  const applyQuickRange = (key) => { const r = rangePreset(key); setFrom(r.from); setTo(r.to); setPage(1); };
  const [f, setF] = useState(emptyForm);

  const openAdd = () => { setEditing(null); setF(emptyForm); setModal(true); };
  const openEdit = (e) => {
    setEditing(e);
    setF({ date: e.date, cat: e.cat, desc: e.desc, amount: String(e.amount), pay: e.pay, empId: e.empId ? String(e.empId) : "", dept: e.dept || "", supplierId: e.supplierId ? String(e.supplierId) : "", recurring: !!e.recurring });
    setModal(true);
  };

  // حظر فعلي لسلفة تتجاوز الراتب المتبقي — كان تحذيراً مرئياً فقط بلا أي منع
  const advanceRemain = (empId, amount, excludeId) => {
    const emp = employees.find(x => x.id == empId);
    if (!emp) return null;
    const taken = expenses.filter(x => x.empId == empId && x.cat === "سلفة موظف" && x.id !== excludeId).reduce((s, x) => s + x.amount, 0);
    return emp.salary - taken - amount;
  };

  const save = () => {
    if (!f.desc.trim() || !f.amount) { showToast("أدخل الوصف والمبلغ"); return; }
    const isEmp = f.cat === "سلفة موظف" && f.empId;
    const emp = isEmp ? employees.find(e => e.id == f.empId) : null;
    const amount = parseFloat(f.amount);
    if (isEmp) {
      const remain = advanceRemain(f.empId, amount, editing?.id);
      if (remain != null && remain < 0) { showToast(`السلفة تتجاوز الراتب المتبقي بـ ${fmt(Math.abs(remain))} ${cur} — قلّل المبلغ`); return; }
    }
    const supplier = f.supplierId ? suppliers.find(s => String(s.id) === String(f.supplierId)) : null;
    if (editing) {
      setExpenses(ex => ex.map(x => x.id === editing.id ? {
        ...x, date: f.date, cat: f.cat, desc: f.desc, amount, pay: f.pay,
        empId: isEmp ? parseInt(f.empId) : null, empName: emp ? emp.name : null,
        dept: f.dept || null, supplierId: supplier ? supplier.id : null, supplierName: supplier ? supplier.name : null,
        recurring: f.recurring,
      } : x));
      showToast("تم تحديث المصروف");
    } else {
      setExpenses(e => [{
        id: Math.max(0, ...e.map(x => x.id)) + 1, date: f.date, cat: f.cat, desc: f.desc, amount, pay: f.pay, by: user.name.split(" ")[0],
        empId: isEmp ? parseInt(f.empId) : null, empName: emp ? emp.name : null, dept: f.dept || null,
        supplierId: supplier ? supplier.id : null, supplierName: supplier ? supplier.name : null,
        recurring: f.recurring,
      }, ...e]);
      showToast(isEmp ? `تم تسجيل سلفة ${fmt(amount)} ${cur} على ${emp.name}` : "تمت إضافة المصروف");
    }
    setModal(false); setEditing(null); setF(emptyForm);
  };
  const deleteExpense = async (e) => {
    if (!(await confirm(`حذف مصروف «${e.desc}» بقيمة ${fmt(e.amount)} ${cur} نهائياً؟`, { danger: true }))) return;
    setExpenses(ex => ex.filter(x => x.id !== e.id));
    showToast("تم حذف المصروف");
  };
  const byCat = (c) => expenses.filter(e => e.cat === c).reduce((s, e) => s + e.amount, 0);
  const CAT_TONE = { "أجار": "b", "مرتبات": "gold", "كهرباء": "r", "صيانة": "g", "سلفة موظف": "p", "شراء موارد": "gold", "أخرى": "a" };
  const byEmp = empFilter === "all" ? expenses : empFilter === "none" ? expenses.filter(e => !e.empId) : expenses.filter(e => e.empId == empFilter);
  const shown = byEmp.filter(e =>
    (!q || e.desc.includes(q) || e.cat.includes(q) || (e.empName || "").includes(q) || (e.supplierName || "").includes(q)) &&
    (!from || e.date >= from) && (!to || e.date <= to)
  );
  const totalPages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pageRows = shown.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);
  const exportSheet = () => [{
    name: "المصاريف",
    thead: ["التاريخ", "الفئة", "الوصف", "القسم", "الموظف", "المورد", "المبلغ", "الدفع", "بواسطة"],
    tbody: shown.map(e => [e.date, e.cat, e.desc, e.dept ? (cats[e.dept] || e.dept) : "عام", e.empName || "—", e.supplierName || "—", e.amount, e.pay, e.by]),
  }];

  // تذكير بمصاريف متكرِّرة (كالإيجار الشهري) لم تُسجَّل بعد هذا الشهر — كان
  // على المستخدم تذكّر إعادة إدخالها يدوياً كل شهر من الصفر بلا أي تنبيه
  const thisMonthKey = todayISO().slice(0, 7);
  const recurringDue = (() => {
    const byKey = {};
    expenses.filter(e => e.recurring).forEach(e => {
      const key = e.cat + "|" + e.desc;
      if (!byKey[key] || byKey[key].date < e.date) byKey[key] = e;
    });
    return Object.values(byKey).filter(e => e.date.slice(0, 7) !== thisMonthKey);
  })();
  const registerRecurring = (tpl) => {
    setExpenses(e => [{ ...tpl, id: Math.max(0, ...e.map(x => x.id)) + 1, date: todayISO(), by: user.name.split(" ")[0] }, ...e]);
    showToast(`تم تسجيل «${tpl.desc}» لهذا الشهر`);
  };

  return (
    <>
      <PageTop title="نظام المصاريف" action={<Btn gold onClick={openAdd}>+ إضافة مصروف</Btn>} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 11, marginBottom: "1.1rem" }}>
        <KCard label="أجار الموقع" value={fmt(byCat("أجار"))} sub="شهري" bar="#2a78d6" />
        <KCard label="سلف الموظفين" value={fmt(byCat("سلفة موظف"))} sub={cur} bar={C.purp} />
        <KCard label="الصيانة" value={fmt(byCat("صيانة"))} bar={C.red} />
        <KCard label="إجمالي المصاريف" value={fmt(expenses.reduce((s, e) => s + e.amount, 0))} sub={cur} bar={C.gold} />
      </div>

      {recurringDue.length > 0 && (
        <div style={{ background: "linear-gradient(135deg,#fff7eb,#fff)", border: `1px solid ${C.gold}`, borderRadius: 12, padding: ".8rem 1rem", marginBottom: "1rem", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 12.5, color: C.gdd, fontWeight: 700 }}>🔁 مصاريف متكرِّرة لم تُسجَّل بعد هذا الشهر</div>
          {recurringDue.map(tpl => (
            <div key={tpl.cat + "|" + tpl.desc} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, fontSize: 12.5 }}>
              <span>{tpl.desc} — <b>{fmt(tpl.amount)} {cur}</b> <span style={{ color: C.mt, fontSize: 11 }}>(آخر تسجيل: {arDate(tpl.date)})</span></span>
              <Btn sm gold onClick={() => registerRecurring(tpl)}>+ تسجيله لهذا الشهر</Btn>
            </div>
          ))}
        </div>
      )}

      <Card>
        <CardHead title="سجل المصاريف" sub={`${fmt(shown.length)} من ${fmt(expenses.length)} إجمالاً`} right={
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <input value={q} onChange={e => { setQ(e.target.value); setPage(1); }} placeholder="بحث بالوصف أو الفئة..." style={{ ...inputStyle, width: 170 }} />
            <Sel value={empFilter} onChange={e => { setEmpFilter(e.target.value); setPage(1); }} style={{ width: 160 }}>
              <option value="all">كل المصاريف</option>
              <option value="none">مصاريف عامة فقط</option>
              <option disabled>── سلف موظف معيّن ──</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </Sel>
          </div>
        } />
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center", marginBottom: ".8rem", paddingBottom: ".8rem", borderBottom: `0.5px solid ${C.bc}` }}>
          <Sel value="" onChange={e => e.target.value && applyQuickRange(e.target.value)} style={{ width: 130 }}>
            <option value="">— نطاق سريع —</option>
            {QUICK_RANGES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </Sel>
          <input type="date" value={from} onChange={e => { setFrom(e.target.value); setPage(1); }} aria-label="من تاريخ" style={{ ...inputStyle, width: 145 }} />
          <input type="date" value={to} onChange={e => { setTo(e.target.value); setPage(1); }} aria-label="إلى تاريخ" style={{ ...inputStyle, width: 145 }} />
          {(from || to || q) && <Btn sm onClick={() => { setFrom(""); setTo(""); setQ(""); setPage(1); }}>✕ مسح الفلاتر</Btn>}
          <div style={{ flex: 1 }} />
          <Btn sm onClick={() => downloadCsv(exportSheet(), `المصاريف-${from || "الكل"}-${to || todayISO()}`)}>⬇ CSV</Btn>
          <Btn sm onClick={() => downloadExcel(exportSheet(), `المصاريف-${from || "الكل"}-${to || todayISO()}`)}>📊 Excel</Btn>
        </div>
        <Table cols={[{ h: "التاريخ", w: "10%" }, { h: "الفئة", w: "11%" }, { h: "الوصف", w: "17%" }, { h: "القسم", w: "9%" }, { h: "الموظف", w: "10%" }, { h: "المورد", w: "10%" }, { h: "المبلغ", w: "10%" }, { h: "الدفع", w: "7%" }, { h: "بواسطة", w: "7%" }, { h: "إجراءات", w: "9%" }]}
          rows={pageRows.map(e => [
            arDate(e.date), <Badge tone={CAT_TONE[e.cat] || "g"}>{e.cat}{e.recurring ? " 🔁" : ""}</Badge>, e.desc,
            e.dept ? <Badge tone="a">{cats[e.dept] || e.dept}</Badge> : <span style={{ color: C.mt, fontSize: 11 }}>عام</span>,
            e.empName || "—", e.supplierName || "—", fmt(e.amount) + " " + cur, e.pay, e.by,
            <div style={{ display: "flex", gap: 4 }}><Btn sm onClick={() => openEdit(e)}>✎</Btn><Btn sm danger onClick={() => deleteExpense(e)}>🗑</Btn></div>,
          ])} />
        {shown.length === 0 && <div style={{ textAlign: "center", color: C.mt, fontSize: 12, padding: "1.5rem" }}>لا مصاريف مطابقة</div>}
        {totalPages > 1 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 12, paddingTop: 10, borderTop: `0.5px solid ${C.bc}` }}>
            <Btn sm onClick={() => setPage(p => Math.max(1, p - 1))} style={{ opacity: pageSafe === 1 ? .4 : 1 }}>‹ السابق</Btn>
            <span style={{ fontSize: 12, color: C.mt }}>صفحة {pageSafe} من {totalPages}</span>
            <Btn sm onClick={() => setPage(p => Math.min(totalPages, p + 1))} style={{ opacity: pageSafe === totalPages ? .4 : 1 }}>التالي ›</Btn>
          </div>
        )}
      </Card>
      {modal && <Modal title={editing ? `تعديل مصروف — ${editing.desc}` : "إضافة مصروف"} onClose={() => { setModal(false); setEditing(null); }} width={470}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="التاريخ"><Inp type="date" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} /></Field>
          <Field label="الفئة"><Sel value={f.cat} onChange={e => setF({ ...f, cat: e.target.value, empId: "" })}>{["أجار", "مرتبات", "كهرباء", "صيانة", "سلفة موظف", "شراء موارد", "أخرى"].map(c => <option key={c}>{c}</option>)}</Sel></Field>
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
          <Field label="المورد المرتبط (اختياري)" full>
            <Sel value={f.supplierId} onChange={e => setF({ ...f, supplierId: e.target.value })}>
              <option value="">بلا مورد محدد</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Sel>
          </Field>
        </div>
        <div style={{ fontSize: 10.5, color: C.mt, marginTop: -6, marginBottom: 10, lineHeight: 1.7 }}>💡 اربط مصاريف التشغيل المباشرة (بن، أكواب، حليب لقسم الكافيه مثلاً) بقسمها — سيُحتسب هذا تلقائياً في تقرير «صافي ربح الأقسام» لمعرفة الربح الحقيقي لكل قسم شاملاً تكاليف تشغيله. وربط المصروف بمورد يتيح متابعة إجمالي التعامل معه خارج فواتير التوريد الرسمية.</div>
        <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, marginBottom: 10, cursor: "pointer" }}>
          <input type="checkbox" checked={f.recurring} onChange={e => setF({ ...f, recurring: e.target.checked })} />
          🔁 مصروف متكرِّر شهرياً (كالإيجار) — يُذكّرك النظام إن لم يُسجَّل في شهر لاحق
        </label>
        {f.cat === "سلفة موظف" && f.empId && (() => {
          const emp = employees.find(e => e.id == f.empId);
          const taken = expenses.filter(e => e.empId == f.empId && e.cat === "سلفة موظف" && e.id !== editing?.id).reduce((s, e) => s + e.amount, 0);
          const remain = emp.salary - taken - (parseFloat(f.amount) || 0);
          return <div style={{ background: remain < 0 ? "#fdeaea" : "rgba(26,140,62,.07)", border: `0.5px solid ${remain < 0 ? "rgba(192,57,43,.3)" : "rgba(26,140,62,.2)"}`, borderRadius: 9, padding: ".6rem .85rem", marginBottom: 12, fontSize: 12, lineHeight: 1.9 }}>
            الراتب: <b>{fmt(emp.salary)} {cur}</b> · سلف سابقة: <b>{fmt(taken)} {cur}</b><br />
            المتبقي بعد هذه السلفة: <b style={{ color: remain < 0 ? C.red : C.grn2 }}>{fmt(remain)} {cur}</b>{remain < 0 && " ⚠ تتجاوز الراتب — لن يُقبل الحفظ"}
          </div>;
        })()}
        <div style={{ display: "flex", gap: 8 }}><Btn gold onClick={save} style={{ flex: 1, justifyContent: "center" }}>✓ {editing ? "حفظ التعديلات" : "حفظ"}</Btn><Btn onClick={() => { setModal(false); setEditing(null); }}>إلغاء</Btn></div>
      </Modal>}
    </>
  );
}
