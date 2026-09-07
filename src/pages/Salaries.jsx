import { useState } from "react";
import { C, fmt } from "../constants/theme.js";
import { PageTop, Btn, KCard, Card, Table, Modal, Field, Inp } from "../components/ui.jsx";
import { todayISO, arDate } from "../utils/format.js";

/* ============================ SALARIES ============================ */
export default function Salaries({ ctx }) {
  const { employees, setEmployees, expenses, setExpenses, leaves, setLeaves, deductions, setDeductions, invoices, setInvoices, showToast, confirm } = ctx;
  const cur = ctx.settings?.currency || "د.ل";
  const [modal, setModal] = useState(false);
  const [detail, setDetail] = useState(null); // employee id being viewed
  const [f, setF] = useState({ name: "", role: "", salary: "", salaryStart: todayISO() });

  const save = () => {
    if (!f.name.trim() || !f.salary) { showToast("أدخل الاسم والراتب"); return; }
    setEmployees(e => [...e, { id: Math.max(0, ...e.map(x => x.id)) + 1, name: f.name, role: f.role || "موظف", hired: f.salaryStart, salaryStart: f.salaryStart, salary: parseFloat(f.salary), status: "نشط" }]);
    showToast("تمت إضافة الموظف"); setModal(false); setF({ name: "", role: "", salary: "", salaryStart: todayISO() });
  };

  // سلف الموظف من المصاريف
  const advancesOf = (id) => expenses.filter(e => e.empId == id && e.cat === "سلفة موظف");
  const takenOf = (id) => advancesOf(id).reduce((s, e) => s + e.amount, 0);
  // خصومات العطلات والإجازات
  const leavesOf = (id) => (leaves || []).filter(l => l.empId == id);
  const leaveDeductOf = (id) => leavesOf(id).reduce((s, l) => s + l.deduction, 0);
  // خصومات وجزاءات (تأخير، مخالفات...)
  const deductionsOf = (id) => (deductions || []).filter(d => d.empId == id);
  const deductionAmountOf = (id) => deductionsOf(id).reduce((s, d) => s + d.amount, 0);
  // مشتريات من نقطة البيع على حساب الراتب (لم تُسوَّ بعد في دورة راتب سابقة)
  const purchasesOf = (id) => invoices.filter(i => i.empId == id && i.pay === "موظف" && !i.salarySettled);
  const purchasesAmountOf = (id) => purchasesOf(id).reduce((s, i) => s + i.total, 0);
  const remainOf = (emp) => emp.salary - takenOf(emp.id) - leaveDeductOf(emp.id) - deductionAmountOf(emp.id) - purchasesAmountOf(emp.id);

  // تصفية راتب الموظف (نهاية الشهر): صرف المتبقي كمصروف وتصفير السلف والعطلات والخصومات ومشتريات نقطة البيع
  const settle = async (emp) => {
    const remain = remainOf(emp);
    const leaveDed = leaveDeductOf(emp.id);
    const penaltyDed = deductionAmountOf(emp.id);
    const purchDed = purchasesAmountOf(emp.id);
    if (!(await confirm(`تصفية راتب ${emp.name}؟\nالراتب: ${fmt(emp.salary)} ${cur}\nالسلف المسحوبة: ${fmt(takenOf(emp.id))} ${cur}\nخصم العطلات: ${fmt(leaveDed)} ${cur}\nخصومات وجزاءات: ${fmt(penaltyDed)} ${cur}\nمشتريات نقطة البيع: ${fmt(purchDed)} ${cur}\nالمتبقي للصرف: ${fmt(remain)} ${cur}\n\nسيُسجّل المتبقي كمصروف مرتب وتبدأ دورة جديدة.`))) return;
    // سجّل صرف باقي الراتب كمصروف
    if (remain > 0) {
      setExpenses(ex => [{ id: Math.max(0, ...ex.map(x => x.id)) + 1, date: todayISO(), cat: "مرتبات", desc: `صرف باقي راتب ${emp.name}`, amount: remain, pay: "نقداً", by: "المدير", empId: null, empName: null }, ...ex]);
    }
    // احذف سلف هذا الموظف وعطلاته وخصوماته المسجّلة (تصفير الدورة)، وعلِّم مشترياته كمُسوّاة (تبقى الفواتير نفسها بلا حذف — سجلات بيع حقيقية)
    setExpenses(ex => ex.filter(e => !(e.empId == emp.id && e.cat === "سلفة موظف")));
    setLeaves(ls => ls.filter(l => l.empId != emp.id));
    setDeductions(ds => ds.filter(d => d.empId != emp.id));
    setInvoices(iv => iv.map(i => (i.empId == emp.id && i.pay === "موظف" && !i.salarySettled) ? { ...i, salarySettled: true } : i));
    setEmployees(es => es.map(e => e.id === emp.id ? { ...e, salaryStart: todayISO() } : e));
    showToast(`تمت تصفية راتب ${emp.name} وبدء دورة جديدة`);
    setDetail(null);
  };

  const totalSalaries = employees.reduce((s, e) => s + e.salary, 0);
  const totalRemain = employees.reduce((s, e) => s + remainOf(e), 0);

  return (
    <>
      <PageTop title="مرتبات العمال" action={<Btn gold onClick={() => setModal(true)}>+ إضافة موظف</Btn>} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 11, marginBottom: "1.1rem" }}>
        <KCard label="عدد الموظفين" value={employees.length} sub="نشط" bar="#2a78d6" />
        <KCard label="إجمالي الرواتب" value={fmt(totalSalaries)} sub={cur + " شهرياً"} bar={C.gold} />
        <KCard label="المتبقي للصرف" value={fmt(totalRemain)} sub="بعد السلف" bar="#1a8c3e" />
      </div>

      {/* بطاقات الموظفين */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(270px,1fr))", gap: 12 }}>
        {employees.length === 0 && <Card><div style={{ textAlign: "center", color: C.mt, padding: "1.5rem" }}>لا موظفون بعد — أضف أول موظف.</div></Card>}
        {employees.map(emp => {
          const taken = takenOf(emp.id);
          const remain = remainOf(emp);
          const pct = emp.salary ? Math.max(0, Math.min(100, Math.round(remain / emp.salary * 100))) : 0;
          return (
            <Card key={emp.id} className="nk-card-hover">
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: C.grl, color: "#fff", fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{emp.name.slice(0, 2)}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{emp.name}</div>
                  <div style={{ fontSize: 11, color: C.mt }}>{emp.role} · منذ {arDate(emp.salaryStart)}</div>
                </div>
              </div>

              {/* شريط الراتب المتبقي */}
              <div style={{ marginBottom: 6, display: "flex", justifyContent: "space-between", fontSize: 11.5 }}>
                <span style={{ color: C.mt }}>المتبقي من الراتب</span>
                <span style={{ fontWeight: 700, color: remain < 0 ? C.red : C.grn2 }}>{fmt(remain)} / {fmt(emp.salary)} {cur}</span>
              </div>
              <div style={{ height: 9, borderRadius: 5, background: "#eee", overflow: "hidden", marginBottom: 10 }}>
                <div style={{ width: pct + "%", height: "100%", background: pct < 25 ? "#e34948" : pct < 60 ? C.gold : "#1a8c3e", transition: "width .3s" }} />
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, marginBottom: 4 }}><span style={{ color: C.mt }}>الراتب الأساسي</span><span style={{ fontWeight: 600 }}>{fmt(emp.salary)} {cur}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, marginBottom: 4 }}><span style={{ color: C.mt }}>السلف المسحوبة</span><span style={{ fontWeight: 600, color: C.purp }}>− {fmt(taken)} {cur}</span></div>
              {leaveDeductOf(emp.id) > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, marginBottom: 4 }}><span style={{ color: C.mt }}>خصم العطلات ({leavesOf(emp.id).reduce((s, l) => s + l.days, 0)} يوم)</span><span style={{ fontWeight: 600, color: "#8a6a20" }}>− {fmt(leaveDeductOf(emp.id))} {cur}</span></div>}
              {deductionAmountOf(emp.id) > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, marginBottom: 4 }}><span style={{ color: C.mt }}>خصومات وجزاءات ({deductionsOf(emp.id).length})</span><span style={{ fontWeight: 600, color: C.red }}>− {fmt(deductionAmountOf(emp.id))} {cur}</span></div>}
              {purchasesAmountOf(emp.id) > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, marginBottom: 4 }}><span style={{ color: C.mt }}>مشتريات نقطة البيع ({purchasesOf(emp.id).length})</span><span style={{ fontWeight: 600, color: C.blue }}>− {fmt(purchasesAmountOf(emp.id))} {cur}</span></div>}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, paddingTop: 6, borderTop: `0.5px solid ${C.bc}`, marginTop: 4 }}><span style={{ fontWeight: 700 }}>الصافي المتبقي</span><span style={{ fontWeight: 800, color: remain < 0 ? C.red : C.grn2 }}>{fmt(remain)} {cur}</span></div>

              <div style={{ display: "flex", gap: 7, marginTop: 12 }}>
                <Btn sm onClick={() => setDetail(emp.id)} style={{ flex: 1, justifyContent: "center" }}>📋 التفاصيل ({advancesOf(emp.id).length + leavesOf(emp.id).length + deductionsOf(emp.id).length + purchasesOf(emp.id).length})</Btn>
                <Btn sm gold onClick={() => settle(emp)} style={{ flex: 1, justifyContent: "center" }}>💰 تصفية</Btn>
              </div>
            </Card>
          );
        })}
      </div>

      {/* نافذة تفاصيل السلف والعطلات والخصومات */}
      {detail && (() => {
        const emp = employees.find(e => e.id === detail);
        const advs = advancesOf(detail);
        const lvs = leavesOf(detail);
        const dds = deductionsOf(detail);
        const purchs = purchasesOf(detail);
        return (
          <Modal title={`تفاصيل الراتب — ${emp.name}`} onClose={() => setDetail(null)} width={580}>
            <div style={{ background: C.crm, borderRadius: 10, padding: ".8rem 1rem", marginBottom: 12, display: "flex", justifyContent: "space-around", textAlign: "center", flexWrap: "wrap", gap: 8 }}>
              <div><div style={{ fontSize: 16, fontWeight: 800, color: C.grn2 }}>{fmt(emp.salary)}</div><div style={{ fontSize: 10.5, color: C.mt }}>الراتب</div></div>
              <div><div style={{ fontSize: 16, fontWeight: 800, color: C.purp }}>{fmt(takenOf(detail))}</div><div style={{ fontSize: 10.5, color: C.mt }}>السلف</div></div>
              <div><div style={{ fontSize: 16, fontWeight: 800, color: "#8a6a20" }}>{fmt(leaveDeductOf(detail))}</div><div style={{ fontSize: 10.5, color: C.mt }}>خصم العطلات</div></div>
              <div><div style={{ fontSize: 16, fontWeight: 800, color: C.red }}>{fmt(deductionAmountOf(detail))}</div><div style={{ fontSize: 10.5, color: C.mt }}>خصومات وجزاءات</div></div>
              <div><div style={{ fontSize: 16, fontWeight: 800, color: C.blue }}>{fmt(purchasesAmountOf(detail))}</div><div style={{ fontSize: 10.5, color: C.mt }}>مشتريات نقطة البيع</div></div>
              <div><div style={{ fontSize: 16, fontWeight: 800, color: remainOf(emp) < 0 ? C.red : "#1a8c3e" }}>{fmt(remainOf(emp))}</div><div style={{ fontSize: 10.5, color: C.mt }}>المتبقي</div></div>
            </div>

            <div style={{ fontSize: 12.5, fontWeight: 700, color: C.grn2, marginBottom: 6 }}>💰 السلف</div>
            {advs.length === 0 ? <div style={{ textAlign: "center", color: C.mt, fontSize: 12, padding: "1rem" }}>لا سلف مسجّلة.</div> : (
              <Table cols={[{ h: "التاريخ", w: "25%" }, { h: "الوصف", w: "45%" }, { h: "المبلغ", w: "30%" }]}
                rows={advs.map(a => [arDate(a.date), a.desc, fmt(a.amount) + " " + cur])} />
            )}

            <div style={{ fontSize: 12.5, fontWeight: 700, color: C.grn2, margin: "1rem 0 6px" }}>🏖 العطلات والإجازات</div>
            {lvs.length === 0 ? <div style={{ textAlign: "center", color: C.mt, fontSize: 12, padding: "1rem" }}>لا عطلات مسجّلة لهذه الدورة.</div> : (
              <Table cols={[{ h: "التاريخ", w: "20%" }, { h: "الأيام", w: "12%" }, { h: "السبب", w: "38%" }, { h: "الخصم", w: "30%" }]}
                rows={lvs.map(l => [arDate(l.date), l.days, l.reason, fmt(l.deduction) + " " + cur])} />
            )}

            <div style={{ fontSize: 12.5, fontWeight: 700, color: C.red, margin: "1rem 0 6px" }}>⚠️ خصومات وجزاءات</div>
            {dds.length === 0 ? <div style={{ textAlign: "center", color: C.mt, fontSize: 12, padding: "1rem" }}>لا خصومات مسجّلة لهذه الدورة.</div> : (
              <Table cols={[{ h: "التاريخ", w: "20%" }, { h: "السبب", w: "38%" }, { h: "ملاحظة", w: "22%" }, { h: "المبلغ", w: "20%" }]}
                rows={dds.map(d => [arDate(d.date), d.reason, d.note || "—", fmt(d.amount) + " " + cur])} />
            )}

            <div style={{ fontSize: 12.5, fontWeight: 700, color: C.blue, margin: "1rem 0 6px" }}>🛍 مشتريات من نقطة البيع</div>
            {purchs.length === 0 ? <div style={{ textAlign: "center", color: C.mt, fontSize: 12, padding: "1rem" }}>لا مشتريات مسجّلة لهذه الدورة.</div> : (
              <Table cols={[{ h: "التاريخ", w: "18%" }, { h: "رقم الفاتورة", w: "20%" }, { h: "التفاصيل", w: "42%" }, { h: "المبلغ", w: "20%" }]}
                rows={purchs.map(i => [arDate(i.date), "#" + i.id, i.details, fmt(i.total) + " " + cur])} />
            )}

            <div style={{ marginTop: 12, fontSize: 11, color: C.mt, background: "rgba(201,168,76,.08)", borderRadius: 8, padding: ".6rem .8rem", lineHeight: 1.7 }}>💡 السلف تُسجَّل من قسم المصاريف (فئة «سلفة موظف»). العطلات والخصومات تُسجَّلان من «سجل حركات الموظفين». مشتريات نقطة البيع تُسجَّل عند اختيار «آجل — موظف» أثناء البيع. الأربعة تُخصم تلقائياً من رصيد الراتب، وتُصفَّر معاً عند تصفية الراتب (تبقى الفواتير نفسها محفوظة كسجل مبيعات دائم).</div>
          </Modal>
        );
      })()}

      {modal && <Modal title="إضافة موظف" onClose={() => setModal(false)} width={460}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="الاسم" full><Inp value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="محمد علي" /></Field>
          <Field label="المنصب"><Inp value={f.role} onChange={e => setF({ ...f, role: e.target.value })} placeholder="كاشير" /></Field>
          <Field label={"الراتب الشهري (" + cur + ")"}><Inp type="number" value={f.salary} onChange={e => setF({ ...f, salary: e.target.value })} /></Field>
          <Field label="تاريخ بداية العمل/الراتب" full><Inp type="date" value={f.salaryStart} onChange={e => setF({ ...f, salaryStart: e.target.value })} /></Field>
        </div>
        <div style={{ fontSize: 11, color: C.mt, marginBottom: 10, lineHeight: 1.7 }}>يبدأ احتساب الراتب من التاريخ المحدد. عند نهاية الشهر استخدم زر «تصفية» لصرف المتبقي وبدء دورة جديدة.</div>
        <div style={{ display: "flex", gap: 8 }}><Btn gold onClick={save} style={{ flex: 1, justifyContent: "center" }}>✓ حفظ</Btn><Btn onClick={() => setModal(false)}>إلغاء</Btn></div>
      </Modal>}
    </>
  );
}
