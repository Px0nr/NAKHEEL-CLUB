import { useState, useMemo } from "react";
import { C, fmt } from "../constants/theme.js";
import { PageTop, Btn, KCard, Card, CardHead, Table, Badge, Modal, Field, Inp, Sel } from "../components/ui.jsx";
import { todayISO, arDate } from "../utils/format.js";
import { DB } from "../db/db.js";

/* ============================ CAPITAL LEDGER (رأس المال والسيولة) ============================ */
export default function CapitalLedger({ ctx }) {
  const { invoices, expenses, purchases, payments, capitalMoves, setCapitalMoves, user, showToast, settings } = ctx;
  const cur = settings?.currency || "د.ل";
  const [modal, setModal] = useState(false);
  const [f, setF] = useState({ type: "ضخ رأس مال", amount: "", method: "كاش", date: todayISO(), note: "" });
  const [from, setFrom] = useState("");
  const [to, setTo] = useState(todayISO());
  const [methodFilter, setMethodFilter] = useState("all");
  const normPay = (p) => p === "نقداً" ? "كاش" : p;
  const MOVE_TYPES = ["ضخ رأس مال", "سحب مالك"];
  const TYPE_TONE = { "بيع": "g", "تحصيل دين": "g", "ضخ رأس مال": "b", "مصروف": "r", "توريد": "a", "سداد مورد": "a", "سحب مالك": "r" };

  const saveMove = () => {
    const amt = parseFloat(f.amount);
    if (!amt || amt <= 0) { showToast("أدخل مبلغاً صحيحاً"); return; }
    setCapitalMoves(cm => [{ id: "CM-" + Date.now(), date: f.date, type: f.type, amount: amt, method: f.method, note: f.note.trim(), by: user?.name || "—" }, ...cm]);
    DB.flush("capitalMoves");
    showToast(`تم تسجيل ${f.type} بمبلغ ${fmt(amt)} ${cur}`);
    setModal(false); setF({ type: "ضخ رأس مال", amount: "", method: "كاش", date: todayISO(), note: "" });
  };

  // ------- بناء كشف الحساب: كل حركة أثّرت على السيولة الفعلية، مجمَّعة من كل مصادر النظام -------
  const allEvents = useMemo(() => {
    const ev = [];
    (capitalMoves || []).forEach(m => {
      ev.push({ date: m.date, type: m.type, desc: m.note || m.type, method: m.method, amount: m.type === "سحب مالك" ? -m.amount : m.amount, by: m.by, sortKey: m.id });
    });
    invoices.filter(i => i.status === "مدفوعة" && i.pay !== "آجل").forEach(i => {
      ev.push({ date: i.date, type: "بيع", desc: `فاتورة #${i.id} — ${i.customer}`, method: i.pay, amount: i.total, by: i.by, sortKey: String(i.id) });
    });
    payments.filter(p => p.kind === "قبض").forEach(p => {
      ev.push({ date: p.date, type: "تحصيل دين", desc: `من ${p.party}`, method: p.via, amount: p.amount, by: p.by, sortKey: p.id });
    });
    expenses.forEach(e => {
      ev.push({ date: e.date, type: "مصروف", desc: `${e.cat} — ${e.desc}`, method: normPay(e.pay), amount: -e.amount, by: e.by, sortKey: "EX" + e.id });
    });
    purchases.filter(p => p.pay !== "آجل").forEach(p => {
      ev.push({ date: p.date, type: "توريد", desc: `${p.supplier} — ${p.id}`, method: normPay(p.pay), amount: -p.total, by: p.by, sortKey: String(p.id) });
    });
    payments.filter(p => p.kind === "صرف").forEach(p => {
      ev.push({ date: p.date, type: "سداد مورد", desc: `إلى ${p.party}`, method: p.via, amount: -p.amount, by: p.by, sortKey: p.id });
    });
    return ev.sort((a, b) => a.date === b.date ? String(a.sortKey).localeCompare(String(b.sortKey)) : a.date.localeCompare(b.date));
  }, [capitalMoves, invoices, payments, expenses, purchases]);

  // رصيد تراكمي لكل طريقة + إجمالي، محسوب بمرور واحد تصاعدي زمنياً
  const withBalance = useMemo(() => {
    const bal = { "كاش": 0, "بطاقة": 0, "تحويل": 0 };
    return allEvents.map(e => {
      const m = bal[e.method] !== undefined ? e.method : "كاش"; // احتياط لأي قيمة طريقة غير متوقعة
      bal[m] = Math.round((bal[m] + e.amount) * 100) / 100;
      return { ...e, balances: { ...bal }, totalAfter: Math.round((bal["كاش"] + bal["بطاقة"] + bal["تحويل"]) * 100) / 100 };
    });
  }, [allEvents]);

  const current = withBalance.length ? withBalance[withBalance.length - 1] : null;
  const currentBalance = current ? current.balances : { "كاش": 0, "بطاقة": 0, "تحويل": 0 };
  const totalBalance = current ? current.totalAfter : 0;

  const shown = withBalance.filter(e =>
    (!from || e.date >= from) && e.date <= to &&
    (methodFilter === "all" || e.method === methodFilter)
  ).slice().reverse();

  return (
    <>
      <PageTop title="🏦 رأس المال والسيولة" action={<Btn gold onClick={() => setModal(true)}>+ حركة رأس مال</Btn>} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 11, marginBottom: "1.1rem" }}>
        <KCard label="💵 الرصيد الحالي — كاش" value={fmt(currentBalance["كاش"])} sub={cur} bar="#1a8c3e" />
        <KCard label="💳 الرصيد الحالي — بطاقة" value={fmt(currentBalance["بطاقة"])} sub={cur} bar="#2a78d6" />
        <KCard label="🏦 الرصيد الحالي — تحويل" value={fmt(currentBalance["تحويل"])} sub={cur} bar={C.purp} />
        <KCard label="الإجمالي" value={fmt(totalBalance)} sub={cur} bar={C.gold} />
      </div>

      <Card style={{ marginBottom: "1.1rem" }}>
        <CardHead title="كشف الحساب الكامل" sub={`${fmt(shown.length)} حركة — كل عملية أثّرت على سيولتك منذ البداية`} right={
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            <Inp type="date" value={from} onChange={e => setFrom(e.target.value)} title="من (اتركه فارغاً لعرض كل التاريخ)" style={{ width: 135 }} />
            <Inp type="date" value={to} onChange={e => setTo(e.target.value)} style={{ width: 135 }} />
            <Sel value={methodFilter} onChange={e => setMethodFilter(e.target.value)} style={{ width: 110 }}>
              <option value="all">كل الطرق</option><option value="كاش">كاش</option><option value="بطاقة">بطاقة</option><option value="تحويل">تحويل</option>
            </Sel>
          </div>
        } />
        {shown.length === 0 ? <div style={{ textAlign: "center", color: C.mt, padding: "1.5rem" }}>لا حركات ضمن الفترة المختارة — سجّل رأس مالك الافتتاحي من «+ حركة رأس مال» للبدء</div> : (
          <Table cols={[{ h: "التاريخ", w: "11%" }, { h: "النوع", w: "13%" }, { h: "الوصف", w: "26%" }, { h: "الطريقة", w: "9%" }, { h: "المبلغ", w: "13%" }, { h: "رصيد الطريقة بعدها", w: "14%" }, { h: "الإجمالي بعدها", w: "14%" }]}
            rows={shown.map(e => [
              arDate(e.date), <Badge tone={TYPE_TONE[e.type] || "b"}>{e.type}</Badge>, e.desc, e.method,
              <span style={{ fontWeight: 700, color: e.amount >= 0 ? "#1a8c3e" : C.red }}>{e.amount >= 0 ? "+" : ""}{fmt(e.amount)} {cur}</span>,
              fmt(e.balances[e.method] !== undefined ? e.balances[e.method] : e.balances["كاش"]) + " " + cur,
              <b>{fmt(e.totalAfter)} {cur}</b>,
            ])} />
        )}
      </Card>

      {/* نافذة إضافة حركة رأس مال */}
      {modal && (
        <Modal title="حركة رأس مال" onClose={() => setModal(false)} width={440}>
          <Field label="نوع الحركة">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {MOVE_TYPES.map(t => (
                <div key={t} onClick={() => setF({ ...f, type: t })} style={{ border: `1.5px solid ${f.type === t ? C.gold : C.bc}`, borderRadius: 9, padding: ".6rem", textAlign: "center", cursor: "pointer", fontWeight: f.type === t ? 700 : 500, background: f.type === t ? C.gold + "14" : C.crm, fontSize: 13 }}>{t === "ضخ رأس مال" ? "➕ ضخ سيولة" : "➖ سحب مالك"}</div>
              ))}
            </div>
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label={"المبلغ (" + cur + ")"}><Inp type="number" min="0" value={f.amount} onChange={e => setF({ ...f, amount: e.target.value })} /></Field>
            <Field label="التاريخ"><Inp type="date" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} /></Field>
          </div>
          <Field label="الطريقة">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
              {["كاش", "بطاقة", "تحويل"].map(m => (
                <div key={m} onClick={() => setF({ ...f, method: m })} style={{ border: `1px solid ${f.method === m ? C.gold : C.bc}`, borderRadius: 8, padding: ".4rem", textAlign: "center", cursor: "pointer", fontSize: 12, fontWeight: f.method === m ? 700 : 500, background: f.method === m ? C.gold + "14" : C.crm }}>{m}</div>
              ))}
            </div>
          </Field>
          <Field label="ملاحظة (اختياري)"><Inp value={f.note} onChange={e => setF({ ...f, note: e.target.value })} placeholder={f.type === "ضخ رأس مال" ? "مثال: رأس مال افتتاحي" : "مثال: سحب أرباح شخصية"} /></Field>
          <div style={{ fontSize: 10.5, color: C.mt, margin: "4px 0 12px", lineHeight: 1.7 }}>💡 استخدم «ضخ سيولة» عند إضافة أموال جديدة للنادي (رأس مال افتتاحي أو دعم إضافي)، و«سحب مالك» عند سحب أرباح لنفسك — كلاهما يُحتسب في كشف الحساب والرصيد الحالي فوراً.</div>
          <div style={{ display: "flex", gap: 8 }}><Btn gold onClick={saveMove} style={{ flex: 1, justifyContent: "center" }}>✓ تسجيل الحركة</Btn><Btn onClick={() => setModal(false)}>إلغاء</Btn></div>
        </Modal>
      )}
    </>
  );
}
