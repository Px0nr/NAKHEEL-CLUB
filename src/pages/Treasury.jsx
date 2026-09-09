import { useState, useMemo } from "react";
import { C, fmt } from "../constants/theme.js";
import { PageTop, Badge, KCard, Card, CardHead, Field, Inp, Sel, Btn, Table } from "../components/ui.jsx";
import { todayISO, arDate } from "../utils/format.js";
import { payBreakdown } from "../utils/payments.js";
import { rangePreset, QUICK_RANGES } from "../utils/analytics.js";
import { downloadCsv, downloadExcel } from "../utils/exportTable.js";
import { openPdfDoc } from "../components/pdfHook.js";
import { DB } from "../db/db.js";

/* ============================ TREASURY (الخزينة والإغلاق اليومي) ============================ */
export default function Treasury({ ctx }) {
  const { invoices, purchases, expenses, payments, closings, setClosings, employees, setDeductions, user, showToast, confirm } = ctx;
  const cur = ctx.settings?.currency || "د.ل";
  const [period, setPeriod] = useState("today"); // today | 7 | 30
  const [actual, setActual] = useState({ cash: "", card: "", transfer: "" });
  const [assignTo, setAssignTo] = useState(""); // معرّف موظف من قائمة «الموظفين» — لا اسم مستخدم كما كان
  const [note, setNote] = useState("");
  // فلترة/تصدير/صفحات سجل الإغلاقات — كان يعرض كل السجل دفعة واحدة بلا حدّ
  const [clFrom, setClFrom] = useState("");
  const [clTo, setClTo] = useState("");
  const [clPage, setClPage] = useState(1);
  const CL_PAGE_SIZE = 50;
  const clApplyQuickRange = (key) => { const r = rangePreset(key); setClFrom(r.from); setClTo(r.to); setClPage(1); };
  const activeEmployees = (employees || []).filter(e => e.status === "نشط");

  const normPay = (p) => p === "نقداً" ? "كاش" : p;
  const today = todayISO();
  // يوم العمل المُغلَق: افتراضياً اليوم، لكن قبل الساعة 6 صباحاً يُفترض أن الإغلاق لليوم السابق (نوبات تعمل بعد منتصف الليل)
  const [closeDate, setCloseDate] = useState(() => {
    const h = new Date().getHours();
    if (h < 6) { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().split("T")[0]; }
    return today;
  });

  // مجاميع فترة (إيراد مقبوض فقط) حسب الطريقة
  const sumsFor = (days) => {
    const from = new Date(); from.setDate(from.getDate() - (days - 1));
    const fromISO = from.toISOString().split("T")[0];
    const inRange = (d) => days === 1 ? d === today : (d >= fromISO && d <= today);
    const out = { cash: 0, card: 0, transfer: 0, total: 0 };
    const add = (m, v) => { if (m === "كاش") out.cash += v; else if (m === "بطاقة") out.card += v; else if (m === "تحويل") out.transfer += v; out.total += v; };
    // مبيعات مدفوعة فوراً (غير الآجلة — الآجلة تدخل عبر سجل القبض بيوم استلامها)
    invoices.filter(i => i.status === "مدفوعة" && i.pay !== "آجل" && inRange(i.date)).forEach(i => payBreakdown(i).forEach(pt => add(pt.method, pt.amount)));
    // قبض ديون الزبائن (يشمل الدفعات الجزئية)
    payments.filter(p => p.kind === "قبض" && inRange(p.date)).forEach(p => add(p.via, p.amount));
    return out;
  };
  const periodDays = period === "today" ? 1 : period === "7" ? 7 : 30;
  const sums = sumsFor(periodDays);

  // متوقع يوم الإغلاق المختار بالتفصيل: إيراد − مصاريف مدفوعة − مشتريات كاش (خرجت من الدرج)
  const expected = useMemo(() => {
    const rev = { cash: 0, card: 0, transfer: 0 };
    const addRev = (m, v) => { if (m === "كاش") rev.cash += v; else if (m === "بطاقة") rev.card += v; else if (m === "تحويل") rev.transfer += v; };
    invoices.filter(i => i.status === "مدفوعة" && i.pay !== "آجل" && i.date === closeDate).forEach(i => payBreakdown(i).forEach(pt => addRev(pt.method, pt.amount)));
    payments.filter(p => p.kind === "قبض" && p.date === closeDate).forEach(p => addRev(p.via, p.amount));
    const expOut = { cash: 0, card: 0, transfer: 0 };
    expenses.filter(e => e.date === closeDate).forEach(e => {
      const m = normPay(e.pay);
      if (m === "كاش") expOut.cash += e.amount; else if (m === "بطاقة") expOut.card += e.amount; else if (m === "تحويل") expOut.transfer += e.amount;
    });
    const purchOut = { cash: 0, card: 0, transfer: 0 };
    purchases.filter(p => p.date === closeDate && p.pay === "كاش").forEach(p => { purchOut.cash += p.total; });
    // سداد الموردين يوم الإغلاق — يُخصم من الخزينة حسب طريقته
    const supPay = { cash: 0, card: 0, transfer: 0 };
    payments.filter(p => p.kind === "صرف" && p.date === closeDate).forEach(p => {
      if (p.via === "كاش") supPay.cash += p.amount; else if (p.via === "بطاقة") supPay.card += p.amount; else if (p.via === "تحويل") supPay.transfer += p.amount;
    });
    const net = {
      cash: rev.cash - expOut.cash - purchOut.cash - supPay.cash,
      card: rev.card - expOut.card - supPay.card,
      transfer: rev.transfer - expOut.transfer - supPay.transfer,
    };
    return { rev, expOut, purchOut, supPay, net, netTotal: net.cash + net.card + net.transfer };
  }, [invoices, expenses, purchases, payments, closeDate]);

  const todayClosing = closings.find(c => c.date === closeDate);
  const actualNum = { cash: parseFloat(actual.cash) || 0, card: parseFloat(actual.card) || 0, transfer: parseFloat(actual.transfer) || 0 };
  const actualTotal = actualNum.cash + actualNum.card + actualNum.transfer;
  const diff = Math.round((actualTotal - expected.netTotal) * 100) / 100;

  const saveClosing = () => {
    if (actual.cash === "" && actual.card === "" && actual.transfer === "") { showToast("أدخل المبالغ الفعلية المعدودة"); return; }
    if (diff < 0 && !assignTo) { showToast("يوجد عجز — اختر الموظف المسؤول لتسجيله عليه"); return; }
    const status = diff === 0 ? "match" : diff < 0 ? "shortage" : "surplus";
    const emp = diff < 0 ? activeEmployees.find(e => String(e.id) === String(assignTo)) : null;
    // عجز الخزينة كان اسماً حراً بلا أي ربط بنظام خصومات الرواتب — يُنشأ الآن
    // خصم فعلي على الموظف نفسه (deductions) بدل رقم تراكمي منفصل يتطلب إدخالاً
    // يدوياً مكرراً في صفحة الرواتب
    let deductionId = null;
    if (emp) {
      deductionId = "DD-" + Date.now();
      setDeductions(ds => [{ id: deductionId, empId: emp.id, empName: emp.name, date: closeDate, amount: Math.abs(diff), reason: "عجز خزينة", note: `إغلاق يوم ${arDate(closeDate)}${note.trim() ? ` — ${note.trim()}` : ""}`, by: user.name }, ...ds]);
    }
    setClosings(cs => [{
      id: "CL-" + Date.now(), date: closeDate,
      expected: { ...expected.net, total: expected.netTotal },
      actual: { ...actualNum, total: actualTotal },
      diff, status,
      assignedTo: emp?.name || null, assignedEmpId: emp?.id ?? null, deductionId,
      note: note.trim() || null,
      closedBy: user.name, closedAt: new Date().toISOString(),
    }, ...cs]);
    DB.flush("closings"); DB.flush("deductions");
    /* الإغلاق اليومي نقطة نهاية العمل الطبيعية — تُحفظ عندها لقطة داخلية سريعة
       (للتراجع عن خطأ) وتُنزَّل نسخة كملف. الملف وحده يخرج من تخزين المتصفح،
       فهو الحماية الفعلية من عطب الجهاز أو مسح بيانات المتصفح. */
    DB.saveAutoBackup();
    const file = DB.downloadBackupFile();
    const base = diff === 0 ? "تم الإغلاق — مطابقة تامة ✓" : diff < 0 ? `تم تسجيل عجز ${fmt(Math.abs(diff))} ${cur} على ${emp?.name || "—"} وخصمه من راتبه` : `تم حفظ زيادة ${fmt(diff)} ${cur} في النظام`;
    showToast(file ? `${base} — ونُزّلت نسخة احتياطية: ${file}` : base);
    setActual({ cash: "", card: "", transfer: "" }); setAssignTo(""); setNote("");
  };

  // حذف إغلاق كان فورياً بلا أي تأكيد مسبق (تراجع بعدي فقط عبر toast) — إغلاق
  // مالي رسمي يستحق تأكيداً صريحاً قبل حذفه لا بعده فقط. يُزال الخصم المرتبط
  // به أيضاً كي لا يبقى خصماً على راتب موظف لإغلاق لم يعد موجوداً
  const deleteClosing = async (id) => {
    const removed = closings.find(c => c.id === id);
    if (!removed) return;
    if (!(await confirm(`حذف إغلاق يوم ${arDate(removed.date)} نهائياً؟${removed.deductionId ? "\n\nسيُزال أيضاً خصم العجز المرتبط به من راتب الموظف." : ""}`, { danger: true }))) return;
    setClosings(cs => cs.filter(c => c.id !== id));
    if (removed.deductionId) setDeductions(ds => ds.filter(d => d.id !== removed.deductionId));
    showToast("حُذف الإغلاق — يمكن إعادة العد الآن", { onUndo: () => { setClosings(cs => [removed, ...cs]); } });
  };

  // تسوية عجز مستخدم بعد معالجته فعلياً — كان تراكمياً دائماً بلا أي وسيلة
  // لتصفيره حتى بعد تحصيله أو خصمه من الراتب فعلاً
  const settleUser = (name) => {
    setClosings(cs => cs.map(c => (c.status === "shortage" && c.assignedTo === name && !c.settled) ? { ...c, settled: true } : c));
    showToast(`تمت تسوية عجز ${name}`);
  };

  // ملخص العجوزات حسب المستخدم — يستثني ما سُوِّي بالفعل
  const shortByUser = {};
  closings.filter(c => c.status === "shortage" && c.assignedTo && !c.settled).forEach(c => { shortByUser[c.assignedTo] = (shortByUser[c.assignedTo] || 0) + Math.abs(c.diff); });
  const surplusTotal = closings.filter(c => c.status === "surplus").reduce((s, c) => s + c.diff, 0);

  const ST = { match: { l: "مطابقة ✓", t: "g" }, shortage: { l: "عجز", t: "r" }, surplus: { l: "زيادة", t: "b" } };
  const closingsShown = closings.filter(c => (!clFrom || c.date >= clFrom) && (!clTo || c.date <= clTo));
  const clTotalPages = Math.max(1, Math.ceil(closingsShown.length / CL_PAGE_SIZE));
  const clPageSafe = Math.min(clPage, clTotalPages);
  const closingsPageRows = closingsShown.slice((clPageSafe - 1) * CL_PAGE_SIZE, clPageSafe * CL_PAGE_SIZE);
  const closingsExportSheet = () => [{
    name: "الإغلاقات اليومية",
    thead: ["التاريخ", "المتوقع", "الفعلي", "الفرق", "الحالة", "على الموظف", "أغلقه", "ملاحظة"],
    tbody: closingsShown.map(c => [c.date, c.expected.total, c.actual.total, c.diff, ST[c.status].l + (c.settled ? " (سُوِّي)" : ""), c.assignedTo || "—", c.closedBy, c.note || "—"]),
  }];
  // تقرير PDF لإغلاق يوم واحد — لمشاركته مع محاسب أو أرشفته ورقياً
  const printClosing = (c) => {
    openPdfDoc(ctx.settings, {
      title: "تقرير إغلاق الخزينة اليومي", recipientLabel: "التاريخ", recipientName: arDate(c.date),
      docNo: c.id,
      columns: ["البند", "متوقع", "فعلي"],
      rows: [
        ["💵 كاش", fmt(c.expected.cash) + " " + cur, fmt(c.actual.cash) + " " + cur],
        ["💳 بطاقة", fmt(c.expected.card) + " " + cur, fmt(c.actual.card) + " " + cur],
        ["🏦 تحويل", fmt(c.expected.transfer) + " " + cur, fmt(c.actual.transfer) + " " + cur],
      ],
      totals: [
        ["الإجمالي المتوقع", fmt(c.expected.total) + " " + cur], ["الإجمالي الفعلي", fmt(c.actual.total) + " " + cur],
        ["الفرق", (c.diff > 0 ? "+" : "") + fmt(c.diff) + " " + cur], ["الحالة", ST[c.status].l + (c.settled ? " (سُوِّي)" : "")],
        ...(c.assignedTo ? [["مسجَّل على", c.assignedTo]] : []),
      ],
      note: `أُغلق بواسطة: ${c.closedBy}${c.note ? ` — ملاحظة: ${c.note}` : ""}`,
    });
  };

  const mLabel = { cash: "💵 كاش", card: "💳 بطاقة", transfer: "🏦 تحويل" };
  const rowStyle = { display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0" };

  return (
    <>
      <PageTop title="الخزينة والإغلاق اليومي" action={<Badge tone="gold">{arDate(today)}</Badge>} />

      {/* ملخص الفترة */}
      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
        {[["today", "اليوم"], ["7", "آخر 7 أيام"], ["30", "آخر 30 يوم"]].map(([k, l]) => (
          <span key={k} onClick={() => setPeriod(k)} style={{ cursor: "pointer", fontSize: 12, fontWeight: 600, padding: ".4rem 1rem", borderRadius: 20, background: period === k ? C.grn : C.crm, color: period === k ? C.gld : C.k2, border: `0.5px solid ${period === k ? C.grn : C.bc}` }}>{l}</span>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 11, marginBottom: "1.1rem" }}>
        <KCard label="💵 نقدي (كاش)" value={fmt(sums.cash)} sub={cur} bar="#1a8c3e" />
        <KCard label="💳 بطاقة" value={fmt(sums.card)} sub={cur} bar="#2a78d6" />
        <KCard label="🏦 تحويل مصرفي" value={fmt(sums.transfer)} sub={cur} bar={C.purp} />
        <KCard label="الإجمالي المقبوض" value={fmt(sums.total)} sub={cur} bar={C.gold} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: ctx.scr?.isTab ? "1fr" : "1.2fr 1fr", gap: 12, marginBottom: "1.1rem" }}>
        {/* الإغلاق اليومي */}
        <Card className="nk-card-hover">
          <CardHead title="🔒 الإغلاق اليومي" sub={todayClosing ? `تم إغلاق يوم ${arDate(closeDate)}` : "عُدّ ما في الدرج وطابقه مع النظام"} />
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, background: closeDate !== today ? "#FFF7EB" : C.crm, borderRadius: 9, padding: ".55rem .75rem" }}>
            <span style={{ fontSize: 11.5, color: C.mt, fontWeight: 600, whiteSpace: "nowrap" }}>يوم الإغلاق:</span>
            <Inp type="date" value={closeDate} onChange={e => setCloseDate(e.target.value)} style={{ flex: 1 }} />
            {closeDate !== today && <Badge tone="gold">ليس اليوم الحالي</Badge>}
          </div>
          {closeDate !== today && <div style={{ fontSize: 10.5, color: C.gdd, marginTop: -8, marginBottom: 10, lineHeight: 1.7 }}>💡 إن أغلقت النادي بعد منتصف الليل، اختر هنا تاريخ يوم العمل الفعلي (وليس التاريخ الذي تغيّر إليه التقويم) — النظام اقترح لك تلقائياً اليوم السابق لأن الوقت الحالي قبل الساعة 6 صباحاً.</div>}
          {todayClosing ? (
            <div>
              <div style={{ background: todayClosing.status === "match" ? "#e8f8ee" : todayClosing.status === "shortage" ? "#fdeaea" : C.bluebg, borderRadius: 12, padding: "1rem", textAlign: "center", marginBottom: 10 }}>
                <div style={{ fontSize: 30 }}>{todayClosing.status === "match" ? "✅" : todayClosing.status === "shortage" ? "⚠️" : "➕"}</div>
                <div style={{ fontSize: 15, fontWeight: 800, marginTop: 4 }}>{ST[todayClosing.status].l}{todayClosing.diff !== 0 && ` — ${fmt(Math.abs(todayClosing.diff))} ${cur}`}</div>
                {todayClosing.assignedTo && <div style={{ fontSize: 12, color: "#922", marginTop: 4 }}>سُجّل العجز على: <b>{todayClosing.assignedTo}</b></div>}
                <div style={{ fontSize: 11, color: C.mt, marginTop: 4 }}>أُغلق بواسطة {todayClosing.closedBy} · متوقع {fmt(todayClosing.expected.total)} / فعلي {fmt(todayClosing.actual.total)} {cur}</div>
              </div>
              <Btn sm danger onClick={() => deleteClosing(todayClosing.id)}>↩ إلغاء الإغلاق وإعادة العد</Btn>
            </div>
          ) : (
            <>
              {/* المتوقع من النظام */}
              <div style={{ background: C.crm, borderRadius: 10, padding: ".7rem .9rem", marginBottom: 12, fontSize: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 6, color: C.grn2 }}>المتوقع في الدرج حسب النظام ({closeDate === today ? "اليوم" : arDate(closeDate)}):</div>
                {["cash", "card", "transfer"].map(m => (
                  <div key={m} style={rowStyle}>
                    <span>{mLabel[m]}</span>
                    <span style={{ fontWeight: 700 }}>{fmt(expected.net[m])} {cur} <span style={{ color: C.mt, fontWeight: 400, fontSize: 10.5 }}>(إيراد {fmt(expected.rev[m])}{(expected.expOut[m] + expected.supPay[m] + (m === "cash" ? expected.purchOut.cash : 0)) ? ` − مدفوعات ${fmt(expected.expOut[m] + expected.supPay[m] + (m === "cash" ? expected.purchOut.cash : 0))}` : ""})</span></span>
                  </div>
                ))}
                <div style={{ ...rowStyle, borderTop: `0.5px solid ${C.bc}`, marginTop: 5, paddingTop: 7, fontWeight: 800, fontSize: 13 }}><span>الإجمالي المتوقع</span><span style={{ color: C.grn2 }}>{fmt(expected.netTotal)} {cur}</span></div>
              </div>

              {/* العد الفعلي */}
              <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6 }}>المعدود فعلياً:</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 10 }}>
                <Field label="💵 نقود الدرج"><Inp type="number" value={actual.cash} onChange={e => setActual({ ...actual, cash: e.target.value })} placeholder="0" /></Field>
                <Field label="💳 إيصالات بطاقة"><Inp type="number" value={actual.card} onChange={e => setActual({ ...actual, card: e.target.value })} placeholder="0" /></Field>
                <Field label="🏦 تحويلات"><Inp type="number" value={actual.transfer} onChange={e => setActual({ ...actual, transfer: e.target.value })} placeholder="0" /></Field>
              </div>

              {/* الفرق الحي */}
              <div style={{ background: diff === 0 ? "#e8f8ee" : diff < 0 ? "#fdeaea" : C.bluebg, border: `1px solid ${diff === 0 ? "rgba(26,140,62,.3)" : diff < 0 ? "rgba(192,57,43,.3)" : "rgba(42,120,214,.3)"}`, borderRadius: 10, padding: ".65rem .9rem", marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12.5, fontWeight: 700 }}>{diff === 0 ? "✅ مطابقة تامة" : diff < 0 ? "⚠️ عجز في الخزينة" : "➕ زيادة في الخزينة"}</span>
                <span style={{ fontSize: 17, fontWeight: 800, color: diff === 0 ? "#1a8c3e" : diff < 0 ? "#c0392b" : "#2a78d6" }}>{diff > 0 ? "+" : ""}{fmt(diff)} {cur}</span>
              </div>

              {diff < 0 && (
                <Field label="تسجيل العجز على الموظف * (يُخصم تلقائياً من راتبه)">
                  <Sel value={assignTo} onChange={e => setAssignTo(e.target.value)}>
                    <option value="">اختر الموظف المسؤول...</option>
                    {activeEmployees.map(e => <option key={e.id} value={e.id}>{e.name} — {e.role}</option>)}
                  </Sel>
                </Field>
              )}
              <Field label="ملاحظة (اختياري)"><Inp value={note} onChange={e => setNote(e.target.value)} placeholder={diff > 0 ? "مصدر الزيادة إن عُرف" : "أي ملاحظات على الإغلاق"} /></Field>
              <Btn gold onClick={saveClosing} style={{ width: "100%", justifyContent: "center" }}>🔒 تأكيد الإغلاق اليومي</Btn>
            </>
          )}
        </Card>

        {/* ملخصات جانبية */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Card className="nk-card-hover">
            <CardHead title="⚠️ عجوزات المستخدمين" sub="غير المُسوَّاة — تُخصم تلقائياً من الراتب" />
            {Object.keys(shortByUser).length === 0 ? <div style={{ textAlign: "center", color: C.mt, fontSize: 12, padding: "1rem" }}>لا عجوزات مسجّلة ✓</div> :
              Object.entries(shortByUser).sort((a, b) => b[1] - a[1]).map(([n, v]) => (
                <div key={n} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5, padding: ".45rem .2rem", borderBottom: `0.5px solid ${C.bc}` }}>
                  <span>👤 {n}</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 700, color: "#c0392b" }}>{fmt(v)} {cur}</span>
                    <Btn sm onClick={() => settleUser(n)}>✓ تسوية</Btn>
                  </span>
                </div>
              ))}
          </Card>
          <Card className="nk-card-hover">
            <CardHead title="➕ الزيادات المحفوظة" sub="مجموع فوائض الإغلاقات" />
            <div style={{ textAlign: "center", fontSize: 24, fontWeight: 800, color: "#2a78d6", padding: ".4rem 0" }}>{fmt(surplusTotal)} <span style={{ fontSize: 12 }}>{cur}</span></div>
          </Card>
        </div>
      </div>

      {/* سجل الإغلاقات — نطاق تاريخ وتصدير وصفحات، كان يعرض كل السجل دفعة واحدة بلا حدّ */}
      <Card>
        <CardHead title="سجل الإغلاقات اليومية" sub={`${fmt(closingsShown.length)} من ${fmt(closings.length)} إجمالاً`} right={
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <Sel value="" onChange={e => e.target.value && clApplyQuickRange(e.target.value)} style={{ width: 120 }}>
              <option value="">— نطاق سريع —</option>
              {QUICK_RANGES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </Sel>
            <Inp type="date" value={clFrom} onChange={e => { setClFrom(e.target.value); setClPage(1); }} aria-label="من تاريخ" style={{ width: 135 }} />
            <Inp type="date" value={clTo} onChange={e => { setClTo(e.target.value); setClPage(1); }} aria-label="إلى تاريخ" style={{ width: 135 }} />
            <Btn sm onClick={() => downloadCsv(closingsExportSheet(), `الإغلاقات-${clFrom || "الكل"}-${clTo || today}`)}>⬇ CSV</Btn>
            <Btn sm onClick={() => downloadExcel(closingsExportSheet(), `الإغلاقات-${clFrom || "الكل"}-${clTo || today}`)}>📊 Excel</Btn>
          </div>
        } />
        {closingsShown.length === 0 ? <div style={{ textAlign: "center", color: C.mt, fontSize: 12.5, padding: "1.5rem" }}>لا إغلاقات ضمن هذا النطاق.</div> : (
          <>
            <Table cols={[{ h: "التاريخ", w: "12%" }, { h: "المتوقع", w: "13%" }, { h: "الفعلي", w: "13%" }, { h: "الفرق", w: "12%" }, { h: "الحالة", w: "13%" }, { h: "على الموظف", w: "13%" }, { h: "أغلقه", w: "11%" }, { h: "", w: "13%" }]}
              rows={closingsPageRows.map(c => [arDate(c.date), fmt(c.expected.total) + " " + cur, fmt(c.actual.total) + " " + cur,
                <span style={{ fontWeight: 700, color: c.diff === 0 ? "#1a8c3e" : c.diff < 0 ? "#c0392b" : "#2a78d6" }}>{c.diff > 0 ? "+" : ""}{fmt(c.diff)}</span>,
                <Badge tone={c.settled ? "g" : ST[c.status].t}>{ST[c.status].l}{c.settled ? " (سُوِّي)" : ""}</Badge>, c.assignedTo || "—", c.closedBy,
                <span style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => printClosing(c)} aria-label="طباعة تقرير الإغلاق" title="طباعة PDF" style={{ background: "none", border: "none", cursor: "pointer", color: C.blue, fontSize: 13 }}>🖨</button>
                  <button onClick={() => deleteClosing(c.id)} aria-label="حذف سجل الإغلاق" style={{ background: "none", border: "none", cursor: "pointer", color: C.mt, fontSize: 13 }}>🗑</button>
                </span>])} />
            {clTotalPages > 1 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 12, paddingTop: 10, borderTop: `0.5px solid ${C.bc}` }}>
                <Btn sm onClick={() => setClPage(p => Math.max(1, p - 1))} style={{ opacity: clPageSafe === 1 ? .4 : 1 }}>‹ السابق</Btn>
                <span style={{ fontSize: 12, color: C.mt }}>صفحة {clPageSafe} من {clTotalPages}</span>
                <Btn sm onClick={() => setClPage(p => Math.min(clTotalPages, p + 1))} style={{ opacity: clPageSafe === clTotalPages ? .4 : 1 }}>التالي ›</Btn>
              </div>
            )}
          </>
        )}
      </Card>
    </>
  );
}
