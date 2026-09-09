import { useState } from "react";
import { C, fmt } from "../constants/theme.js";
import { PageTop, Btn, KCard, Card, Table, Badge, Modal, Field, Inp, inputStyle } from "../components/ui.jsx";
import { openPdfDoc } from "../components/pdfHook.js";
import { todayISO, arDate, daysBetween } from "../utils/format.js";

const emptyForm = { name: "", role: "", salary: "", salaryStart: todayISO() };
// دورة أقصر من هذا تُعتبر جزئية (موظف جديد أو صُفِّي مبكراً) فيُحتسب راتبها
// تناسبياً — دورة عادية (٢٨-٣١ يوماً) تُحتسب كاملة كما كانت لتفادي تذبذب
// الأرقام كل شهر بلا داعٍ
const PARTIAL_CYCLE_DAYS = 25;

/* ============================ SALARIES ============================ */
export default function Salaries({ ctx }) {
  const { employees, setEmployees, expenses, setExpenses, leaves, setLeaves, deductions, setDeductions, invoices, setInvoices, salarySettlements, setSalarySettlements, user, showToast, confirm } = ctx;
  const cur = ctx.settings?.currency || "د.ل";
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null); // موظف قيد تعديل بياناته
  const [detail, setDetail] = useState(null); // employee id being viewed
  const [q, setQ] = useState("");
  const [f, setF] = useState(emptyForm);

  const openAdd = () => { setEditing(null); setF(emptyForm); setModal(true); };
  const openEdit = (emp) => { setEditing(emp); setF({ name: emp.name, role: emp.role, salary: String(emp.salary), salaryStart: emp.salaryStart }); setModal(true); };

  const save = () => {
    if (!f.name.trim() || !f.salary) { showToast("أدخل الاسم والراتب"); return; }
    if (editing) {
      setEmployees(es => es.map(e => e.id === editing.id ? { ...e, name: f.name, role: f.role || "موظف", salary: parseFloat(f.salary) } : e));
      showToast("تم تحديث بيانات الموظف");
    } else {
      setEmployees(e => [...e, { id: Math.max(0, ...e.map(x => x.id)) + 1, name: f.name, role: f.role || "موظف", hired: f.salaryStart, salaryStart: f.salaryStart, salary: parseFloat(f.salary), status: "نشط" }]);
      showToast("تمت إضافة الموظف");
    }
    setModal(false); setEditing(null); setF(emptyForm);
  };

  // إنهاء خدمة/إعادة تفعيل — كان الحقل status يُضبط "نشط" عند الإنشاء ولا
  // يتغيّر أبداً بعدها، فيبقى موظف غادر العمل ظاهراً للأبد في كل قوائم
  // الاختيار (السلف، تسجيل عجز الخزينة...)
  const toggleActive = (emp) => {
    setEmployees(es => es.map(e => e.id === emp.id ? { ...e, status: e.status === "نشط" ? "غير نشط" : "نشط" } : e));
    showToast(emp.status === "نشط" ? `أُنهيت خدمة ${emp.name}` : `أُعيد تفعيل ${emp.name}`);
  };
  const hasOutstanding = (emp) => advancesOf(emp.id).length || leavesOf(emp.id).length || deductionsOf(emp.id).length || purchasesOf(emp.id).length;
  const deleteEmployee = async (emp) => {
    if (hasOutstanding(emp)) { showToast("لا يمكن حذف موظف عليه سلف أو خصومات غير مُصفّاة — صفِّ راتبه أولاً"); return; }
    if (!(await confirm(`حذف الموظف «${emp.name}» نهائياً؟ سجل تصفياته السابقة يبقى محفوظاً.`, { danger: true }))) return;
    setEmployees(es => es.filter(e => e.id !== emp.id));
    showToast("تم حذف الموظف");
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
  // راتب الدورة الحالية: كامل الراتب الشهري إلا إن كانت الدورة قصيرة (موظف
  // جديد أو صُفِّي مبكراً) فيُحتسب تناسبياً بدل احتساب شهر كامل عن أيام قليلة
  const baseSalaryOf = (emp) => {
    const cycleDays = daysBetween(emp.salaryStart, todayISO());
    if (cycleDays > 0 && cycleDays < PARTIAL_CYCLE_DAYS) return Math.round(emp.salary * cycleDays / 30 * 100) / 100;
    return emp.salary;
  };
  const remainOf = (emp) => baseSalaryOf(emp) - takenOf(emp.id) - leaveDeductOf(emp.id) - deductionAmountOf(emp.id) - purchasesAmountOf(emp.id);

  const printPayslip = (s) => {
    openPdfDoc(ctx.settings, {
      title: "قسيمة راتب", recipientLabel: "الموظف", recipientName: `${s.empName} — ${s.role || ""}`,
      docNo: s.id,
      columns: ["البند", "القيمة"],
      rows: [
        ["الدورة", `${arDate(s.cycleFrom)} — ${arDate(s.cycleTo)}`],
        ["الراتب الأساسي" + (s.baseSalary !== s.fullSalary ? " (تناسبي)" : ""), fmt(s.baseSalary) + " " + cur],
        ["السلف المسحوبة", "− " + fmt(s.advances) + " " + cur],
        ["خصم العطلات", "− " + fmt(s.leaveDeduction) + " " + cur],
        ["خصومات وجزاءات", "− " + fmt(s.penalties) + " " + cur],
        ["مشتريات نقطة البيع", "− " + fmt(s.purchases) + " " + cur],
      ],
      totals: [
        ["الصافي" + (s.net < 0 ? " (عجز مُرحَّل)" : ""), fmt(s.net) + " " + cur],
      ],
      note: `تمت التصفية بواسطة: ${s.by} — ${arDate(s.cycleTo)}${s.carriedForward > 0 ? ` — رُحِّل عجز ${fmt(s.carriedForward)} ${cur} للدورة القادمة` : ""}`,
    });
  };

  // تصفية راتب الموظف (نهاية الشهر): صرف المتبقي كمصروف وتصفير السلف والعطلات والخصومات ومشتريات نقطة البيع
  const settle = async (emp) => {
    const base = baseSalaryOf(emp);
    const taken = takenOf(emp.id);
    const leaveDed = leaveDeductOf(emp.id);
    const penaltyDed = deductionAmountOf(emp.id);
    const purchDed = purchasesAmountOf(emp.id);
    const remain = base - taken - leaveDed - penaltyDed - purchDed;
    const cycleFrom = emp.salaryStart, cycleTo = todayISO();
    const prorateNote = base !== emp.salary ? `\n(راتب تناسبي عن ${daysBetween(cycleFrom, cycleTo)} يوماً من أصل ${fmt(emp.salary)} ${cur})` : "";
    if (!(await confirm(`تصفية راتب ${emp.name}؟${prorateNote}\nالراتب: ${fmt(base)} ${cur}\nالسلف المسحوبة: ${fmt(taken)} ${cur}\nخصم العطلات: ${fmt(leaveDed)} ${cur}\nخصومات وجزاءات: ${fmt(penaltyDed)} ${cur}\nمشتريات نقطة البيع: ${fmt(purchDed)} ${cur}\nالمتبقي للصرف: ${fmt(remain)} ${cur}\n\nسيُسجّل المتبقي كمصروف مرتب وتبدأ دورة جديدة.`))) return;
    // سجّل صرف باقي الراتب كمصروف
    if (remain > 0) {
      setExpenses(ex => [{ id: Math.max(0, ...ex.map(x => x.id)) + 1, date: todayISO(), cat: "مرتبات", desc: `صرف باقي راتب ${emp.name}`, amount: remain, pay: "نقداً", by: user?.name || "مدير", empId: null, empName: null }, ...ex]);
    }
    // احذف سلف هذا الموظف وعطلاته وخصوماته المسجّلة (تصفير الدورة)، وعلِّم مشترياته كمُسوّاة (تبقى الفواتير نفسها بلا حذف — سجلات بيع حقيقية)
    setExpenses(ex => ex.filter(e => !(e.empId == emp.id && e.cat === "سلفة موظف")));
    setLeaves(ls => ls.filter(l => l.empId != emp.id));
    setDeductions(ds => ds.filter(d => d.empId != emp.id));
    setInvoices(iv => iv.map(i => (i.empId == emp.id && i.pay === "موظف" && !i.salarySettled) ? { ...i, salarySettled: true } : i));
    setEmployees(es => es.map(e => e.id === emp.id ? { ...e, salaryStart: todayISO() } : e));
    // عجز الراتب (حين تتجاوز الخصومات والسلف الراتب) كان يُصفَّر بصمت بلا أي
    // أثر عند التصفية — يُرحَّل الآن كخصم فعلي على الدورة الجديدة بدل اختفاء
    // الخسارة المالية من السجلات
    if (remain < 0) {
      setDeductions(ds => [{ id: "DD-" + Date.now(), empId: emp.id, empName: emp.name, date: todayISO(), amount: Math.abs(remain), reason: "ترحيل عجز من دورة سابقة", note: `تصفية ${arDate(cycleTo)}`, by: user?.name || "مدير" }, ...ds]);
    }
    // أرشيف دورات الرواتب المصفّاة — كانت التصفية تصفّر كل شيء بلا أي سجل
    // تاريخي، فلا يمكن الرجوع لاحقاً لمعرفة كم صُرف لمن ومتى
    setSalarySettlements(ss => [{
      id: "PS-" + Date.now(), empId: emp.id, empName: emp.name, role: emp.role,
      cycleFrom, cycleTo, baseSalary: base, fullSalary: emp.salary,
      advances: taken, leaveDeduction: leaveDed, penalties: penaltyDed, purchases: purchDed,
      net: remain, carriedForward: remain < 0 ? Math.abs(remain) : 0,
      by: user?.name || "مدير", settledAt: new Date().toISOString(),
    }, ...ss]);
    showToast(remain < 0 ? `تمت التصفية — عجز ${fmt(Math.abs(remain))} ${cur} رُحِّل لدورة ${emp.name} القادمة` : `تمت تصفية راتب ${emp.name} وبدء دورة جديدة`);
    setDetail(null);
  };

  const employeesShown = employees.filter(e => e.name.includes(q) || (e.role || "").includes(q));
  const totalSalaries = employees.reduce((s, e) => s + e.salary, 0);
  const totalRemain = employees.reduce((s, e) => s + remainOf(e), 0);

  return (
    <>
      <PageTop title="مرتبات العمال" action={
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="بحث بالاسم أو المنصب..." style={{ ...inputStyle, width: 170 }} />
          <Btn gold onClick={openAdd}>+ إضافة موظف</Btn>
        </div>
      } />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 11, marginBottom: "1.1rem" }}>
        <KCard label="عدد الموظفين" value={employees.filter(e => e.status === "نشط").length} sub={`من ${employees.length} إجمالاً`} bar="#2a78d6" />
        <KCard label="إجمالي الرواتب" value={fmt(totalSalaries)} sub={cur + " شهرياً"} bar={C.gold} />
        <KCard label="المتبقي للصرف" value={fmt(totalRemain)} sub="بعد السلف" bar="#1a8c3e" />
      </div>

      {/* بطاقات الموظفين */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(270px,1fr))", gap: 12 }}>
        {employeesShown.length === 0 && <Card><div style={{ textAlign: "center", color: C.mt, padding: "1.5rem" }}>{employees.length === 0 ? "لا موظفون بعد — أضف أول موظف." : "لا موظفون مطابقون للبحث."}</div></Card>}
        {employeesShown.map(emp => {
          const taken = takenOf(emp.id);
          const remain = remainOf(emp);
          const base = baseSalaryOf(emp);
          const pct = base ? Math.max(0, Math.min(100, Math.round(remain / base * 100))) : 0;
          const inactive = emp.status !== "نشط";
          return (
            <Card key={emp.id} className="nk-card-hover" style={inactive ? { opacity: .65 } : undefined}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: C.grl, color: "#fff", fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{emp.name.slice(0, 2)}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>{emp.name}{inactive && <Badge tone="r">غير نشط</Badge>}</div>
                  <div style={{ fontSize: 11, color: C.mt }}>{emp.role} · منذ {arDate(emp.salaryStart)}{base !== emp.salary && <span style={{ color: C.gdd }}> · راتب تناسبي</span>}</div>
                </div>
              </div>

              {/* شريط الراتب المتبقي */}
              <div style={{ marginBottom: 6, display: "flex", justifyContent: "space-between", fontSize: 11.5 }}>
                <span style={{ color: C.mt }}>المتبقي من الراتب</span>
                <span style={{ fontWeight: 700, color: remain < 0 ? C.red : C.grn2 }}>{fmt(remain)} / {fmt(base)} {cur}</span>
              </div>
              <div style={{ height: 9, borderRadius: 5, background: "#eee", overflow: "hidden", marginBottom: 10 }}>
                <div style={{ width: pct + "%", height: "100%", background: pct < 25 ? "#e34948" : pct < 60 ? C.gold : "#1a8c3e", transition: "width .3s" }} />
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, marginBottom: 4 }}><span style={{ color: C.mt }}>الراتب الأساسي{base !== emp.salary ? " (تناسبي)" : ""}</span><span style={{ fontWeight: 600 }}>{fmt(base)} {cur}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, marginBottom: 4 }}><span style={{ color: C.mt }}>السلف المسحوبة</span><span style={{ fontWeight: 600, color: C.purp }}>− {fmt(taken)} {cur}</span></div>
              {leaveDeductOf(emp.id) > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, marginBottom: 4 }}><span style={{ color: C.mt }}>خصم العطلات ({leavesOf(emp.id).reduce((s, l) => s + l.days, 0)} يوم)</span><span style={{ fontWeight: 600, color: "#8a6a20" }}>− {fmt(leaveDeductOf(emp.id))} {cur}</span></div>}
              {deductionAmountOf(emp.id) > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, marginBottom: 4 }}><span style={{ color: C.mt }}>خصومات وجزاءات ({deductionsOf(emp.id).length})</span><span style={{ fontWeight: 600, color: C.red }}>− {fmt(deductionAmountOf(emp.id))} {cur}</span></div>}
              {purchasesAmountOf(emp.id) > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, marginBottom: 4 }}><span style={{ color: C.mt }}>مشتريات نقطة البيع ({purchasesOf(emp.id).length})</span><span style={{ fontWeight: 600, color: C.blue }}>− {fmt(purchasesAmountOf(emp.id))} {cur}</span></div>}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, paddingTop: 6, borderTop: `0.5px solid ${C.bc}`, marginTop: 4 }}><span style={{ fontWeight: 700 }}>الصافي المتبقي</span><span style={{ fontWeight: 800, color: remain < 0 ? C.red : C.grn2 }}>{fmt(remain)} {cur}</span></div>

              <div style={{ display: "flex", gap: 7, marginTop: 12, flexWrap: "wrap" }}>
                <Btn sm onClick={() => setDetail(emp.id)} style={{ flex: 1, justifyContent: "center" }}>📋 التفاصيل ({advancesOf(emp.id).length + leavesOf(emp.id).length + deductionsOf(emp.id).length + purchasesOf(emp.id).length})</Btn>
                <Btn sm gold onClick={() => settle(emp)} style={{ flex: 1, justifyContent: "center" }}>💰 تصفية</Btn>
              </div>
              <div style={{ display: "flex", gap: 7, marginTop: 7 }}>
                <Btn sm onClick={() => openEdit(emp)} style={{ flex: 1, justifyContent: "center" }}>✎ تعديل</Btn>
                <Btn sm onClick={() => toggleActive(emp)} style={{ flex: 1, justifyContent: "center" }}>{inactive ? "▶ إعادة تفعيل" : "⏸ إنهاء الخدمة"}</Btn>
                <Btn sm danger onClick={() => deleteEmployee(emp)}>🗑</Btn>
              </div>
            </Card>
          );
        })}
      </div>

      {/* أرشيف دورات الرواتب المصفّاة */}
      {salarySettlements.length > 0 && (
        <Card style={{ marginTop: 12 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 8 }}>🗂 أرشيف دورات الرواتب المصفّاة</div>
          <Table cols={[{ h: "الموظف", w: "16%" }, { h: "الدورة", w: "20%" }, { h: "الراتب", w: "12%" }, { h: "الخصومات", w: "14%" }, { h: "الصافي", w: "12%" }, { h: "بواسطة", w: "12%" }, { h: "", w: "10%" }]}
            rows={salarySettlements.slice(0, 30).map(s => [
              s.empName, `${arDate(s.cycleFrom)} — ${arDate(s.cycleTo)}`, fmt(s.baseSalary) + " " + cur,
              fmt(s.advances + s.leaveDeduction + s.penalties + s.purchases) + " " + cur,
              <span style={{ fontWeight: 700, color: s.net < 0 ? C.red : C.grn2 }}>{fmt(s.net)} {cur}{s.carriedForward > 0 && " ⚠"}</span>,
              s.by,
              <button onClick={() => printPayslip(s)} aria-label="طباعة قسيمة الراتب" title="طباعة PDF" style={{ background: "none", border: "none", cursor: "pointer", color: C.blue, fontSize: 13 }}>🖨</button>,
            ])} />
          {salarySettlements.length > 30 && <div style={{ fontSize: 11, color: C.mt, textAlign: "center", marginTop: 8 }}>يعرض أحدث 30 من {salarySettlements.length} تصفية</div>}
        </Card>
      )}

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
              <div><div style={{ fontSize: 16, fontWeight: 800, color: C.grn2 }}>{fmt(baseSalaryOf(emp))}</div><div style={{ fontSize: 10.5, color: C.mt }}>الراتب{baseSalaryOf(emp) !== emp.salary ? " (تناسبي)" : ""}</div></div>
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

      {modal && <Modal title={editing ? `تعديل بيانات — ${editing.name}` : "إضافة موظف"} onClose={() => { setModal(false); setEditing(null); }} width={460}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="الاسم" full><Inp value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="محمد علي" /></Field>
          <Field label="المنصب"><Inp value={f.role} onChange={e => setF({ ...f, role: e.target.value })} placeholder="كاشير" /></Field>
          <Field label={"الراتب الشهري (" + cur + ")"}><Inp type="number" value={f.salary} onChange={e => setF({ ...f, salary: e.target.value })} /></Field>
          {!editing && <Field label="تاريخ بداية العمل/الراتب" full><Inp type="date" value={f.salaryStart} onChange={e => setF({ ...f, salaryStart: e.target.value })} /></Field>}
        </div>
        <div style={{ fontSize: 11, color: C.mt, marginBottom: 10, lineHeight: 1.7 }}>{editing ? "تغيير الراتب يُطبَّق من الدورة الحالية فوراً." : "يبدأ احتساب الراتب من التاريخ المحدد. عند نهاية الشهر استخدم زر «تصفية» لصرف المتبقي وبدء دورة جديدة."}</div>
        <div style={{ display: "flex", gap: 8 }}><Btn gold onClick={save} style={{ flex: 1, justifyContent: "center" }}>✓ {editing ? "حفظ التعديلات" : "حفظ"}</Btn><Btn onClick={() => { setModal(false); setEditing(null); }}>إلغاء</Btn></div>
      </Modal>}
    </>
  );
}
