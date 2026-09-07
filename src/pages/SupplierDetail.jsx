import { useState } from "react";
import { C, fmt } from "../constants/theme.js";
import { Modal, Field, Inp, Btn, Badge, Table } from "../components/ui.jsx";
import { openPdfDoc } from "../components/pdfHook.js";
import { todayISO, arDate } from "../utils/format.js";

/* ---- Supplier detail: statement, settle payment, receipt, WhatsApp ---- */
export default function SupplierDetail({ ctx, supplier, onClose }) {
  const { purchases, setPurchases, setSuppliers, showToast, settings } = ctx;
  const cur = settings?.currency || "د.ل";
  const [payModal, setPayModal] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payVia, setPayVia] = useState("كاش");
  const s = supplier;
  const supPurchases = purchases.filter(p => p.supplier === s.name);
  const deferredPurchases = supPurchases.filter(p => p.pay === "آجل");

  const settle = () => {
    const amt = parseFloat(payAmount) || 0;
    if (amt <= 0) { showToast("أدخل مبلغاً صحيحاً"); return; }
    if (amt > (s.due || 0)) { showToast("المبلغ أكبر من المستحقات"); return; }
    // reduce supplier due; settle oldest deferred purchases
    let remaining = amt;
    const sorted = [...deferredPurchases].sort((a, b) => a.date.localeCompare(b.date));
    const settledIds = [];
    for (const p of sorted) {
      if (remaining >= p.total) { remaining -= p.total; settledIds.push(p.id); }
    }
    setPurchases(ps => ps.map(x => settledIds.includes(x.id) ? { ...x, pay: "مسدد", status: "مستلم" } : x));
    setSuppliers(sup => sup.map(x => x.id === s.id ? { ...x, due: Math.max(0, (x.due || 0) - amt), status: (x.due || 0) - amt <= 0 ? "نشط" : x.status } : x));
    // سجّل الصرف — يُخصم من الخزينة بيوم الدفع وطريقته
    ctx.setPayments(ps => [{ id: "PY-" + Date.now(), date: todayISO(), kind: "صرف", party: s.name, via: payVia, amount: amt, by: ctx.user?.name || "—" }, ...ps]);
    printVoucher(amt);
    showToast(`تم سداد ${fmt(amt)} ${cur} للمورد وإصدار السند`);
    setPayModal(false); setPayAmount("");
  };

  const printVoucher = (amt) => {
    const isThermal = settings?.printer === "xprinter";
    const newDue = Math.max(0, (s.due || 0) - amt);
    const w = window.open("", "_blank", `width=${isThermal ? 340 : 800},height=600`);
    w.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>سند صرف</title>
    <style>*{box-sizing:border-box;margin:0;padding:0;font-family:${isThermal ? "monospace" : "'Tajawal',sans-serif"}}
    body{padding:${isThermal ? "10px" : "2cm"};direction:rtl;color:#1a1a18}
    .ttl{text-align:center;font-size:${isThermal ? "14px" : "18px"};font-weight:700;color:#1a5c2e}.sub{text-align:center;font-size:10px;color:#7a7870;margin-bottom:8px}
    .box{border:1px dashed #c9a84c;border-radius:8px;padding:${isThermal ? "8px" : "16px"};margin-top:10px}
    .r{display:flex;justify-content:space-between;font-size:${isThermal ? "11px" : "13px"};margin-bottom:6px}
    .big{font-size:${isThermal ? "18px" : "26px"};font-weight:700;color:#c0392b;text-align:center;margin:10px 0}
    .ft{text-align:center;font-size:10px;color:#7a7870;margin-top:14px;border-top:1px dashed #ccc;padding-top:8px}</style></head><body>
    <div class="ttl">🌴 ${settings?.clubName || "نادي النخيل"}</div><div class="sub">سند صرف للمورد</div>
    <div class="box">
      <div class="r"><span>التاريخ:</span><span>${new Date().toLocaleDateString("ar-LY")}</span></div>
      <div class="r"><span>المورد:</span><span>${s.name}</span></div>
      <div class="r"><span>الهاتف:</span><span>${s.phone}</span></div>
      <div class="big">${fmt(amt)} ${cur}</div>
      <div class="r"><span>المستحق السابق:</span><span>${fmt(s.due || 0)} ${cur}</span></div>
      <div class="r"><span>المتبقي:</span><span>${fmt(newDue)} ${cur}</span></div>
    </div>
    <div class="ft">${settings?.invoiceFooter || "نادي النخيل"}</div>
    <script>window.onload=function(){window.print();}</script></body></html>`);
    w.document.close();
  };

  const sendStatement = () => {
    // توليد كشف الحساب PDF — المستخدم يحفظه ويشاركه بنفسه عبر واتساب
    openPdfDoc(settings, {
      title: "كشف حساب مورد",
      recipientLabel: "المورد", recipientName: s.name, recipientPhone: s.phone,
      docNo: "SUP-" + s.id + "-" + Date.now().toString().slice(-4),
      columns: ["#", "رقم الطلب", "التاريخ", "المنتجات", "الدفع", "المبلغ"],
      rows: supPurchases.length
        ? supPurchases.map((p, i) => [i + 1, "#" + p.id, arDate(p.date), p.items, p.pay, fmt(p.total) + " " + cur])
        : [["—", "لا توجد طلبات", "", "", "", ""]],
      totals: [
        ["إجمالي الطلبات", fmt(s.total) + " " + cur],
        ["المستحقات غير المسددة", fmt(s.due || 0) + " " + cur],
      ],
      note: (s.due || 0) > 0 ? "سيتم تسديد المستحقات وفق الاتفاق المبرم. شكراً لتعاونكم." : "جميع المستحقات مسددة — شكراً لتعاونكم.",
    });
    showToast("فُتح كشف الحساب — احفظه كـ PDF ثم شاركه عبر واتساب المورد");
  };

  const PAY_TONE = { "كاش": "g", "بطاقة": "b", "تحويل": "p", "آجل": "a", "مسدد": "g" };
  return (
    <Modal title={`ملف المورد — ${s.name}`} onClose={onClose} width={620}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 14 }}>
        <div style={{ background: C.crm, borderRadius: 10, padding: ".7rem", textAlign: "center" }}><div style={{ fontSize: 17, fontWeight: 700, color: C.grn2 }}>{fmt(s.total)}</div><div style={{ fontSize: 10, color: C.mt }}>إجمالي الطلبات ({cur})</div></div>
        <div style={{ background: C.crm, borderRadius: 10, padding: ".7rem", textAlign: "center" }}><div style={{ fontSize: 17, fontWeight: 700 }}>{supPurchases.length}</div><div style={{ fontSize: 10, color: C.mt }}>عدد الطلبات</div></div>
        <div style={{ background: (s.due || 0) > 0 ? C.redbg : "#e1f4e8", borderRadius: 10, padding: ".7rem", textAlign: "center" }}><div style={{ fontSize: 17, fontWeight: 700, color: (s.due || 0) > 0 ? C.red : "#1a5c2e" }}>{fmt(s.due || 0)}</div><div style={{ fontSize: 10, color: C.mt }}>المستحقات ({cur})</div></div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.mt, marginBottom: 12 }}>
        <span style={{ color: "#25D366", fontSize: 15 }}>📱</span> واتساب: {s.phone || "غير مسجّل"} · التخصص: {s.spec}
      </div>

      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 14 }}>
        {(s.due || 0) > 0 && <Btn gold onClick={() => setPayModal(true)}>💵 سداد مستحقات + سند</Btn>}
        <Btn onClick={sendStatement} style={{ borderColor: "#25D366", color: "#128C4B" }}>📄 فتح كشف الحساب PDF</Btn>
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, color: C.mt, marginBottom: 8 }}>سجل طلبات الشراء ({supPurchases.length})</div>
      <div style={{ maxHeight: 220, overflowY: "auto" }}>
        <Table cols={[{ h: "رقم", w: "16%" }, { h: "التاريخ", w: "20%" }, { h: "المنتجات", w: "30%" }, { h: "الدفع", w: "16%" }, { h: "المبلغ", w: "18%" }]}
          rows={supPurchases.length ? supPurchases.map(p => ["#" + p.id, arDate(p.date), p.items, <Badge tone={PAY_TONE[p.pay] || "g"}>{p.pay}</Badge>, fmt(p.total) + " " + cur]) : [["—", "لا توجد طلبات", "", "", ""]]} />
      </div>

      {payModal && (
        <Modal title="سداد مستحقات المورد" onClose={() => setPayModal(false)} width={400}>
          <div style={{ textAlign: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: C.mt }}>المستحقات غير المسددة</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: C.red }}>{fmt(s.due || 0)} {cur}</div>
          </div>
          <Field label="المبلغ المدفوع"><Inp type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder="0.00" /></Field>
          <Field label="طريقة الدفع">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
              {["كاش", "بطاقة", "تحويل"].map(m => (
                <div key={m} onClick={() => setPayVia(m)} style={{ border: `1px solid ${payVia === m ? C.gold : C.bc}`, borderRadius: 8, padding: ".4rem", textAlign: "center", cursor: "pointer", fontSize: 12, fontWeight: payVia === m ? 700 : 500, background: payVia === m ? C.gold + "14" : C.crm }}>{m}</div>
              ))}
            </div>
          </Field>
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            <Btn sm onClick={() => setPayAmount(String(s.due || 0))}>المبلغ كامل</Btn>
            <Btn sm onClick={() => setPayAmount(String(Math.round((s.due || 0) / 2)))}>النصف</Btn>
          </div>
          <div style={{ fontSize: 11, color: C.mt, marginBottom: 12 }}>سيتم إصدار سند صرف قابل للطباعة، وتسوية طلبات الشراء الآجلة تلقائياً حسب المبلغ.</div>
          <div style={{ display: "flex", gap: 8 }}><Btn gold onClick={settle} style={{ flex: 1, justifyContent: "center" }}>✓ تأكيد وإصدار السند</Btn><Btn onClick={() => setPayModal(false)}>إلغاء</Btn></div>
        </Modal>
      )}
    </Modal>
  );
}
