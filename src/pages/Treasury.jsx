import { useState, useMemo } from "react";
import { C, fmt } from "../constants/theme.js";
import { PageTop, Badge, KCard, Card, CardHead, Field, Inp, Sel, Btn, Table } from "../components/ui.jsx";
import { todayISO, arDate } from "../utils/format.js";
import { DB } from "../db/db.js";

/* ============================ TREASURY (الخزينة والإغلاق اليومي) ============================ */
export default function Treasury({ ctx }) {
  const { invoices, purchases, expenses, payments, closings, setClosings, users, user, showToast } = ctx;
  const cur = ctx.settings?.currency || "د.ل";
  const [period, setPeriod] = useState("today"); // today | 7 | 30
  const [actual, setActual] = useState({ cash: "", card: "", transfer: "" });
  const [assignTo, setAssignTo] = useState("");
  const [note, setNote] = useState("");

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
    invoices.filter(i => i.status === "مدفوعة" && i.pay !== "آجل" && inRange(i.date)).forEach(i => add(i.pay, i.total));
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
    invoices.filter(i => i.status === "مدفوعة" && i.pay !== "آجل" && i.date === closeDate).forEach(i => addRev(i.pay, i.total));
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
    if (diff < 0 && !assignTo) { showToast("يوجد عجز — اختر المستخدم المسؤول لتسجيله عليه"); return; }
    const status = diff === 0 ? "match" : diff < 0 ? "shortage" : "surplus";
    setClosings(cs => [{
      id: "CL-" + Date.now(), date: closeDate,
      expected: { ...expected.net, total: expected.netTotal },
      actual: { ...actualNum, total: actualTotal },
      diff, status,
      assignedTo: diff < 0 ? assignTo : null,
      note: note.trim() || null,
      closedBy: user.name, closedAt: new Date().toISOString(),
    }, ...cs]);
    DB.flush("closings");
    /* الإغلاق اليومي نقطة نهاية العمل الطبيعية — تُحفظ عندها لقطة داخلية سريعة
       (للتراجع عن خطأ) وتُنزَّل نسخة كملف. الملف وحده يخرج من تخزين المتصفح،
       فهو الحماية الفعلية من عطب الجهاز أو مسح بيانات المتصفح. */
    DB.saveAutoBackup();
    const file = DB.downloadBackupFile();
    const base = diff === 0 ? "تم الإغلاق — مطابقة تامة ✓" : diff < 0 ? `تم تسجيل عجز ${fmt(Math.abs(diff))} ${cur} على ${assignTo}` : `تم حفظ زيادة ${fmt(diff)} ${cur} في النظام`;
    showToast(file ? `${base} — ونُزّلت نسخة احتياطية: ${file}` : base);
    setActual({ cash: "", card: "", transfer: "" }); setAssignTo(""); setNote("");
  };

  const deleteClosing = (id) => {
    const removed = closings.find(c => c.id === id);
    if (!removed) return;
    setClosings(cs => cs.filter(c => c.id !== id));
    showToast("حُذف الإغلاق — يمكن إعادة العد الآن", { onUndo: () => setClosings(cs => [removed, ...cs]) });
  };

  // ملخص العجوزات حسب المستخدم
  const shortByUser = {};
  closings.filter(c => c.status === "shortage" && c.assignedTo).forEach(c => { shortByUser[c.assignedTo] = (shortByUser[c.assignedTo] || 0) + Math.abs(c.diff); });
  const surplusTotal = closings.filter(c => c.status === "surplus").reduce((s, c) => s + c.diff, 0);

  const ST = { match: { l: "مطابقة ✓", t: "g" }, shortage: { l: "عجز", t: "r" }, surplus: { l: "زيادة", t: "b" } };
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
                <Field label="تسجيل العجز على المستخدم *">
                  <Sel value={assignTo} onChange={e => setAssignTo(e.target.value)}>
                    <option value="">اختر المستخدم المسؤول...</option>
                    {users.filter(u => u.active).map(u => <option key={u.id} value={u.name}>{u.name} — {u.role}</option>)}
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
            <CardHead title="⚠️ عجوزات المستخدمين" sub="التراكمي المسجّل" />
            {Object.keys(shortByUser).length === 0 ? <div style={{ textAlign: "center", color: C.mt, fontSize: 12, padding: "1rem" }}>لا عجوزات مسجّلة ✓</div> :
              Object.entries(shortByUser).sort((a, b) => b[1] - a[1]).map(([n, v]) => (
                <div key={n} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: ".45rem .2rem", borderBottom: `0.5px solid ${C.bc}` }}><span>👤 {n}</span><span style={{ fontWeight: 700, color: "#c0392b" }}>{fmt(v)} {cur}</span></div>
              ))}
          </Card>
          <Card className="nk-card-hover">
            <CardHead title="➕ الزيادات المحفوظة" sub="مجموع فوائض الإغلاقات" />
            <div style={{ textAlign: "center", fontSize: 24, fontWeight: 800, color: "#2a78d6", padding: ".4rem 0" }}>{fmt(surplusTotal)} <span style={{ fontSize: 12 }}>{cur}</span></div>
          </Card>
        </div>
      </div>

      {/* سجل الإغلاقات */}
      <Card>
        <CardHead title="سجل الإغلاقات اليومية" sub={`${closings.length} إغلاق`} />
        {closings.length === 0 ? <div style={{ textAlign: "center", color: C.mt, fontSize: 12.5, padding: "1.5rem" }}>لا إغلاقات بعد — أول إغلاق يظهر هنا.</div> : (
          <Table cols={[{ h: "التاريخ", w: "13%" }, { h: "المتوقع", w: "14%" }, { h: "الفعلي", w: "14%" }, { h: "الفرق", w: "13%" }, { h: "الحالة", w: "12%" }, { h: "على المستخدم", w: "14%" }, { h: "أغلقه", w: "12%" }, { h: "", w: "8%" }]}
            rows={closings.map(c => [arDate(c.date), fmt(c.expected.total) + " " + cur, fmt(c.actual.total) + " " + cur,
              <span style={{ fontWeight: 700, color: c.diff === 0 ? "#1a8c3e" : c.diff < 0 ? "#c0392b" : "#2a78d6" }}>{c.diff > 0 ? "+" : ""}{fmt(c.diff)}</span>,
              <Badge tone={ST[c.status].t}>{ST[c.status].l}</Badge>, c.assignedTo || "—", c.closedBy,
              <button onClick={() => deleteClosing(c.id)} aria-label="حذف سجل الإغلاق" style={{ background: "none", border: "none", cursor: "pointer", color: C.mt, fontSize: 13 }}>🗑</button>])} />
        )}
      </Card>
    </>
  );
}
