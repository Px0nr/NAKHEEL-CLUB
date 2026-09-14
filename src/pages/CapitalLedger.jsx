import { useState, useMemo } from "react";
import { C, fmt } from "../constants/theme.js";
import { PageTop, Btn, KCard, Card, CardHead, Table, Badge, Modal, Field, Inp, Sel, inputStyle } from "../components/ui.jsx";
import { TrendChart } from "../components/charts.jsx";
import { todayISO, arDate } from "../utils/format.js";
import { payBreakdown } from "../utils/payments.js";
import { downloadCsv, downloadExcel } from "../utils/exportTable.js";
import { DB } from "../db/db.js";

const emptyMove = { type: "ضخ رأس مال", amount: "", method: "كاش", date: todayISO(), note: "" };

/* ============================ CAPITAL LEDGER (رأس المال والسيولة) ============================ */
export default function CapitalLedger({ ctx }) {
  const { invoices, expenses, purchases, payments, capitalMoves, setCapitalMoves, user, showToast, confirm, settings } = ctx;
  const cur = settings?.currency || "د.ل";
  const [modal, setModal] = useState(false);
  const [editingId, setEditingId] = useState(null); // معرّف حركة رأس المال قيد التعديل — null يعني إضافة جديدة
  const [f, setF] = useState(emptyMove);
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState(todayISO());
  const [methodFilter, setMethodFilter] = useState("all");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;
  const normPay = (p) => p === "نقداً" ? "كاش" : p;
  const MOVE_TYPES = ["ضخ رأس مال", "سحب مالك"];
  const TYPE_TONE = { "بيع": "g", "تحصيل دين": "g", "ضخ رأس مال": "b", "مصروف": "r", "توريد": "a", "سداد مورد": "a", "سحب مالك": "r" };

  const openAddMove = () => { setEditingId(null); setF(emptyMove); setModal(true); };
  const openEditMove = (m) => { setEditingId(m.id); setF({ type: m.type, amount: String(m.amount), method: m.method, date: m.date, note: m.note || "" }); setModal(true); };
  const saveMove = () => {
    const amt = parseFloat(f.amount);
    if (!amt || amt <= 0) { showToast("أدخل مبلغاً صحيحاً"); return; }
    if (editingId) {
      setCapitalMoves(cm => cm.map(m => m.id === editingId ? { ...m, date: f.date, type: f.type, amount: amt, method: f.method, note: f.note.trim() } : m));
      showToast("تم تحديث الحركة");
    } else {
      setCapitalMoves(cm => [{ id: "CM-" + Date.now(), date: f.date, type: f.type, amount: amt, method: f.method, note: f.note.trim(), by: user?.name || "—" }, ...cm]);
      showToast(`تم تسجيل ${f.type} بمبلغ ${fmt(amt)} ${cur}`);
    }
    DB.flush("capitalMoves");
    setModal(false); setEditingId(null); setF(emptyMove);
  };
  const deleteMove = async (m) => {
    if (!(await confirm(`حذف حركة «${m.type}» بقيمة ${fmt(m.amount)} ${cur} نهائياً؟`, { danger: true }))) return;
    setCapitalMoves(cm => cm.filter(x => x.id !== m.id));
    DB.flush("capitalMoves");
    showToast("تم حذف الحركة");
  };

  // ------- بناء كشف الحساب: كل حركة أثّرت على السيولة الفعلية، مجمَّعة من كل مصادر النظام -------
  const allEvents = useMemo(() => {
    const ev = [];
    (capitalMoves || []).forEach(m => {
      ev.push({ date: m.date, type: m.type, desc: m.note || m.type, method: m.method, amount: m.type === "سحب مالك" ? -m.amount : m.amount, by: m.by, sortKey: m.id, moveId: m.id });
    });
    invoices.filter(i => i.status === "مدفوعة" && i.pay !== "آجل").forEach(i => {
      // الفاتورة المقسَّمة تدخل الدفتر كحركة لكل طريقة — قيدها كمبلغ واحد على
      // طريقة واحدة يخلط النقد بالبطاقة في رصيد الخزينة
      payBreakdown(i).forEach((pt, n) => {
        ev.push({ date: i.date, type: "بيع", desc: `فاتورة #${i.id} — ${i.customer}`, method: pt.method, amount: pt.amount, by: i.by, sortKey: String(i.id) + ":" + n });
      });
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

  // الرصيد الافتتاحي عند بداية النطاق المفلتَر — كان اختيار «من تاريخ» يعرض
  // حركات الفترة بلا أي مرجعية لما كان عليه الرصيد قبلها مباشرة، فيصعب
  // التوفيق مع كشف حساب محاسبي لفترة محددة
  const openingBalance = useMemo(() => {
    if (!from) return null;
    const before = withBalance.filter(e => e.date < from);
    if (!before.length) return { "كاش": 0, "بطاقة": 0, "تحويل": 0, total: 0 };
    const last = before[before.length - 1];
    return { ...last.balances, total: last.totalAfter };
  }, [withBalance, from]);

  const shownAll = withBalance.filter(e =>
    (!from || e.date >= from) && e.date <= to &&
    (methodFilter === "all" || e.method === methodFilter) &&
    (!q || e.desc.includes(q) || e.type.includes(q))
  ).slice().reverse();
  const totalPages = Math.max(1, Math.ceil(shownAll.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const shown = shownAll.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);
  const exportSheet = () => [{
    name: "كشف الحساب",
    thead: ["التاريخ", "النوع", "الوصف", "الطريقة", "المبلغ", "رصيد الطريقة بعدها", "الإجمالي بعدها"],
    tbody: shownAll.map(e => [e.date, e.type, e.desc, e.method, e.amount, e.balances[e.method] ?? e.balances["كاش"], e.totalAfter]),
  }];

  // اتجاه الرصيد الإجمالي آخر 30 يوماً — رسم بياني بدل قراءة جدول نصي فقط،
  // بترحيل آخر رصيد معروف لأي يوم بلا حركات (لا يهبط للصفر بغير سبب)
  const trendSeries = useMemo(() => {
    const days = 30;
    const dates = Array.from({ length: days }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (days - 1 - i)); return d.toISOString().slice(0, 10); });
    let running = 0, wbI = 0;
    return dates.map(day => {
      while (wbI < withBalance.length && withBalance[wbI].date <= day) { running = withBalance[wbI].totalAfter; wbI++; }
      return Math.max(0, running);
    });
  }, [withBalance]);

  return (
    <>
      <PageTop title="🏦 رأس المال والسيولة" action={<Btn gold onClick={openAddMove}>+ حركة رأس مال</Btn>} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 11, marginBottom: "1.1rem" }}>
        <KCard label="💵 الرصيد الحالي — كاش" value={fmt(currentBalance["كاش"])} sub={cur} bar="#1a8c3e" />
        <KCard label="💳 الرصيد الحالي — بطاقة" value={fmt(currentBalance["بطاقة"])} sub={cur} bar="#2a78d6" />
        <KCard label="🏦 الرصيد الحالي — تحويل" value={fmt(currentBalance["تحويل"])} sub={cur} bar={C.purp} />
        <KCard label="الإجمالي" value={fmt(totalBalance)} sub={cur} bar={C.gold} />
      </div>

      <Card style={{ marginBottom: "1.1rem" }}>
        <CardHead title="📈 اتجاه الرصيد الإجمالي" sub="آخر 30 يوماً" />
        <TrendChart curSeries={trendSeries} prevSeries={trendSeries.map(() => null)} colorA={C.grl} colorB={C.gold} cur={cur} />
      </Card>

      <Card style={{ marginBottom: "1.1rem" }}>
        <CardHead title="كشف الحساب الكامل" sub={`${fmt(shownAll.length)} حركة — كل عملية أثّرت على سيولتك منذ البداية`} right={
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            <input value={q} onChange={e => { setQ(e.target.value); setPage(1); }} placeholder="بحث بالوصف أو النوع..." style={{ ...inputStyle, width: 170 }} />
            <Inp type="date" value={from} onChange={e => { setFrom(e.target.value); setPage(1); }} title="من (اتركه فارغاً لعرض كل التاريخ)" style={{ width: 135 }} />
            <Inp type="date" value={to} onChange={e => { setTo(e.target.value); setPage(1); }} style={{ width: 135 }} />
            <Sel value={methodFilter} onChange={e => { setMethodFilter(e.target.value); setPage(1); }} style={{ width: 110 }}>
              <option value="all">كل الطرق</option><option value="كاش">كاش</option><option value="بطاقة">بطاقة</option><option value="تحويل">تحويل</option>
            </Sel>
            <Btn sm onClick={() => downloadCsv(exportSheet(), `كشف-الحساب-${from || "الكل"}-${to}`)}>⬇ CSV</Btn>
            <Btn sm onClick={() => downloadExcel(exportSheet(), `كشف-الحساب-${from || "الكل"}-${to}`)}>📊 Excel</Btn>
          </div>
        } />
        {openingBalance && (
          <div style={{ background: C.crm, borderRadius: 9, padding: ".55rem .85rem", marginBottom: 10, fontSize: 12, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
            <b>الرصيد الافتتاحي عند {arDate(from)}:</b>
            <span>💵 {fmt(openingBalance["كاش"])} {cur}</span>
            <span>💳 {fmt(openingBalance["بطاقة"])} {cur}</span>
            <span>🏦 {fmt(openingBalance["تحويل"])} {cur}</span>
            <span style={{ fontWeight: 700 }}>الإجمالي: {fmt(openingBalance.total)} {cur}</span>
          </div>
        )}
        {shown.length === 0 ? <div style={{ textAlign: "center", color: C.mt, padding: "1.5rem" }}>لا حركات ضمن الفترة المختارة — سجّل رأس مالك الافتتاحي من «+ حركة رأس مال» للبدء</div> : (
          <>
            <Table cols={[{ h: "التاريخ", w: "10%" }, { h: "النوع", w: "12%" }, { h: "الوصف", w: "23%" }, { h: "الطريقة", w: "8%" }, { h: "المبلغ", w: "12%" }, { h: "رصيد الطريقة بعدها", w: "13%" }, { h: "الإجمالي بعدها", w: "12%" }, { h: "", w: "10%" }]}
              rows={shown.map(e => {
                const methodBal = e.balances[e.method] !== undefined ? e.balances[e.method] : e.balances["كاش"];
                const move = e.moveId != null ? capitalMoves.find(m => m.id === e.moveId) : null;
                return [
                  arDate(e.date), <Badge tone={TYPE_TONE[e.type] || "b"}>{e.type}</Badge>, e.desc, e.method,
                  <span style={{ fontWeight: 700, color: e.amount >= 0 ? "#1a8c3e" : C.red }}>{e.amount >= 0 ? "+" : ""}{fmt(e.amount)} {cur}</span>,
                  <span style={{ fontWeight: methodBal < 0 ? 800 : 400, color: methodBal < 0 ? C.red : "inherit" }}>{methodBal < 0 && "⚠ "}{fmt(methodBal)} {cur}</span>,
                  <b style={{ color: e.totalAfter < 0 ? C.red : "inherit" }}>{e.totalAfter < 0 && "⚠ "}{fmt(e.totalAfter)} {cur}</b>,
                  move ? <div style={{ display: "flex", gap: 4 }}><Btn sm onClick={() => openEditMove(move)}>✎</Btn><Btn sm danger onClick={() => deleteMove(move)}>🗑</Btn></div> : null,
                ];
              })} />
            {totalPages > 1 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 12, paddingTop: 10, borderTop: `0.5px solid ${C.bc}` }}>
                <Btn sm onClick={() => setPage(p => Math.max(1, p - 1))} style={{ opacity: pageSafe === 1 ? .4 : 1 }}>‹ السابق</Btn>
                <span style={{ fontSize: 12, color: C.mt }}>صفحة {pageSafe} من {totalPages}</span>
                <Btn sm onClick={() => setPage(p => Math.min(totalPages, p + 1))} style={{ opacity: pageSafe === totalPages ? .4 : 1 }}>التالي ›</Btn>
              </div>
            )}
          </>
        )}
      </Card>

      {/* نافذة إضافة/تعديل حركة رأس مال */}
      {modal && (
        <Modal title={editingId ? "تعديل حركة رأس مال" : "حركة رأس مال"} onClose={() => { setModal(false); setEditingId(null); }} width={440}>
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
          <div style={{ display: "flex", gap: 8 }}><Btn gold onClick={saveMove} style={{ flex: 1, justifyContent: "center" }}>✓ {editingId ? "حفظ التعديلات" : "تسجيل الحركة"}</Btn><Btn onClick={() => { setModal(false); setEditingId(null); }}>إلغاء</Btn></div>
        </Modal>
      )}
    </>
  );
}
