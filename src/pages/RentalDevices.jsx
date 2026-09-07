import { useState, useEffect } from "react";
import { C, fmt } from "../constants/theme.js";
import { PageTop, Btn, KCard, Card, CardHead, Table, Badge, Modal, Field, Inp } from "../components/ui.jsx";
import { todayISO, toWa } from "../utils/format.js";

/* ============================ RENTAL DEVICES (تأجير الأجهزة الإلكترونية) ============================ */
export default function RentalDevices({ ctx }) {
  const { rentalDevices, setRentalDevices, rentals, setRentals, setInvoices, user, showToast, confirm, settings } = ctx;
  const cur = settings?.currency || "د.ل";
  const [, force] = useState(0);
  useEffect(() => { const t = setInterval(() => force(x => x + 1), 30000); return () => clearInterval(t); }, []); // تحديث العدّادات كل 30ث

  const [devModal, setDevModal] = useState(false);
  const [devForm, setDevForm] = useState({ name: "", buyPrice: "", dailyRate: "" });
  const [rentModal, setRentModal] = useState(null); // device being rented
  const nowIso = () => { const d = new Date(); d.setSeconds(0, 0); return d.toISOString().slice(0, 16); };
  const [rentForm, setRentForm] = useState({ customer: "", phone: "", days: 1, startAt: nowIso(), pay: "كاش" });

  const addDevice = () => {
    if (!devForm.name.trim()) { showToast("أدخل اسم الجهاز"); return; }
    if (!devForm.dailyRate) { showToast("أدخل سعر الإيجار اليومي"); return; }
    setRentalDevices(ds => [...ds, { id: "RD-" + Date.now(), name: devForm.name.trim(), buyPrice: parseFloat(devForm.buyPrice) || 0, dailyRate: parseFloat(devForm.dailyRate) || 0, status: "available", addedAt: todayISO() }]);
    showToast("تمت إضافة الجهاز");
    setDevModal(false); setDevForm({ name: "", buyPrice: "", dailyRate: "" });
  };

  const activeRentalOf = (deviceId) => rentals.find(r => r.deviceId === deviceId && r.status !== "مُرجَع");

  const openRent = (device) => { setRentForm({ customer: "", phone: "", days: 1, startAt: nowIso(), pay: "كاش" }); setRentModal(device); };

  const confirmRent = () => {
    if (!rentForm.customer.trim()) { showToast("أدخل اسم الزبون"); return; }
    const wa = toWa(rentForm.phone);
    if (!wa || wa.length < 10) { showToast("رقم واتساب الزبون إلزامي وبصيغة صحيحة"); return; }
    const days = Math.max(1, parseInt(rentForm.days) || 1);
    const device = rentModal;
    const startAt = new Date(rentForm.startAt);
    const endAt = new Date(startAt.getTime() + days * 86400000);
    const total = Math.round(device.dailyRate * days * 100) / 100;
    const rid = "RT-" + Date.now();

    setRentals(rs => [{
      id: rid, deviceId: device.id, deviceName: device.name, customer: rentForm.customer.trim(), phone: rentForm.phone, wa, days,
      startAt: startAt.toISOString(), endAt: endAt.toISOString(), dailyRate: device.dailyRate, total, status: "نشط",
      returnedAt: null, alertSent: false, by: user?.name || "—",
    }, ...rs]);
    setRentalDevices(ds => ds.map(d => d.id === device.id ? { ...d, status: "rented" } : d));

    // إنشاء فاتورة (بلا تكلفة بضاعة — التأجير ليس استهلاكاً للمخزون)
    const invNum = "INV-RT-" + ctx.nextCounter("rtInvoice");
    setInvoices(iv => [{ id: invNum, customer: rentForm.customer.trim(), date: todayISO(), source: "تأجير", details: `تأجير ${device.name} — ${days} يوم`, items: [{ cat: "__rental", name: `تأجير ${device.name}`, qty: 1, lineTotal: total }], pay: rentForm.pay, discount: "—", total, cost: 0, status: "مدفوعة", by: user?.name || "—", time: new Date().toTimeString().slice(0, 5) }, ...iv]);

    showToast(`تم تأجير ${device.name} لـ${rentForm.customer.trim()} — ${fmt(total)} ${cur}`);
    setRentModal(null);
  };

  const returnDevice = async (rental) => {
    if (!(await confirm(`تأكيد استرجاع «${rental.deviceName}» من ${rental.customer}؟`))) return;
    setRentals(rs => rs.map(r => r.id === rental.id ? { ...r, status: "مُرجَع", returnedAt: new Date().toISOString() } : r));
    setRentalDevices(ds => ds.map(d => d.id === rental.deviceId ? { ...d, status: "available" } : d));
    showToast(`تم استرجاع ${rental.deviceName}`);
  };

  const sendEndReminder = (rental) => {
    const endTime = new Date(rental.endAt).toLocaleString("ar-LY", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });
    const msg = [
      `🌴 *${settings?.clubName || "نادي النخيل"}* — تذكير بموعد إرجاع الجهاز`,
      `عزيزنا ${rental.customer}،`,
      "",
      `نود تذكيركم بأن مدة تأجير جهاز *${rental.deviceName}* تنتهي في ${endTime}.`,
      "نرجو التكرم بإرجاع الجهاز في الموعد المحدد. شكراً لتعاملكم معنا 🌴",
    ].join("\n");
    window.open(`https://wa.me/${rental.wa}?text=${encodeURIComponent(msg)}`, "_blank");
    setRentals(rs => rs.map(r => r.id === rental.id ? { ...r, alertSent: true } : r));
    showToast(`تم فتح واتساب لتذكير ${rental.customer}`);
  };

  const now = Date.now();
  const msLeft = (r) => new Date(r.endAt).getTime() - now;
  const fmtCountdown = (ms) => {
    const over = ms < 0; const abs = Math.abs(ms);
    const h = Math.floor(abs / 3600000), m = Math.floor((abs % 3600000) / 60000);
    return (over ? "-" : "") + h + "س " + m + "د";
  };

  const activeRentals = rentals.filter(r => r.status !== "مُرجَع").sort((a, b) => new Date(a.endAt) - new Date(b.endAt));
  const endingSoon = activeRentals.filter(r => msLeft(r) <= 3600000); // خلال ساعة أو متأخر
  const availableCount = rentalDevices.filter(d => d.status === "available").length;
  const rentedCount = rentalDevices.filter(d => d.status === "rented").length;
  const totalRevenue = rentals.reduce((s, r) => s + r.total, 0);

  return (
    <>
      <PageTop title="🔌 تأجير الأجهزة الإلكترونية" action={<Btn gold onClick={() => { setDevForm({ name: "", buyPrice: "", dailyRate: "" }); setDevModal(true); }}>+ إضافة جهاز</Btn>} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 11, marginBottom: "1.1rem" }}>
        <KCard label="إجمالي الأجهزة" value={rentalDevices.length} sub="جهاز" bar={C.gold} />
        <KCard label="متاحة الآن" value={availableCount} sub="جاهزة للتأجير" bar="#1a8c3e" />
        <KCard label="مؤجَّرة حالياً" value={rentedCount} sub="جهاز" bar="#2a78d6" />
        <KCard label="إجمالي إيراد التأجير" value={fmt(totalRevenue)} sub={cur} bar={C.purp} />
      </div>

      {endingSoon.length > 0 && (
        <Card style={{ marginBottom: "1.1rem", background: "linear-gradient(135deg,#fdeaea,#fff)", border: "1px solid rgba(192,57,43,.3)" }}>
          <CardHead title="⏰ أجهزة تنتهي مدتها قريباً أو متأخرة" sub="أرسل تذكيراً للزبون عبر واتساب قبل انتهاء الموعد" />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {endingSoon.map(r => {
              const ms = msLeft(r); const over = ms < 0;
              return (
                <div key={r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, background: "#fff", borderRadius: 9, padding: ".6rem .85rem" }}>
                  <div style={{ fontSize: 12.5 }}>
                    <b>{r.deviceName}</b> — {r.customer} <span style={{ color: over ? C.red : "#8a6a20", fontWeight: 700, marginRight: 6 }}>{over ? `متأخر ${fmtCountdown(ms)}` : `متبقٍ ${fmtCountdown(ms)}`}</span>
                  </div>
                  <Btn sm gold onClick={() => sendEndReminder(r)}>📱 {r.alertSent ? "إعادة إرسال التذكير" : "إرسال تذكير واتساب"}</Btn>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Card style={{ marginBottom: "1.1rem" }}>
        <CardHead title="الأجهزة" sub={`${rentalDevices.length} جهاز`} />
        {rentalDevices.length === 0 ? (
          <div style={{ textAlign: "center", color: C.mt, padding: "1.5rem" }}>لا أجهزة بعد — أضف أول جهاز للتأجير.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 11 }}>
            {rentalDevices.map(d => {
              const active = activeRentalOf(d.id);
              return (
                <div key={d.id} className="nk-card-hover" style={{ border: `1px solid ${active ? "rgba(42,120,214,.35)" : C.bc}`, borderRadius: 12, padding: ".85rem", background: active ? "#f0f6fd" : C.crm }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700 }}>🔌 {d.name}</div>
                    <Badge tone={active ? "b" : "g"}>{active ? "مؤجَّر" : "متاح"}</Badge>
                  </div>
                  <div style={{ fontSize: 11, color: C.mt, marginBottom: 8 }}>سعر الشراء {fmt(d.buyPrice)} {cur} · إيجار {fmt(d.dailyRate)} {cur}/يوم</div>
                  {active ? (
                    <>
                      <div style={{ fontSize: 12, color: C.k2, marginBottom: 2 }}>👤 {active.customer}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: msLeft(active) < 0 ? C.red : msLeft(active) <= 3600000 ? "#8a6a20" : "#2a78d6", marginBottom: 8 }}>
                        {msLeft(active) < 0 ? "⏰ متأخر " : "⏳ متبقٍ "}{fmtCountdown(msLeft(active))}
                      </div>
                      <Btn sm onClick={() => returnDevice(active)} style={{ width: "100%", justifyContent: "center" }}>↩ استرجاع الجهاز</Btn>
                    </>
                  ) : (
                    <Btn sm gold onClick={() => openRent(d)} style={{ width: "100%", justifyContent: "center" }}>🏷 تأجير الآن</Btn>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card>
        <CardHead title="سجل عمليات التأجير" sub={`${rentals.length} عملية`} />
        {rentals.length === 0 ? <div style={{ textAlign: "center", color: C.mt, padding: "1.5rem" }}>لا عمليات تأجير بعد.</div> : (
          <Table cols={[{ h: "الجهاز", w: "16%" }, { h: "الزبون", w: "16%" }, { h: "الأيام", w: "8%" }, { h: "الاستلام", w: "15%" }, { h: "الانتهاء", w: "15%" }, { h: "الإجمالي", w: "12%" }, { h: "الحالة", w: "10%" }, { h: "", w: "8%" }]}
            rows={rentals.slice(0, 100).map(r => [
              r.deviceName, r.customer, r.days,
              new Date(r.startAt).toLocaleString("ar-LY", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }),
              new Date(r.endAt).toLocaleString("ar-LY", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }),
              fmt(r.total) + " " + cur,
              <Badge tone={r.status === "مُرجَع" ? "g" : msLeft(r) < 0 ? "r" : "b"}>{r.status === "مُرجَع" ? "مُرجَع" : msLeft(r) < 0 ? "متأخر" : "نشط"}</Badge>,
              r.status !== "مُرجَع" ? <Btn sm onClick={() => returnDevice(r)}>إرجاع</Btn> : "—",
            ])} />
        )}
      </Card>

      {/* نافذة إضافة جهاز */}
      {devModal && (
        <Modal title="إضافة جهاز جديد للتأجير" onClose={() => setDevModal(false)} width={440}>
          <Field label="اسم الجهاز *"><Inp value={devForm.name} onChange={e => setDevForm({ ...devForm, name: e.target.value })} placeholder="مثال: جهاز بروجكتور، PS5 محمول..." /></Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label={"سعر الشراء (" + cur + ")"}><Inp type="number" value={devForm.buyPrice} onChange={e => setDevForm({ ...devForm, buyPrice: e.target.value })} placeholder="0" /></Field>
            <Field label={"سعر الإيجار اليومي (" + cur + ") *"}><Inp type="number" value={devForm.dailyRate} onChange={e => setDevForm({ ...devForm, dailyRate: e.target.value })} placeholder="0" /></Field>
          </div>
          <div style={{ display: "flex", gap: 8 }}><Btn gold onClick={addDevice} style={{ flex: 1, justifyContent: "center" }}>✓ إضافة</Btn><Btn onClick={() => setDevModal(false)}>إلغاء</Btn></div>
        </Modal>
      )}

      {/* نافذة تأجير جهاز */}
      {rentModal && (
        <Modal title={`تأجير — ${rentModal.name}`} onClose={() => setRentModal(null)} width={460}>
          <Field label="اسم الزبون *"><Inp value={rentForm.customer} onChange={e => setRentForm({ ...rentForm, customer: e.target.value })} placeholder="الاسم الكامل" /></Field>
          <Field label="رقم واتساب الزبون * (إلزامي)"><Inp value={rentForm.phone} onChange={e => setRentForm({ ...rentForm, phone: e.target.value })} placeholder="0913-000-000" /></Field>
          {rentForm.phone && <div style={{ fontSize: 11, color: C.mt, marginTop: -6, marginBottom: 10 }}>سيُحفظ كـ: {toWa(rentForm.phone) || "—"} — سيُستخدم لإرسال تذكير قبل انتهاء المدة</div>}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="المدة (أيام)"><Inp type="number" min="1" value={rentForm.days} onChange={e => setRentForm({ ...rentForm, days: e.target.value })} /></Field>
            <Field label="تاريخ ووقت الاستلام"><Inp type="datetime-local" value={rentForm.startAt} onChange={e => setRentForm({ ...rentForm, startAt: e.target.value })} /></Field>
          </div>
          <Field label="طريقة الدفع">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
              {["كاش", "بطاقة", "تحويل"].map(m => (
                <div key={m} onClick={() => setRentForm({ ...rentForm, pay: m })} style={{ border: `1px solid ${rentForm.pay === m ? C.gold : C.bc}`, borderRadius: 8, padding: ".4rem", textAlign: "center", cursor: "pointer", fontSize: 12, fontWeight: rentForm.pay === m ? 700 : 500, background: rentForm.pay === m ? C.gold + "14" : C.crm }}>{m}</div>
              ))}
            </div>
          </Field>
          <div style={{ background: "rgba(26,140,62,.07)", border: "0.5px solid rgba(26,140,62,.2)", borderRadius: 9, padding: ".6rem .85rem", margin: ".6rem 0 1rem", display: "flex", justifyContent: "space-between", fontSize: 13 }}>
            <span style={{ color: C.mt, fontWeight: 600 }}>الإجمالي المستحق</span>
            <span style={{ fontWeight: 800, color: C.grn2 }}>{fmt(Math.round(rentModal.dailyRate * (Math.max(1, parseInt(rentForm.days) || 1)) * 100) / 100)} {cur}</span>
          </div>
          <div style={{ fontSize: 10.5, color: C.mt, marginBottom: 10, lineHeight: 1.7 }}>💡 سيصلك تنبيه في جرس الإشعارات قبل ساعة من انتهاء المدة لتذكير الزبون — يبقى إرسال رسالة التذكير الفعلية بضغطة زر (لأن النظام يعمل من المتصفح ولا يرسل رسائل تلقائياً في الخلفية).</div>
          <div style={{ display: "flex", gap: 8 }}><Btn gold onClick={confirmRent} style={{ flex: 1, justifyContent: "center" }}>✓ تأكيد التأجير والدفع</Btn><Btn onClick={() => setRentModal(null)}>إلغاء</Btn></div>
        </Modal>
      )}
    </>
  );
}
