import { useState, useMemo } from "react";
import { C, fmt } from "../constants/theme.js";
import { TYPE_NAME } from "../constants/seeds.js";
import { PageTop, Btn, Field, Sel, Inp, KCard, Card, CardHead, Table, Badge, Modal } from "../components/ui.jsx";
import { todayISO, arDate } from "../utils/format.js";

/* ============================ EMPLOYEE ACTIVITY LOG (سجل حركات الموظفين) ============================ */
export default function EmployeeActivity({ ctx }) {
  const { invoices, purchases, expenses, waste, payments, closings, assets, users, employees, leaves, setLeaves, deductions, setDeductions, auditLog, cancellations, user, showToast } = ctx;
  const cur = ctx.settings?.currency || "د.ل";
  const [emp, setEmp] = useState("");
  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split("T")[0]; });
  const [to, setTo] = useState(todayISO());
  const [typeFilter, setTypeFilter] = useState("");
  const [leaveModal, setLeaveModal] = useState(false);
  const LEAVE_REASONS = ["عطلة سنوية", "إجازة مرضية", "ظرف طارئ", "إجازة بدون راتب", "أخرى"];
  const [leaveForm, setLeaveForm] = useState({ empId: "", date: todayISO(), days: 1, reason: "عطلة سنوية", note: "" });
  const [deductModal, setDeductModal] = useState(false);
  const DEDUCT_REASONS = ["تأخير عن الدوام", "التسبب في مشكلة/ضرر", "مخالفة سياسة النادي", "غياب بدون إذن", "أخرى"];
  const [deductForm, setDeductForm] = useState({ empId: "", date: todayISO(), amount: "", reason: "تأخير عن الدوام", note: "" });

  const leaveEmp = employees.find(e => e.id == leaveForm.empId);
  const leaveDaily = leaveEmp ? Math.round((leaveEmp.salary / 30) * 100) / 100 : 0;
  const leaveDeduction = Math.round(leaveDaily * (parseInt(leaveForm.days) || 0) * 100) / 100;

  const saveLeave = () => {
    if (!leaveForm.empId) { showToast("اختر الموظف"); return; }
    const days = Math.max(1, parseInt(leaveForm.days) || 1);
    const emp2 = employees.find(e => e.id == leaveForm.empId);
    setLeaves(ls => [{ id: "LV-" + Date.now(), empId: emp2.id, empName: emp2.name, date: leaveForm.date, days, reason: leaveForm.reason, note: leaveForm.note.trim(), dailyRate: leaveDaily, deduction: Math.round(leaveDaily * days * 100) / 100, by: user?.name || "—" }, ...ls]);
    showToast(`سُجّلت عطلة ${days} يوم لـ${emp2.name} — خصم ${fmt(Math.round(leaveDaily * days * 100) / 100)} ${cur} من راتبه`);
    setLeaveModal(false); setLeaveForm({ empId: "", date: todayISO(), days: 1, reason: "عطلة سنوية", note: "" });
  };

  const deductEmp = employees.find(e => e.id == deductForm.empId);
  const saveDeduction = () => {
    if (!deductForm.empId) { showToast("اختر الموظف"); return; }
    const amount = parseFloat(deductForm.amount);
    if (!amount || amount <= 0) { showToast("أدخل مبلغاً صحيحاً"); return; }
    const emp2 = employees.find(e => e.id == deductForm.empId);
    setDeductions(ds => [{ id: "DD-" + Date.now(), empId: emp2.id, empName: emp2.name, date: deductForm.date, amount: Math.round(amount * 100) / 100, reason: deductForm.reason, note: deductForm.note.trim(), by: user?.name || "—" }, ...ds]);
    showToast(`سُجّل خصم ${fmt(amount)} ${cur} على ${emp2.name} — ${deductForm.reason}`);
    setDeductModal(false); setDeductForm({ empId: "", date: todayISO(), amount: "", reason: "تأخير عن الدوام", note: "" });
  };

  const TYPE_META = {
    "بيع منتج": { icon: "🛍", tone: "g" },
    "حجز طاولة": { icon: "📅", tone: "b" },
    "توريد مشتريات": { icon: "🛒", tone: "p" },
    "مصروف": { icon: "💵", tone: "a" },
    "سلفة موظف": { icon: "🪪", tone: "a" },
    "عطلة موظف": { icon: "🏖", tone: "a" },
    "خصم/جزاء": { icon: "⚠️", tone: "r" },
    "تأجير جهاز": { icon: "🔌", tone: "p" },
    "رصيد سابق": { icon: "📜", tone: "a" },
    "إتلاف منتج": { icon: "🗑", tone: "r" },
    "قبض من زبون": { icon: "💰", tone: "g" },
    "صرف لمورد": { icon: "💸", tone: "r" },
    "إغلاق يومي": { icon: "🔒", tone: "b" },
    "مورد النادي": { icon: "🏛", tone: "p" },
    "تعديل سعر": { icon: "💲", tone: "a" },
    "تعديل إعدادات": { icon: "⚙", tone: "b" },
    "إلغاء حجز": { icon: "✕", tone: "r" },
    "حذف فاتورة": { icon: "🗑", tone: "r" },
    "تعديل مخزون يدوي": { icon: "📦", tone: "a" },
  };

  const activities = useMemo(() => {
    const list = [];
    (invoices || []).forEach(i => {
      if (!i.by) return;
      list.push({ date: i.date, by: i.by, type: i.source === "حجز" ? "حجز طاولة" : i.source === "تأجير" ? "تأجير جهاز" : i.source === "رصيد سابق" ? "رصيد سابق" : "بيع منتج", detail: `#${i.id} — ${i.details}`, amount: i.total });
    });
    (purchases || []).forEach(p => {
      if (!p.by) return;
      list.push({ date: p.date, by: p.by, type: "توريد مشتريات", detail: `#${p.id} — من ${p.supplier}`, amount: p.total });
    });
    (expenses || []).forEach(e => {
      list.push({ date: e.date, by: e.by, type: e.cat === "سلفة موظف" ? "سلفة موظف" : "مصروف", detail: e.desc + (e.empName ? ` — ${e.empName}` : ""), amount: e.amount });
    });
    (waste || []).forEach(w => {
      list.push({ date: w.date, by: w.by, type: "إتلاف منتج", detail: `${w.name} ×${w.qty} — ${w.reason}`, amount: w.cost });
    });
    (payments || []).forEach(p => {
      list.push({ date: p.date, by: p.by, type: p.kind === "قبض" ? "قبض من زبون" : "صرف لمورد", detail: `${p.party} — ${p.via}`, amount: p.amount });
    });
    (closings || []).forEach(c => {
      list.push({ date: c.date, by: c.closedBy, type: "إغلاق يومي", detail: c.status === "match" ? "مطابقة تامة ✓" : c.status === "shortage" ? `عجز ${fmt(Math.abs(c.diff))} ${cur}` : `زيادة ${fmt(c.diff)} ${cur}`, amount: c.actual?.total || null });
    });
    (assets || []).forEach(a => (a.history || []).forEach(h => {
      if (!h.by) return;
      list.push({ date: h.date, by: h.by, type: "مورد النادي", detail: `${h.event} — ${a.name}${h.note && h.note !== "—" ? " (" + h.note + ")" : ""}`, amount: h.cost || null });
    }));
    (leaves || []).forEach(l => {
      list.push({ date: l.date, by: l.by, type: "عطلة موظف", detail: `${l.empName} — ${l.days} يوم (${l.reason})${l.note ? " — " + l.note : ""}`, amount: l.deduction });
    });
    (deductions || []).forEach(d => {
      list.push({ date: d.date, by: d.by, type: "خصم/جزاء", detail: `${d.empName} — ${d.reason}${d.note ? " — " + d.note : ""}`, amount: d.amount });
    });
    (auditLog || []).forEach(a => {
      list.push({ date: a.date, by: a.by, type: a.type, detail: a.detail, amount: null });
    });
    (cancellations || []).forEach(c => {
      list.push({ date: c.date, by: c.by, type: "إلغاء حجز", detail: `${c.customer} — ${TYPE_NAME[c.resType] || c.resType} — ${c.reason}${c.note ? " (" + c.note + ")" : ""}`, amount: null });
    });
    return list.filter(x => x.by).sort((a, b) => b.date.localeCompare(a.date));
  }, [invoices, purchases, expenses, waste, payments, closings, assets, leaves, deductions, auditLog, cancellations]);

  const inRange = (d) => d >= from && d <= to;
  const shown = activities.filter(a => inRange(a.date) && (!emp || a.by === emp) && (!typeFilter || a.type === typeFilter));

  const byEmpCount = {};
  activities.filter(a => inRange(a.date)).forEach(a => { byEmpCount[a.by] = (byEmpCount[a.by] || 0) + 1; });
  const activeDays = new Set(shown.map(a => a.date)).size;
  const totalAmount = shown.reduce((s, a) => s + (a.amount || 0), 0);
  const activityTypes = [...new Set(activities.map(a => a.type))];

  return (
    <>
      <PageTop title="سجل حركات الموظفين" action={
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
          <Btn danger onClick={() => { setDeductForm({ empId: "", date: todayISO(), amount: "", reason: "تأخير عن الدوام", note: "" }); setDeductModal(true); }}>⚠️ خصم من موظف</Btn>
          <Btn gold onClick={() => { setLeaveForm({ empId: "", date: todayISO(), days: 1, reason: "عطلة سنوية", note: "" }); setLeaveModal(true); }}>🏖 + إضافة عطلة</Btn>
        </div>
      } />

      <div style={{ background: C.cd, border: `0.5px solid ${C.bc}`, borderRadius: 12, padding: ".9rem 1rem", marginBottom: "1rem", display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap" }}>
        <Field label="الموظف">
          <Sel value={emp} onChange={e => setEmp(e.target.value)} style={{ minWidth: 150 }}>
            <option value="">كل الموظفين</option>
            {users.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
          </Sel>
        </Field>
        <Field label="نوع الحركة">
          <Sel value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ minWidth: 150 }}>
            <option value="">كل الحركات</option>
            {activityTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </Sel>
        </Field>
        <Field label="من تاريخ"><Inp type="date" value={from} onChange={e => setFrom(e.target.value)} /></Field>
        <Field label="إلى تاريخ"><Inp type="date" value={to} onChange={e => setTo(e.target.value)} /></Field>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 11, marginBottom: "1.1rem" }}>
        <KCard label="عدد الحركات" value={shown.length} sub={emp || "كل الموظفين"} bar={C.gold} />
        <KCard label="أيام النشاط" value={activeDays} sub="ضمن الفترة" bar="#2a78d6" />
        <KCard label="القيمة الإجمالية" value={fmt(totalAmount)} sub={cur} bar="#1a8c3e" />
      </div>

      {/* لمحة سريعة: عدد الحركات لكل موظف */}
      {!emp && Object.keys(byEmpCount).length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          {Object.entries(byEmpCount).sort((a, b) => b[1] - a[1]).map(([n, c]) => (
            <span key={n} onClick={() => setEmp(n)} style={{ cursor: "pointer", fontSize: 11.5, fontWeight: 600, padding: ".35rem .85rem", borderRadius: 20, background: C.crm, color: C.k2, border: `0.5px solid ${C.bc}` }}>👤 {n} ({c})</span>
          ))}
        </div>
      )}

      <Card>
        <CardHead title="سجل الحركات" sub={`${shown.length} حركة — من الأحدث`} />
        {shown.length === 0 ? (
          <div style={{ textAlign: "center", color: C.mt, fontSize: 12.5, padding: "2rem" }}>لا حركات مطابقة ضمن الفلاتر المختارة.</div>
        ) : (
          <Table cols={[{ h: "التاريخ", w: "12%" }, { h: "الموظف", w: "16%" }, { h: "نوع الحركة", w: "17%" }, { h: "التفاصيل", w: "38%" }, { h: "القيمة", w: "17%" }]}
            rows={shown.map((a, i) => {
              const meta = TYPE_META[a.type] || { icon: "•", tone: "g" };
              return [arDate(a.date), <span style={{ display: "flex", alignItems: "center", gap: 5 }}>👤 {a.by}</span>, <Badge tone={meta.tone}>{meta.icon} {a.type}</Badge>, a.detail, a.amount != null ? fmt(a.amount) + " " + cur : "—"];
            })} />
        )}
      </Card>

      {/* نافذة إضافة عطلة */}
      {leaveModal && (
        <Modal title="إضافة عطلة لموظف" onClose={() => setLeaveModal(false)} width={460}>
          <Field label="الموظف *">
            <Sel value={leaveForm.empId} onChange={e => setLeaveForm({ ...leaveForm, empId: e.target.value })}>
              <option value="">اختر الموظف...</option>
              {employees.filter(e => e.status === "نشط").map(e => <option key={e.id} value={e.id}>{e.name} — راتب {fmt(e.salary)} {cur}</option>)}
            </Sel>
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="عدد أيام العطلة"><Inp type="number" min="1" value={leaveForm.days} onChange={e => setLeaveForm({ ...leaveForm, days: e.target.value })} /></Field>
            <Field label="تاريخ العطلة"><Inp type="date" value={leaveForm.date} onChange={e => setLeaveForm({ ...leaveForm, date: e.target.value })} /></Field>
          </div>
          <Field label="السبب"><Sel value={leaveForm.reason} onChange={e => setLeaveForm({ ...leaveForm, reason: e.target.value })}>{LEAVE_REASONS.map(r => <option key={r}>{r}</option>)}</Sel></Field>
          <Field label="ملاحظة (اختياري)"><Inp value={leaveForm.note} onChange={e => setLeaveForm({ ...leaveForm, note: e.target.value })} placeholder="أي تفاصيل إضافية" /></Field>
          {leaveEmp && (
            <div style={{ background: "rgba(201,168,76,.1)", border: "0.5px solid rgba(201,168,76,.3)", borderRadius: 9, padding: ".6rem .85rem", margin: ".4rem 0 1rem", fontSize: 12.5, lineHeight: 1.9 }}>
              الأجر اليومي: <b>{fmt(leaveDaily)} {cur}</b> (الراتب ÷ 30)<br />
              خصم هذه العطلة: <b style={{ color: C.red }}>{fmt(leaveDeduction)} {cur}</b> من راتب {leaveEmp.name}
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}><Btn gold onClick={saveLeave} style={{ flex: 1, justifyContent: "center" }}>✓ تسجيل العطلة والخصم</Btn><Btn onClick={() => setLeaveModal(false)}>إلغاء</Btn></div>
        </Modal>
      )}

      {/* نافذة خصم/جزاء */}
      {deductModal && (
        <Modal title="خصم من راتب موظف" onClose={() => setDeductModal(false)} width={460}>
          <Field label="الموظف *">
            <Sel value={deductForm.empId} onChange={e => setDeductForm({ ...deductForm, empId: e.target.value })}>
              <option value="">اختر الموظف...</option>
              {employees.filter(e => e.status === "نشط").map(e => <option key={e.id} value={e.id}>{e.name} — راتب {fmt(e.salary)} {cur}</option>)}
            </Sel>
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label={"مبلغ الخصم (" + cur + ") *"}><Inp type="number" min="0" value={deductForm.amount} onChange={e => setDeductForm({ ...deductForm, amount: e.target.value })} placeholder="0" /></Field>
            <Field label="التاريخ"><Inp type="date" value={deductForm.date} onChange={e => setDeductForm({ ...deductForm, date: e.target.value })} /></Field>
          </div>
          <Field label="السبب"><Sel value={deductForm.reason} onChange={e => setDeductForm({ ...deductForm, reason: e.target.value })}>{DEDUCT_REASONS.map(r => <option key={r}>{r}</option>)}</Sel></Field>
          <Field label="ملاحظة (اختياري)"><Inp value={deductForm.note} onChange={e => setDeductForm({ ...deductForm, note: e.target.value })} placeholder="أي تفاصيل إضافية" /></Field>
          {deductEmp && deductForm.amount > 0 && (
            <div style={{ background: "#fdeaea", border: "0.5px solid rgba(192,57,43,.3)", borderRadius: 9, padding: ".6rem .85rem", margin: ".4rem 0 1rem", fontSize: 12.5, lineHeight: 1.9 }}>
              سيُخصم <b style={{ color: C.red }}>{fmt(parseFloat(deductForm.amount) || 0)} {cur}</b> من راتب <b>{deductEmp.name}</b> فوراً.
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}><Btn danger onClick={saveDeduction} style={{ flex: 1, justifyContent: "center" }}>✓ تسجيل الخصم</Btn><Btn onClick={() => setDeductModal(false)}>إلغاء</Btn></div>
        </Modal>
      )}
    </>
  );
}
