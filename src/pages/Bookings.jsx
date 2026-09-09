import { useState, useEffect, useRef } from "react";
import { C, fmt } from "../constants/theme.js";
import { TYPE_ICON, TYPE_NAME, TYPE_DEFAULT_RATE } from "../constants/seeds.js";
import { PageTop, Btn, KCard, Card, CardHead, Table, Badge, Modal, Field, Inp, Sel } from "../components/ui.jsx";
import { todayISO, arDate } from "../utils/format.js";
import { rangePreset, QUICK_RANGES } from "../utils/analytics.js";
import { downloadCsv, downloadExcel } from "../utils/exportTable.js";
import { customerSaleDelta, applyCustomerSale } from "../utils/customerLink.js";
import { findConflict, nextReservationToday, isOverdue } from "../utils/reservations.js";
import { playTimeUpAlarm } from "../utils/sound.js";

/* ============================ BOOKINGS ============================ */
export default function Bookings({ ctx }) {
  const { bookings, setBookings, completedBookings, setCompletedBookings, reservations, setReservations, setInvoices, tables, setTables, cancellations, setCancellations, customers, setCustomers, user, showToast, confirm, settings } = ctx;
  const cur = settings?.currency || "د.ل";
  const [modal, setModal] = useState(false);
  const [manageModal, setManageModal] = useState(false);
  const [editTable, setEditTable] = useState(null); // table being edited/added
  const [type, setType] = useState("billiard");
  const [tableId, setTableId] = useState(null);
  const [customer, setCustomer] = useState("");
  const [bkCustomerId, setBkCustomerId] = useState(null);
  const [duration, setDuration] = useState("60"); // بالدقائق: 15 | 30 | 60 | مفتوح (open)
  const [bkPay, setBkPay] = useState("كاش");
  const [bookMode, setBookMode] = useState("now"); // now | later — حجز مسبق بموعد مستقبلي
  const [resStartAt, setResStartAt] = useState("");
  const [cancelModal, setCancelModal] = useState(false);
  const [cancelForm, setCancelForm] = useState({ customer: "", resType: "billiard", reason: "عدم حضور", note: "", date: todayISO() });
  const CANCEL_REASONS = ["عدم حضور", "إلغاء بطلب الزبون", "خطأ في التسجيل", "أخرى"];
  const [, force] = useState(0);
  // مراجع دائمة التحديث لأحدث bookings/settings — المؤقّت أدناه يُثبَّت مرة واحدة
  // فقط (بلا اعتماديات) فيرى قيماً قديمة بدونها (نفس نمط addByCodeRef في POS.jsx)
  const bookingsRef = useRef(bookings);
  bookingsRef.current = bookings;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const alarmedRef = useRef({}); // bookingId -> وقت آخر تنبيه صوتي
  const ALARM_REPEAT_MS = 30000; // يتكرّر كل نصف دقيقة حتى تُنهى الطاولة
  const WARNING_MS = 5 * 60000; // آخر 5 دقائق من الحجز تُعرض بلون تحذيري كهرماني
  useEffect(() => {
    const t = setInterval(() => {
      force(x => x + 1);
      const live = bookingsRef.current;
      const now = Date.now();
      // ينظّف أي مفتاح لحجز لم يعد نشطاً — بلا هذا يتراكم بلا حدّ عبر جلسة طويلة
      Object.keys(alarmedRef.current).forEach(id => { if (!live[id]) delete alarmedRef.current[id]; });
      if (settingsRef.current?.soundAlerts === false) return;
      Object.entries(live).forEach(([id, b]) => {
        if (!b.prepaid || b.durationMin == null) return; // الحجز المفتوح بلا وقت يُنتهى
        const over = (b.startTime + b.durationMin * 60000) - now <= 0;
        if (!over) { delete alarmedRef.current[id]; return; }
        const last = alarmedRef.current[id] || 0;
        if (now - last >= ALARM_REPEAT_MS) { playTimeUpAlarm(); alarmedRef.current[id] = now; }
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);
  // فلتر النطاق الزمني وسجل الحجوزات المكتملة (يتبعه التصدير أيضاً) — كان السجل
  // كله يُعرض بلا تاريخ ولا فلترة، فالبطاقات أعلاه كانت تجمع تاريخ النظام كله
  // رغم تسميتها «اليوم»
  const [cbFrom, setCbFrom] = useState(todayISO());
  const [cbTo, setCbTo] = useState(todayISO());
  const cbApplyQuickRange = (key) => { const r = rangePreset(key); setCbFrom(r.from); setCbTo(r.to); };

  const logCancellation = (data) => setCancellations(cs => [{ id: "CN-" + Date.now(), by: user?.name || "—", ...data }, ...cs]);
  const saveCancelLog = () => {
    if (!cancelForm.customer.trim()) { showToast("أدخل اسم الزبون"); return; }
    logCancellation({ date: cancelForm.date, customer: cancelForm.customer.trim(), resType: cancelForm.resType, reason: cancelForm.reason, note: cancelForm.note.trim() });
    showToast("تم تسجيل الإلغاء/عدم الحضور");
    setCancelModal(false); setCancelForm({ customer: "", resType: "billiard", reason: "عدم حضور", note: "", date: todayISO() });
  };
  // إلغاء حجز نشط حالياً بدون فوترة (مثلاً بدأ بالخطأ) — يحرّر الطاولة ويُسجَّل في سجل الإلغاءات
  const cancelActive = async (id) => {
    const b = bookings[id]; if (!b) return;
    if (!(await confirm(`إلغاء حجز ${b.tableName} دون إصدار فاتورة؟`))) return;
    logCancellation({ date: todayISO(), customer: b.customer, resType: b.type, resName: b.tableName, reason: "خطأ في التسجيل", note: "أُلغي أثناء الحجز النشط" });
    setBookings(bk => { const n = { ...bk }; delete n[id]; return n; });
    showToast("أُلغي الحجز وحُرّرت الطاولة");
  };

  const tablesByType = (t) => tables.filter(x => x.type === t);
  const busy = (tid) => Object.values(bookings).some(b => b.tableId === tid);
  const rateOf = (tid) => tables.find(t => t.id === tid)?.rate || 0;
  // سعر المدة حسب سعر الساعة (النصف والربع تناسبياً)
  const priceForDuration = (rate, mins) => {
    if (mins === "open") return 0;
    return Math.round(rate * (parseInt(mins) / 60) * 10) / 10;
  };
  const DUR_OPTS = [{ v: "15", l: "ربع ساعة", s: "15 دقيقة" }, { v: "30", l: "نصف ساعة", s: "30 دقيقة" }, { v: "60", l: "ساعة كاملة", s: "60 دقيقة" }, { v: "open", l: "وقت مفتوح", s: "عدّاد حر" }];

  const start = (tbl, cust, mins, pay, customerId = null) => {
    const id = "bk_" + Date.now();
    const isOpen = mins === "open";
    const price = isOpen ? 0 : priceForDuration(tbl.rate, mins);
    const deferred = !isOpen && pay === "آجل";
    setBookings(b => ({ ...b, [id]: {
      type: tbl.type, tableId: tbl.id, tableName: tbl.name, customer: cust || "زبون", customerId,
      startTime: Date.now(), rate: tbl.rate,
      durationMin: isOpen ? null : parseInt(mins), // null = مفتوح
      prepaid: !isOpen, prepaidAmount: price, pay: pay || "كاش",
    } }));
    // الحجز محدد المدة يُدفع مقدماً → أنشئ الفاتورة فوراً
    if (!isOpen) {
      const invNum = "INV-BK-" + ctx.nextCounter("bkInvoice");
      const durStr = mins === "15" ? "ربع ساعة" : mins === "30" ? "نصف ساعة" : "ساعة";
      setInvoices(iv => [{ id: invNum, customer: cust || "زبون", customerId, date: todayISO(), source: "حجز", details: `${TYPE_NAME[tbl.type]} — ${tbl.name} — ${durStr}`, resType: tbl.type, resName: tbl.name, items: [{ cat: "__booking", name: `${TYPE_NAME[tbl.type]} — ${tbl.name}`, qty: 1, lineTotal: price }], pay: deferred ? "آجل" : pay, discount: "—", total: price, cost: 0, status: deferred ? "معلقة" : "مدفوعة", ...(deferred ? { dueDate: todayISO() } : {}), by: user?.name || "—", time: new Date().toTimeString().slice(0, 5) }, ...iv]);
      if (customerId != null) applyCustomerSale(setCustomers, customerId, customerSaleDelta({ total: price, deferred, settings }), { date: todayISO() });
      showToast(`تم تأكيد الحجز — ${durStr} بـ ${fmt(price)} ${cur} (${deferred ? "آجل" : pay}) · فاتورة #${invNum}`);
    } else {
      showToast(`بدأ حجز مفتوح على ${tbl.name} — العدّاد يعمل`);
    }
  };

  const stop = (id) => {
    const b = bookings[id]; if (!b) return;
    // الحجز المدفوع مقدماً: أُنشئت فاتورته عند البدء — الإنهاء يحرّر الطاولة فقط
    if (b.prepaid) {
      setCompletedBookings(cb => [{ type: b.type, tableName: b.tableName, customer: b.customer, dur: b.durationMin >= 60 ? "ساعة" : b.durationMin === 30 ? "نصف ساعة" : "ربع ساعة", rate: b.rate, total: b.prepaidAmount, inv: "مدفوع مقدماً", date: todayISO() }, ...cb]);
      setBookings(bk => { const n = { ...bk }; delete n[id]; return n; });
      showToast(`انتهى حجز ${b.tableName}`);
      return;
    }
    // الحجز المفتوح: يُحسب بالوقت الفعلي وتُنشأ فاتورته الآن
    const ms = Date.now() - b.startTime;
    const hours = ms / 3600000;
    const total = Math.max(b.rate * 0.25, hours * b.rate);
    const durMin = Math.round(ms / 60000);
    const durStr = durMin >= 60 ? `${Math.floor(durMin / 60)}س ${durMin % 60}د` : `${durMin}د`;
    const invNum = "INV-AUTO-" + ctx.nextCounter("autoInvoice");
    const roundedTotal = Math.round(total * 10) / 10;
    setCompletedBookings(cb => [{ type: b.type, tableName: b.tableName, customer: b.customer, dur: durStr, rate: b.rate, total, inv: invNum, date: todayISO() }, ...cb]);
    setInvoices(iv => [{ id: invNum, customer: b.customer, customerId: b.customerId, date: todayISO(), source: "حجز", details: `${TYPE_NAME[b.type]} — ${b.tableName} — ${durStr}`, resType: b.type, resName: b.tableName, items: [{ cat: "__booking", name: `${TYPE_NAME[b.type]} — ${b.tableName}`, qty: 1, lineTotal: roundedTotal }], pay: b.pay || "كاش", discount: "—", total: roundedTotal, cost: 0, status: "مدفوعة", by: user?.name || "—", time: new Date().toTimeString().slice(0, 5) }, ...iv]);
    if (b.customerId != null) applyCustomerSale(setCustomers, b.customerId, customerSaleDelta({ total: roundedTotal, deferred: false, settings }), { date: todayISO() });
    setBookings(bk => { const n = { ...bk }; delete n[id]; return n; });
    showToast(`فاتورة تلقائية #${invNum} — ${fmt(roundedTotal)} ${cur}`);
  };

  // اختيار زبون مسجَّل للحجز — يملأ الاسم ويربط العملية بسجله (نقاط ولاء، بيع
  // آجل، إجمالي مشتريات حقيقي) بدل اسم حرّ منفصل عن سجل الزبائن تماماً
  const pickBkCustomer = (id) => {
    const c = customers.find(x => String(x.id) === String(id));
    if (c) { setCustomer(c.name); setBkCustomerId(c.id); }
  };
  const resetBookingModal = () => {
    setCustomer(""); setBkCustomerId(null); setDuration("60"); setBkPay("كاش"); setBookMode("now"); setResStartAt("");
  };

  // حجز مسبق بموعد مستقبلي — يُخزَّن في reservations منفصلة عن bookings النشطة
  // ولا يُنشئ فاتورة إلا عند تسجيل الوصول الفعلي (checkInReservation)
  const createReservation = () => {
    const tbl = tables.find(x => x.id === tableId);
    if (!tbl) { showToast("اختر طاولة"); return; }
    if (!customer.trim()) { showToast("أدخل اسم الزبون"); return; }
    if (duration === "open") { showToast("الحجز المسبق يتطلب مدة محددة — الوقت المفتوح لا يناسب موعداً مستقبلياً"); return; }
    if (!resStartAt) { showToast("اختر تاريخ ووقت الحجز"); return; }
    const start = new Date(resStartAt).getTime();
    if (isNaN(start) || start < Date.now() - 60000) { showToast("اختر موعداً في المستقبل"); return; }
    if (bkPay === "آجل" && !bkCustomerId) { showToast("البيع الآجل يتطلب اختيار زبون مسجَّل"); return; }
    const mins = parseInt(duration);
    const end = start + mins * 60000;
    const conflict = findConflict(tableId, start, end, { bookings, reservations });
    if (conflict) {
      const at = new Date(conflict.start).toLocaleTimeString("ar-LY", { hour: "2-digit", minute: "2-digit" });
      showToast(`تعارض: ${tbl.name} محجوزة لـ${conflict.customer} الساعة ${at} — اختر موعداً آخر`);
      return;
    }
    const price = priceForDuration(tbl.rate, duration);
    setReservations(rs => [...rs, {
      id: "RS-" + Date.now(), tableId, tableName: tbl.name, type, customerName: customer.trim(), customerId: bkCustomerId,
      startAt: new Date(start).toISOString(), durationMin: mins, rate: tbl.rate, price, pay: bkPay, status: "محجوز", createdAt: todayISO(), by: user?.name || "—",
    }]);
    showToast(`تم حجز ${tbl.name} لـ${customer.trim()} الساعة ${new Date(start).toLocaleTimeString("ar-LY", { hour: "2-digit", minute: "2-digit" })}`);
    setModal(false); resetBookingModal();
  };

  // تسجيل وصول صاحب حجز مسبق — يتحوّل إلى حجز نشط عادي بنفس السعر والمدة
  // المتفق عليهما وقت الحجز (لا سعر الطاولة الحالي إن تغيّر لاحقاً)
  const checkInReservation = (res) => {
    if (busy(res.tableId)) { showToast("الطاولة مشغولة الآن بحجز آخر — أنهِه أولاً"); return; }
    const id = "bk_" + Date.now();
    const deferred = res.pay === "آجل";
    setBookings(b => ({ ...b, [id]: {
      type: res.type, tableId: res.tableId, tableName: res.tableName, customer: res.customerName, customerId: res.customerId,
      startTime: Date.now(), rate: res.rate, durationMin: res.durationMin, prepaid: true, prepaidAmount: res.price, pay: res.pay,
    } }));
    const invNum = "INV-BK-" + ctx.nextCounter("bkInvoice");
    const durStr = res.durationMin >= 60 ? "ساعة" : res.durationMin === 30 ? "نصف ساعة" : "ربع ساعة";
    setInvoices(iv => [{ id: invNum, customer: res.customerName, customerId: res.customerId, date: todayISO(), source: "حجز", details: `${TYPE_NAME[res.type]} — ${res.tableName} — ${durStr}`, resType: res.type, resName: res.tableName, items: [{ cat: "__booking", name: `${TYPE_NAME[res.type]} — ${res.tableName}`, qty: 1, lineTotal: res.price }], pay: deferred ? "آجل" : res.pay, discount: "—", total: res.price, cost: 0, status: deferred ? "معلقة" : "مدفوعة", ...(deferred ? { dueDate: todayISO() } : {}), by: user?.name || "—", time: new Date().toTimeString().slice(0, 5) }, ...iv]);
    if (res.customerId != null) applyCustomerSale(setCustomers, res.customerId, customerSaleDelta({ total: res.price, deferred, settings }), { date: todayISO() });
    setReservations(rs => rs.filter(r => r.id !== res.id));
    showToast(`تم تسجيل وصول ${res.customerName} — ${res.tableName}`);
  };

  const cancelReservation = async (res) => {
    if (!(await confirm(`إلغاء حجز ${res.tableName} لـ${res.customerName}؟`))) return;
    logCancellation({ date: todayISO(), customer: res.customerName, resType: res.type, resName: res.tableName, reason: "إلغاء بطلب الزبون", note: "حجز مسبق" });
    setReservations(rs => rs.filter(r => r.id !== res.id));
    showToast("أُلغي الحجز المسبق");
  };
  const noShowReservation = async (res) => {
    if (!(await confirm(`تسجيل عدم حضور ${res.customerName} لحجز ${res.tableName}؟`))) return;
    logCancellation({ date: todayISO(), customer: res.customerName, resType: res.type, resName: res.tableName, reason: "عدم حضور", note: "حجز مسبق — لم يصل بعد مضي مهلة السماح" });
    setReservations(rs => rs.filter(r => r.id !== res.id));
    showToast("سُجِّل عدم الحضور");
  };
  const todayReservations = [...reservations].filter(r => r.status === "محجوز" && r.startAt.slice(0, 10) === todayISO()).sort((a, b) => a.startAt.localeCompare(b.startAt));

  const elapsed = (st) => {
    const ms = Date.now() - st;
    const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };
  const busyCount = Object.keys(bookings).length;
  // بلا حقل تاريخ سابقاً، فكانت هذه البطاقات المسمّاة «اليوم» تجمع تاريخ النظام
  // كله منذ التركيب — أصبحت الآن تُقيَّد فعلياً بتاريخ اليوم
  const todayCompleted = completedBookings.filter(b => b.date === todayISO());
  const todayRev = todayCompleted.reduce((s, b) => s + b.total, 0);
  // سجل الحجوزات المكتملة: فلترة وتصدير — نفس نمط سجل المبيعات
  const cbShown = completedBookings.filter(b => (!cbFrom || (b.date || "") >= cbFrom) && (!cbTo || (b.date || "") <= cbTo));
  const cbExportSheet = () => [{
    name: "الحجوزات المكتملة",
    thead: ["النشاط", "الطاولة", "الزبون", "المدة", "السعر/ساعة", "الإجمالي", "الفاتورة", "التاريخ"],
    tbody: cbShown.map(b => [TYPE_NAME[b.type] || b.type, b.tableName, b.customer, b.dur, b.rate, Math.round(b.total * 10) / 10, b.inv, b.date || "—"]),
  }];

  /* ---- table management ---- */
  const saveTable = (data) => {
    if (!data.name.trim()) { showToast("أدخل اسم الطاولة"); return; }
    const rate = parseFloat(data.rate) || TYPE_DEFAULT_RATE[data.type] || 0;
    if (data.id && tables.some(t => t.id === data.id)) {
      // edit
      setTables(ts => ts.map(t => t.id === data.id ? { ...t, name: data.name.trim(), rate, type: data.type } : t));
      showToast("تم تحديث الطاولة");
    } else {
      // add
      const newId = data.type[0] + Date.now().toString().slice(-5);
      setTables(ts => [...ts, { id: newId, type: data.type, name: data.name.trim(), rate }]);
      showToast("تمت إضافة الطاولة");
    }
    setEditTable(null);
  };
  const deleteTable = (tid) => {
    if (busy(tid)) { showToast("لا يمكن حذف طاولة مشغولة — أنهِ الحجز أولاً"); return; }
    setTables(ts => ts.filter(t => t.id !== tid));
    showToast("تم حذف الطاولة");
  };

  const openNewBooking = () => {
    const first = tablesByType("billiard")[0] || tables[0];
    if (first) { setType(first.type); setTableId(first.id); }
    resetBookingModal();
    setModal(true);
  };

  return (
    <>
      <PageTop title="حجز الطاولات — اللوحة الحية" action={
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
          <Btn onClick={() => setManageModal(true)}>⚙ إدارة الطاولات</Btn>
          <Btn onClick={() => { setCancelForm({ customer: "", resType: "billiard", reason: "عدم حضور", note: "", date: todayISO() }); setCancelModal(true); }}>✕ تسجيل إلغاء / عدم حضور</Btn>
          <Btn gold onClick={openNewBooking}>+ حجز جديد</Btn>
        </div>
      } />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 11, marginBottom: "1.1rem" }}>
        <KCard label="مشغولة الآن" value={busyCount} sub={`من ${tables.length} طاولة`} bar="#1a8c3e" />
        <KCard label="إيراد الحجوزات" value={fmt(todayRev)} sub={cur} bar={C.gold} />
        <KCard label="حجوزات مكتملة" value={todayCompleted.length} sub="اليوم" bar="#2a78d6" />
        <KCard label="فواتير تلقائية" value={todayCompleted.length} sub="اليوم — عند الخروج" bar={C.purp} />
      </div>
      <Card>
        <CardHead title="حالة الطاولات والملاعب — مباشر" sub="🟢 تحديث تلقائي كل ثانية" />
        {tables.length === 0 ? (
          <div style={{ textAlign: "center", padding: "2rem", color: C.mt }}>لا توجد طاولات — اضغط «إدارة الطاولات» لإضافة أول طاولة.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(165px,1fr))", gap: 12 }}>
            {tables.map(tb => {
              const entry = Object.entries(bookings).find(([, b]) => b.tableId === tb.id);
              if (entry) {
                const [id, b] = entry;
                return (
                  <div key={tb.id} style={{ borderRadius: 13, padding: ".9rem", border: "1px solid rgba(201,168,76,.4)", background: "linear-gradient(135deg,#fff7eb,#fff)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: ".5rem" }}><div style={{ fontSize: 13, fontWeight: 700 }}>{TYPE_ICON[tb.type]} {tb.name}</div><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#1a8c3e", display: "inline-block" }} /></div>
                    {b.prepaid ? (() => {
                      const remainMs = (b.startTime + b.durationMin * 60000) - Date.now();
                      const over = remainMs <= 0;
                      // تحذير قبل انتهاء الوقت فعلياً — آخر 5 دقائق تتحوّل كهرمانية
                      // بدل الانتقال المفاجئ من أخضر إلى أحمر بلا أي إنذار مسبق
                      const warning = !over && remainMs <= WARNING_MS;
                      const rm = Math.abs(remainMs);
                      const mm = Math.floor(rm / 60000), ss = Math.floor((rm % 60000) / 1000);
                      const clockColor = over ? "#e34948" : warning ? "#8a6a20" : C.grn2;
                      const labelColor = over ? "#e34948" : warning ? "#8a6a20" : "#1a8c3e";
                      const labelText = over ? "⏰ انتهى الوقت!" : warning ? "⚠ اقترب انتهاء الوقت" : "متبقٍ من الحجز";
                      return (
                        <>
                          <div style={{ fontSize: 21, fontWeight: 700, color: clockColor, fontFamily: "monospace", letterSpacing: 1, margin: ".4rem 0" }}>{over ? "-" : ""}{String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}</div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: labelColor }}>{labelText}</div>
                        </>
                      );
                    })() : (
                      <>
                        <div style={{ fontSize: 21, fontWeight: 700, color: C.grn2, fontFamily: "monospace", letterSpacing: 1, margin: ".4rem 0" }}>{elapsed(b.startTime)}</div>
                        <div style={{ fontSize: 10, color: C.mt }}>وقت مفتوح · {b.rate} {cur}/س</div>
                      </>
                    )}
                    <div style={{ fontSize: 11.5, color: C.k2, marginTop: 4, marginBottom: 2 }}>👤 {b.customer}</div>
                    {b.prepaid && <div style={{ fontSize: 10, color: "#1a8c3e", fontWeight: 600 }}>✓ مدفوع مقدماً {fmt(b.prepaidAmount)} {cur} ({b.pay})</div>}
                    <button onClick={() => stop(id)} style={{ width: "100%", marginTop: ".6rem", padding: ".4rem", borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: "pointer", border: "none", background: "#e34948", color: "#fff", fontFamily: "inherit" }}>{b.prepaid ? "■ إنهاء الحجز" : "■ إنهاء وإصدار فاتورة"}</button>
                    {!b.prepaid && <button onClick={() => cancelActive(id)} style={{ width: "100%", marginTop: 4, padding: ".3rem", borderRadius: 7, fontSize: 10, fontWeight: 600, cursor: "pointer", border: `1px solid ${C.bc}`, background: "none", color: C.mt, fontFamily: "inherit" }}>✕ إلغاء دون فاتورة</button>}
                  </div>
                );
              }
              const upcoming = nextReservationToday(tb.id, reservations);
              return (
                <div key={tb.id} style={{ borderRadius: 13, padding: ".9rem", border: `1px solid ${upcoming ? C.gold + "88" : C.bc}`, background: C.crm }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: ".5rem" }}>{TYPE_ICON[tb.type]} {tb.name}</div>
                  <div style={{ fontSize: 26, color: C.mt, textAlign: "center", marginBottom: 2 }}>○</div>
                  <div style={{ textAlign: "center", fontSize: 10.5, color: C.mt, marginBottom: 8 }}>متاحة · {tb.rate} {cur}/س</div>
                  {upcoming && <div style={{ textAlign: "center", fontSize: 10, color: C.gdd, fontWeight: 700, background: C.gold + "18", borderRadius: 6, padding: "2px 4px", marginBottom: 6 }}>📅 محجوزة {new Date(upcoming.startAt).toLocaleTimeString("ar-LY", { hour: "2-digit", minute: "2-digit" })} — {upcoming.customerName}</div>}
                  <button onClick={() => { setType(tb.type); setTableId(tb.id); resetBookingModal(); setModal(true); }} style={{ width: "100%", padding: ".45rem", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "none", background: C.grl, color: "#fff", fontFamily: "inherit" }}>▶ حجز</button>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* الجدول الزمني لليوم — حجوزات مسبقة لم تبدأ بعد، مرتَّبة زمنياً لكل طاولة.
          كانت الشاشة تعرض إشغالاً حيّاً فقط بلا أي طريقة لتسجيل «الطاولة 3 محجوزة الساعة 8» مسبقاً */}
      {todayReservations.length > 0 && (
        <Card style={{ marginTop: 11 }}>
          <CardHead title="📅 الجدول الزمني لليوم" sub={`${todayReservations.length} حجز مسبق لم يبدأ بعد`} />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {todayReservations.map(res => {
              const overdue = isOverdue(res);
              const timeStr = new Date(res.startAt).toLocaleTimeString("ar-LY", { hour: "2-digit", minute: "2-digit" });
              return (
                <div key={res.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, background: overdue ? C.redbg : C.crm, border: `1px solid ${overdue ? "rgba(192,57,43,.35)" : C.bc}`, borderRadius: 10, padding: ".6rem .85rem" }}>
                  <div style={{ fontSize: 12.5 }}>
                    <b>{timeStr}</b> — {TYPE_ICON[res.type]} {res.tableName} · 👤 {res.customerName} · {fmt(res.price)} {cur} ({res.pay})
                    {overdue && <span style={{ color: C.red, fontWeight: 700, marginRight: 6 }}>⏰ متأخر عن الموعد</span>}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <Btn sm gold onClick={() => checkInReservation(res)}>▶ تسجيل الوصول</Btn>
                    {overdue
                      ? <Btn sm danger onClick={() => noShowReservation(res)}>عدم حضور</Btn>
                      : <Btn sm onClick={() => cancelReservation(res)}>✕ إلغاء</Btn>}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Card style={{ marginTop: 11 }}>
        <CardHead title="سجل الحجوزات المكتملة" sub={`${fmt(cbShown.length)} من ${fmt(completedBookings.length)} إجمالاً`} right={
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <Sel value="" onChange={e => e.target.value && cbApplyQuickRange(e.target.value)} style={{ width: 120 }}>
              <option value="">— نطاق سريع —</option>
              {QUICK_RANGES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </Sel>
            <Inp type="date" value={cbFrom} onChange={e => setCbFrom(e.target.value)} aria-label="من تاريخ" style={{ width: 135 }} />
            <Inp type="date" value={cbTo} onChange={e => setCbTo(e.target.value)} aria-label="إلى تاريخ" style={{ width: 135 }} />
            <Btn sm onClick={() => downloadCsv(cbExportSheet(), `الحجوزات-${cbFrom}-${cbTo}`)}>⬇ CSV</Btn>
            <Btn sm onClick={() => downloadExcel(cbExportSheet(), `الحجوزات-${cbFrom}-${cbTo}`)}>📊 Excel</Btn>
          </div>
        } />
        {cbShown.length === 0 ? <div style={{ color: C.mt, fontSize: 12, padding: "1rem 0", textAlign: "center" }}>لا توجد حجوزات مكتملة ضمن هذا النطاق</div> :
          <Table cols={[{ h: "النشاط", w: "20%" }, { h: "الزبون", w: "16%" }, { h: "المدة", w: "12%" }, { h: "السعر/ساعة", w: "12%" }, { h: "الإجمالي", w: "12%" }, { h: "الفاتورة", w: "14%" }, { h: "التاريخ", w: "14%" }]}
            rows={cbShown.slice(0, 100).map(b => [`${TYPE_ICON[b.type]} ${TYPE_NAME[b.type]} — ${b.tableName}`, b.customer, b.dur, b.rate + " " + cur, fmt(Math.round(b.total * 10) / 10) + " " + cur, <Badge tone="b">#{b.inv}</Badge>, b.date ? arDate(b.date) : "—"])} />}
        {cbShown.length > 100 && <div style={{ fontSize: 11, color: C.mt, textAlign: "center", marginTop: 8 }}>يعرض أحدث 100 من {fmt(cbShown.length)} — ضيّق النطاق الزمني أو صدِّر الكل</div>}
      </Card>

      {cancellations.length > 0 && (
        <Card style={{ marginTop: 11 }}>
          <CardHead title="✕ سجل الإلغاءات وعدم الحضور" sub={`${cancellations.length} حالة مسجَّلة`} />
          <Table cols={[{ h: "التاريخ", w: "14%" }, { h: "الزبون", w: "20%" }, { h: "النوع", w: "18%" }, { h: "السبب", w: "20%" }, { h: "ملاحظة", w: "18%" }, { h: "بواسطة", w: "10%" }]}
            rows={cancellations.slice(0, 10).map(c => [arDate(c.date), c.customer, `${TYPE_ICON[c.resType] || ""} ${TYPE_NAME[c.resType] || c.resType}`, <Badge tone={c.reason === "عدم حضور" ? "a" : "r"}>{c.reason}</Badge>, c.note || "—", c.by])} />
        </Card>
      )}

      {/* نافذة تسجيل إلغاء / عدم حضور */}
      {cancelModal && (
        <Modal title="تسجيل إلغاء / عدم حضور" onClose={() => setCancelModal(false)} width={440}>
          <Field label="اسم الزبون"><Inp value={cancelForm.customer} onChange={e => setCancelForm({ ...cancelForm, customer: e.target.value })} placeholder="اسم من كان محجوزاً" /></Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="النوع"><Sel value={cancelForm.resType} onChange={e => setCancelForm({ ...cancelForm, resType: e.target.value })}>{Object.entries(TYPE_NAME).map(([k, l]) => <option key={k} value={k}>{TYPE_ICON[k]} {l}</option>)}</Sel></Field>
            <Field label="التاريخ"><Inp type="date" value={cancelForm.date} onChange={e => setCancelForm({ ...cancelForm, date: e.target.value })} /></Field>
          </div>
          <Field label="السبب"><Sel value={cancelForm.reason} onChange={e => setCancelForm({ ...cancelForm, reason: e.target.value })}>{CANCEL_REASONS.map(r => <option key={r}>{r}</option>)}</Sel></Field>
          <Field label="ملاحظة (اختياري)"><Inp value={cancelForm.note} onChange={e => setCancelForm({ ...cancelForm, note: e.target.value })} placeholder="أي تفاصيل إضافية" /></Field>
          <div style={{ fontSize: 11, color: C.mt, margin: "4px 0 12px", lineHeight: 1.7 }}>يُستخدم هذا لتسجيل حجوزات هاتفية أو شفهية لم تُنفَّذ — يساعد على متابعة معدل الإلغاء وعدم الحضور بمرور الوقت.</div>
          <div style={{ display: "flex", gap: 8 }}><Btn gold onClick={saveCancelLog} style={{ flex: 1, justifyContent: "center" }}>✓ تسجيل</Btn><Btn onClick={() => setCancelModal(false)}>إلغاء</Btn></div>
        </Modal>
      )}

      {/* NEW BOOKING MODAL */}
      {modal && (
        <Modal title="حجز جديد" onClose={() => setModal(false)}>
          <Field label="نوع النشاط" full>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
              {["billiard", "tennis", "football"].map(t => {
                const count = tablesByType(t).length;
                return (
                  <div key={t} onClick={() => { setType(t); const first = tablesByType(t)[0]; setTableId(first?.id || null); }} style={{ border: `1px solid ${type === t ? C.gold : C.bc}`, borderRadius: 10, padding: ".6rem", textAlign: "center", cursor: "pointer", background: type === t ? "rgba(201,168,76,.12)" : C.crm, opacity: count ? 1 : .5 }}>
                    <div style={{ fontSize: 22, marginBottom: 4 }}>{TYPE_ICON[t]}</div><div style={{ fontSize: 11.5, fontWeight: 600 }}>{TYPE_NAME[t]}</div><div style={{ fontSize: 10, color: C.mt, marginTop: 2 }}>{count} طاولة</div>
                  </div>
                );
              })}
            </div>
          </Field>
          <Field label="اختر الطاولة / الملعب" full>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 7 }}>
              {tablesByType(type).map(tb => {
                const isBusy = busy(tb.id);
                return <div key={tb.id} onClick={() => !isBusy && setTableId(tb.id)} style={{ border: `1px solid ${tableId === tb.id ? C.gold : C.bc}`, borderRadius: 9, padding: ".5rem", textAlign: "center", fontSize: 11.5, fontWeight: 600, cursor: isBusy ? "not-allowed" : "pointer", background: isBusy ? C.redbg : tableId === tb.id ? "rgba(201,168,76,.15)" : C.crm, color: isBusy ? "#922" : C.k2, opacity: isBusy ? .7 : 1 }}>{TYPE_ICON[type]}<br />{tb.name}<br /><span style={{ fontSize: 9, color: C.mt }}>{tb.rate} {cur}/س</span>{isBusy && <><br /><span style={{ fontSize: 9 }}>مشغولة</span></>}</div>;
              })}
              {tablesByType(type).length === 0 && <div style={{ gridColumn: "1/-1", textAlign: "center", color: C.mt, fontSize: 12, padding: ".5rem" }}>لا توجد طاولات لهذا النوع.</div>}
            </div>
          </Field>
          <Field label="متى؟" full>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8 }}>
              <div onClick={() => setBookMode("now")} style={{ border: `1px solid ${bookMode === "now" ? C.gold : C.bc}`, borderRadius: 9, padding: ".5rem", textAlign: "center", cursor: "pointer", fontSize: 12.5, fontWeight: bookMode === "now" ? 700 : 500, background: bookMode === "now" ? "rgba(201,168,76,.12)" : C.crm }}>▶ الآن</div>
              <div onClick={() => setBookMode("later")} style={{ border: `1px solid ${bookMode === "later" ? C.gold : C.bc}`, borderRadius: 9, padding: ".5rem", textAlign: "center", cursor: "pointer", fontSize: 12.5, fontWeight: bookMode === "later" ? 700 : 500, background: bookMode === "later" ? "rgba(201,168,76,.12)" : C.crm }}>📅 حجز لاحقاً</div>
            </div>
          </Field>

          <Field label="زبون مسجَّل (اختياري)">
            <Sel value={bkCustomerId || ""} onChange={e => e.target.value ? pickBkCustomer(e.target.value) : setBkCustomerId(null)}>
              <option value="">— زبون جديد / بلا ربط —</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name} — {c.phone}</option>)}
            </Sel>
          </Field>
          <Field label="اسم الزبون"><Inp value={customer} onChange={e => { setCustomer(e.target.value); setBkCustomerId(null); }} placeholder="محمد علي" /></Field>

          {bookMode === "later" && (
            <Field label="تاريخ ووقت الحجز" full>
              <Inp type="datetime-local" value={resStartAt} min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)} onChange={e => setResStartAt(e.target.value)} />
            </Field>
          )}

          <Field label="مدة الحجز" full>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 7 }}>
              {DUR_OPTS.filter(o => bookMode === "now" || o.v !== "open").map(o => {
                const price = priceForDuration(rateOf(tableId), o.v);
                return (
                  <div key={o.v} onClick={() => setDuration(o.v)} style={{ border: `1.5px solid ${duration === o.v ? C.gold : C.bc}`, borderRadius: 10, padding: ".55rem .7rem", cursor: "pointer", background: duration === o.v ? C.gold + "14" : C.crm, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div><div style={{ fontSize: 12.5, fontWeight: 700 }}>{o.l}</div><div style={{ fontSize: 9.5, color: C.mt }}>{o.s}</div></div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: o.v === "open" ? C.mt : C.grn2 }}>{o.v === "open" ? "حسب الوقت" : fmt(price) + " " + cur}</div>
                  </div>
                );
              })}
            </div>
            {bookMode === "later" && <div style={{ fontSize: 10.5, color: C.mt, marginTop: 4 }}>الحجز المسبق يتطلب مدة محددة (لا وقت مفتوح) حتى يمكن فحص تعارضه مع حجوزات أخرى.</div>}
          </Field>

          {(duration !== "open" || bookMode === "later") && (
            <Field label="طريقة الدفع" full>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>
                {["كاش", "بطاقة", "تحويل", "آجل"].map(m => (
                  <div key={m} onClick={() => (m !== "آجل" || bkCustomerId) && setBkPay(m)} title={m === "آجل" && !bkCustomerId ? "اختر زبوناً مسجَّلاً أولاً" : undefined} style={{ border: `1px solid ${bkPay === m ? C.gold : C.bc}`, borderRadius: 8, padding: ".45rem", textAlign: "center", cursor: m === "آجل" && !bkCustomerId ? "not-allowed" : "pointer", fontSize: 12, fontWeight: bkPay === m ? 700 : 500, background: bkPay === m ? C.gold + "14" : C.crm, color: bkPay === m ? C.grn2 : C.k2, opacity: m === "آجل" && !bkCustomerId ? .45 : 1 }}>{m}</div>
                ))}
              </div>
            </Field>
          )}

          <div style={{ background: "rgba(26,140,62,.07)", border: "0.5px solid rgba(26,140,62,.22)", borderRadius: 9, padding: ".65rem .85rem", margin: ".6rem 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: C.mt, fontWeight: 600 }}>{duration === "open" ? "السعر بالساعة" : "الإجمالي المستحق"}</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: C.grn2 }}>{duration === "open" ? fmt(rateOf(tableId)) : fmt(priceForDuration(rateOf(tableId), duration))} {cur}</span>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <Btn gold style={{ flex: 1, justifyContent: "center" }} onClick={() => {
              if (bookMode === "later") { createReservation(); return; }
              const tbl = tables.find(t => t.id === tableId);
              if (!tbl) { showToast("اختر طاولة"); return; }
              if (busy(tableId)) { showToast("الطاولة مشغولة"); return; }
              if (bkPay === "آجل" && !bkCustomerId) { showToast("البيع الآجل يتطلب اختيار زبون مسجَّل"); return; }
              start(tbl, customer, duration, bkPay, bkCustomerId);
              setModal(false); resetBookingModal();
            }}>{bookMode === "later" ? "📅 تأكيد الحجز المسبق" : duration === "open" ? "▶ بدء الحجز المفتوح" : "✓ تأكيد الحجز والدفع"}</Btn>
            <Btn onClick={() => { setModal(false); resetBookingModal(); }}>إلغاء</Btn>
          </div>
        </Modal>
      )}

      {/* MANAGE TABLES MODAL */}
      {manageModal && (
        <Modal title="إدارة الطاولات والملاعب" onClose={() => setManageModal(false)} width={600}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: C.mt }}>أضف، عدّل، احذف، وغيّر أسعار الطاولات لكل نشاط.</div>
            <Btn gold sm onClick={() => setEditTable({ id: null, type: "billiard", name: "", rate: "" })}>+ طاولة جديدة</Btn>
          </div>
          {["billiard", "tennis", "football"].map(t => {
            const list = tablesByType(t);
            return (
              <div key={t} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.gdd, marginBottom: 6 }}>{TYPE_ICON[t]} {TYPE_NAME[t]} ({list.length})</div>
                {list.length === 0 && <div style={{ fontSize: 11.5, color: C.mt, padding: ".3rem 0" }}>لا توجد طاولات.</div>}
                {list.map(tb => (
                  <div key={tb.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: C.crm, borderRadius: 8, padding: ".5rem .75rem", marginBottom: 5 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 16 }}>{TYPE_ICON[t]}</span>
                      <div><div style={{ fontSize: 12.5, fontWeight: 600 }}>{tb.name}</div><div style={{ fontSize: 10.5, color: C.mt }}>{tb.rate} {cur} / ساعة{busy(tb.id) && " · مشغولة الآن"}</div></div>
                    </div>
                    <div style={{ display: "flex", gap: 5 }}>
                      <Btn sm onClick={() => setEditTable({ ...tb, rate: String(tb.rate) })}>تعديل</Btn>
                      <Btn sm danger onClick={() => deleteTable(tb.id)}>حذف</Btn>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </Modal>
      )}

      {/* ADD / EDIT TABLE MODAL */}
      {editTable && (
        <Modal title={editTable.id ? "تعديل طاولة" : "إضافة طاولة جديدة"} onClose={() => setEditTable(null)} width={420}>
          <Field label="نوع النشاط">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
              {["billiard", "tennis", "football"].map(t => (
                <div key={t} onClick={() => setEditTable(e => ({ ...e, type: t, rate: e.rate || String(TYPE_DEFAULT_RATE[t]) }))} style={{ border: `1px solid ${editTable.type === t ? C.gold : C.bc}`, borderRadius: 8, padding: ".5rem", textAlign: "center", cursor: "pointer", background: editTable.type === t ? "rgba(201,168,76,.12)" : C.crm }}>
                  <div style={{ fontSize: 18 }}>{TYPE_ICON[t]}</div><div style={{ fontSize: 10.5, fontWeight: 600 }}>{TYPE_NAME[t]}</div>
                </div>
              ))}
            </div>
          </Field>
          <Field label="اسم الطاولة / الملعب"><Inp value={editTable.name} onChange={e => setEditTable(x => ({ ...x, name: e.target.value }))} placeholder="طاولة 4" /></Field>
          <Field label={`السعر بالساعة (${cur})`}><Inp type="number" value={editTable.rate} onChange={e => setEditTable(x => ({ ...x, rate: e.target.value }))} placeholder={String(TYPE_DEFAULT_RATE[editTable.type])} /></Field>
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}><Btn gold onClick={() => saveTable(editTable)} style={{ flex: 1, justifyContent: "center" }}>✓ حفظ</Btn><Btn onClick={() => setEditTable(null)}>إلغاء</Btn></div>
        </Modal>
      )}
    </>
  );
}
