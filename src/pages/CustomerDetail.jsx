import { useState } from "react";
import { C, fmt } from "../constants/theme.js";
import { Modal, Field, Inp, Btn, Badge, Table } from "../components/ui.jsx";
import { openPdfDoc } from "../components/pdfHook.js";
import { todayISO, arDate } from "../utils/format.js";

/* ---- Customer detail: statement, receipt, WhatsApp reports ---- */
export default function CustomerDetail({ ctx, customer, onClose }) {
  const { invoices, setInvoices, setCustomers, showToast, settings } = ctx;
  const cur = settings?.currency || "د.ل";
  const [payModal, setPayModal] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payVia, setPayVia] = useState("كاش");
  const c = customer;
  // مطابقة بالمعرّف للفواتير الحديثة، وبالاسم للفواتير القديمة التي أُنشئت قبل ربطها بمعرّف الزبون
  const custInvoices = invoices.filter(iv => iv.customerId != null ? iv.customerId === c.id : iv.customer === c.name);
  const deferredInvoices = custInvoices.filter(iv => iv.pay === "آجل" && iv.status === "معلقة");

  /* receive a payment -> issue receipt, reduce debt, settle oldest deferred invoices */
  const receivePayment = () => {
    const amt = parseFloat(payAmount) || 0;
    if (amt <= 0) { showToast("أدخل مبلغاً صحيحاً"); return; }
    if (amt > (c.debt || 0)) { showToast("المبلغ أكبر من الرصيد الآجل"); return; }
    // settle oldest deferred invoices up to amount
    let remaining = amt;
    const sorted = [...deferredInvoices].sort((a, b) => a.date.localeCompare(b.date));
    const settledIds = [];
    for (const inv of sorted) {
      if (remaining >= inv.total) { remaining -= inv.total; settledIds.push(inv.id); }
    }
    setInvoices(iv => iv.map(x => settledIds.includes(x.id) ? { ...x, status: "مدفوعة", paidAt: todayISO(), paidVia: payVia } : x));
    setCustomers(cs => cs.map(x => x.id === c.id ? { ...x, debt: Math.max(0, (x.debt || 0) - amt) } : x));
    // سجّل الدفعة في سجل المدفوعات — تدخل الخزينة بيوم الاستلام وطريقته (تشمل الدفعات الجزئية)
    ctx.setPayments(ps => [{ id: "PY-" + Date.now(), date: todayISO(), kind: "قبض", party: c.name, via: payVia, amount: amt, by: ctx.user?.name || "—" }, ...ps]);
    // build receipt
    printReceipt(amt);
    showToast(`تم استلام ${fmt(amt)} ${cur} وإصدار الوصل`);
    setPayModal(false); setPayAmount("");
  };

  const printReceipt = (amt) => {
    const isThermal = settings?.printer === "xprinter";
    const w = window.open("", "_blank", `width=${isThermal ? 340 : 800},height=600`);
    const newDebt = Math.max(0, (c.debt || 0) - amt);
    w.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>وصل استلام</title>
    <style>*{box-sizing:border-box;margin:0;padding:0;font-family:${isThermal ? "monospace" : "'Tajawal',sans-serif"}}
    body{padding:${isThermal ? "10px" : "2cm"};direction:rtl;color:#1a1a18;${isThermal ? "width:80mm;" : ""}}
    .ttl{text-align:center;font-size:${isThermal ? "14px" : "18px"};font-weight:700;color:#1a5c2e}.sub{text-align:center;font-size:10px;color:#7a7870;margin-bottom:8px}
    .box{border:1px dashed #c9a84c;border-radius:8px;padding:${isThermal ? "8px" : "16px"};margin-top:10px}
    .r{display:flex;justify-content:space-between;font-size:${isThermal ? "11px" : "13px"};margin-bottom:6px}
    .big{font-size:${isThermal ? "18px" : "26px"};font-weight:700;color:#1a5c2e;text-align:center;margin:10px 0}
    .ft{text-align:center;font-size:10px;color:#7a7870;margin-top:14px;border-top:1px dashed #ccc;padding-top:8px}</style></head><body>
    <div class="ttl">🌴 ${settings?.clubName || "نادي النخيل"}</div><div class="sub">وصل استلام دفعة</div>
    <div class="box">
      <div class="r"><span>التاريخ:</span><span>${new Date().toLocaleDateString("ar-LY")}</span></div>
      <div class="r"><span>الزبون:</span><span>${c.name}</span></div>
      <div class="r"><span>الهاتف:</span><span>${c.phone}</span></div>
      <div class="big">${fmt(amt)} ${cur}</div>
      <div class="r"><span>الرصيد السابق:</span><span>${fmt(c.debt || 0)} ${cur}</span></div>
      <div class="r"><span>الرصيد المتبقي:</span><span>${fmt(newDebt)} ${cur}</span></div>
    </div>
    <div class="ft">${settings?.invoiceFooter || "شكراً لكم — نادي النخيل"}</div>
    <script>window.onload=function(){window.print();}</script></body></html>`);
    w.document.close();
  };

  /* WhatsApp: send total-balance report */
  const sendBalanceReport = () => {
    // 1) توليد PDF كشف الرصيد
    openPdfDoc(settings, {
      title: "كشف حساب — تقرير الرصيد",
      recipientLabel: "الزبون", recipientName: c.name, recipientPhone: c.phone,
      docNo: "BAL-" + c.id + "-" + Date.now().toString().slice(-4),
      columns: ["البند", "القيمة"],
      rows: [
        ["إجمالي المشتريات", fmt(c.total) + " " + cur],
        ["عدد الفواتير", c.invoices],
        ["الفواتير الآجلة غير المسددة", deferredInvoices.length],
      ],
      totals: [["الرصيد الآجل المستحق", fmt(c.debt || 0) + " " + cur]],
      note: (c.debt || 0) > 0 ? "نرجو التكرم بتسديد المبلغ المستحق في أقرب وقت ممكن. شكراً لتعاملكم معنا." : "لا توجد مستحقات — شكراً لتعاملكم!",
    });
    showToast("فُتح تقرير الرصيد — احفظه كـ PDF ثم شاركه عبر واتساب الزبون");
  };

  /* PDF + WhatsApp: full invoices report */
  const sendInvoicesReport = () => {
    openPdfDoc(settings, {
      title: "تقرير الفواتير الكامل",
      recipientLabel: "الزبون", recipientName: c.name, recipientPhone: c.phone,
      docNo: "INV-R-" + c.id + "-" + Date.now().toString().slice(-4),
      columns: ["#", "رقم الفاتورة", "التاريخ", "التفاصيل", "الدفع", "المبلغ", "الحالة"],
      rows: custInvoices.length
        ? custInvoices.map((iv, i) => [i + 1, "#" + iv.id, arDate(iv.date), iv.details || "—", iv.pay, fmt(iv.total) + " " + cur, iv.status])
        : [["—", "لا توجد فواتير مسجّلة", "", "", "", "", ""]],
      totals: [
        ["إجمالي المشتريات", fmt(c.total) + " " + cur],
        ["الرصيد الآجل المستحق", fmt(c.debt || 0) + " " + cur],
      ],
      note: "هذا التقرير يشمل كامل الفواتير المسجّلة على حسابكم حتى تاريخه.",
    });
    showToast("فُتح تقرير الفواتير — احفظه كـ PDF ثم شاركه عبر واتساب الزبون");
  };

  const PAY_TONE = { "كاش": "g", "بطاقة": "b", "تحويل": "p", "آجل": "a" };
  return (
    <Modal title={`ملف الزبون — ${c.name}`} onClose={onClose} width={620}>
      {/* header stats */}
      <div style={{ display: "grid", gridTemplateColumns: settings?.loyaltyOn ? "repeat(4,1fr)" : "repeat(3,1fr)", gap: 10, marginBottom: 14 }}>
        <div style={{ background: C.crm, borderRadius: 10, padding: ".7rem", textAlign: "center" }}><div style={{ fontSize: 17, fontWeight: 700, color: C.grn2 }}>{fmt(c.total)}</div><div style={{ fontSize: 10, color: C.mt }}>إجمالي المشتريات ({cur})</div></div>
        <div style={{ background: C.crm, borderRadius: 10, padding: ".7rem", textAlign: "center" }}><div style={{ fontSize: 17, fontWeight: 700 }}>{c.invoices}</div><div style={{ fontSize: 10, color: C.mt }}>عدد الفواتير</div></div>
        <div style={{ background: (c.debt || 0) > 0 ? C.redbg : "#e1f4e8", borderRadius: 10, padding: ".7rem", textAlign: "center" }}><div style={{ fontSize: 17, fontWeight: 700, color: (c.debt || 0) > 0 ? C.red : "#1a5c2e" }}>{fmt(c.debt || 0)}</div><div style={{ fontSize: 10, color: C.mt }}>الرصيد الآجل ({cur})</div></div>
        {settings?.loyaltyOn && <div style={{ background: "#fff7eb", borderRadius: 10, padding: ".7rem", textAlign: "center" }}><div style={{ fontSize: 17, fontWeight: 700, color: C.gdd }}>🎁 {c.points || 0}</div><div style={{ fontSize: 10, color: C.mt }}>نقاط الولاء</div></div>}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.mt, marginBottom: 12 }}>
        <span style={{ color: "#25D366", fontSize: 15 }}>📱</span> واتساب: {c.phone}
      </div>

      {/* actions */}
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 14 }}>
        {(c.debt || 0) > 0 && <Btn gold onClick={() => setPayModal(true)}>💵 استلام دفعة + وصل</Btn>}
        <Btn onClick={sendBalanceReport} style={{ borderColor: "#25D366", color: "#128C4B" }}>📄 تقرير الرصيد PDF</Btn>
        <Btn onClick={sendInvoicesReport} style={{ borderColor: "#25D366", color: "#128C4B" }}>📄 تقرير الفواتير PDF</Btn>
      </div>

      {/* invoices list */}
      <div style={{ fontSize: 12, fontWeight: 700, color: C.mt, marginBottom: 8 }}>سجل فواتير الزبون ({custInvoices.length})</div>
      <div style={{ maxHeight: 220, overflowY: "auto" }}>
        <Table cols={[{ h: "رقم", w: "22%" }, { h: "التاريخ", w: "22%" }, { h: "الدفع", w: "18%" }, { h: "المبلغ", w: "20%" }, { h: "الحالة", w: "18%" }]}
          rows={custInvoices.length ? custInvoices.map(iv => ["#" + iv.id, arDate(iv.date), <Badge tone={PAY_TONE[iv.pay] || "g"}>{iv.pay}</Badge>, fmt(iv.total) + " " + cur, <Badge tone={iv.status === "مدفوعة" ? "g" : iv.status === "ملغاة" ? "r" : "a"}>{iv.status}</Badge>]) : [["—", "لا توجد فواتير", "", "", ""]]} />
      </div>

      {payModal && (
        <Modal title="استلام دفعة من الرصيد الآجل" onClose={() => setPayModal(false)} width={400}>
          <div style={{ textAlign: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: C.mt }}>الرصيد الآجل المستحق</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: C.red }}>{fmt(c.debt || 0)} {cur}</div>
          </div>
          <Field label="المبلغ المستلم"><Inp type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder="0.00" /></Field>
          <Field label="طريقة الاستلام">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
              {["كاش", "بطاقة", "تحويل"].map(m => (
                <div key={m} onClick={() => setPayVia(m)} style={{ border: `1px solid ${payVia === m ? C.gold : C.bc}`, borderRadius: 8, padding: ".4rem", textAlign: "center", cursor: "pointer", fontSize: 12, fontWeight: payVia === m ? 700 : 500, background: payVia === m ? C.gold + "14" : C.crm }}>{m}</div>
              ))}
            </div>
          </Field>
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            <Btn sm onClick={() => setPayAmount(String(c.debt || 0))}>المبلغ كامل</Btn>
            <Btn sm onClick={() => setPayAmount(String(Math.round((c.debt || 0) / 2)))}>النصف</Btn>
          </div>
          <div style={{ fontSize: 11, color: C.mt, marginBottom: 12 }}>سيتم إصدار وصل استلام قابل للطباعة، وتسوية الفواتير الآجلة تلقائياً حسب المبلغ.</div>
          <div style={{ display: "flex", gap: 8 }}><Btn gold onClick={receivePayment} style={{ flex: 1, justifyContent: "center" }}>✓ تأكيد وإصدار الوصل</Btn><Btn onClick={() => setPayModal(false)}>إلغاء</Btn></div>
        </Modal>
      )}
    </Modal>
  );
}
