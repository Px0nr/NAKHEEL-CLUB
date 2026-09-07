import { useState, useRef, useEffect } from "react";
import * as QRCodeLib from "qrcode.react";
const QRCode = QRCodeLib.default || QRCodeLib.QRCode || QRCodeLib;
import { C } from "../constants/theme.js";
import { PageTop, Btn, Badge, Modal, Field, Inp } from "../components/ui.jsx";
import { arDate, todayISO } from "../utils/format.js";

/* نموذج الطباعة للكوبون */
function CouponPrintTemplate({ coupon, showToast }) {
  const qrRef = useRef();

  const handlePrint = () => {
    try {
      if (!qrRef.current) {
        showToast("❌ جارٍ تحضير رمز QR... يرجى المحاولة مرة أخرى");
        return;
      }

      const canvas = qrRef.current.querySelector("canvas");
      if (!canvas) {
        showToast("❌ خطأ في توليد رمز QR - جرب إعادة تحميل الصفحة");
        return;
      }

      let qrDataUrl;
      try {
        qrDataUrl = canvas.toDataURL("image/png");
      } catch (e) {
        showToast("❌ لا يمكن تصدير رمز QR - جرب متصفح مختلف");
        console.error("QR Export Error:", e);
        return;
      }

      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        showToast("❌ فشل فتح نافذة الطباعة - تحقق من حجب النوافذ المنبثقة");
        return;
      }

      const html = `
      <!DOCTYPE html>
      <html dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>كوبون خصم - ${coupon.code}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { margin: 0; padding: 0; font-family: 'Arial', sans-serif; background: white; }
          .coupon {
            width: 80mm;
            height: auto;
            padding: 8mm;
            border: 2px solid #c9a84c;
            border-radius: 8px;
            background: linear-gradient(135deg, #0a2712 0%, #14431f 100%);
            color: white;
            text-align: center;
          }
          .header { margin-bottom: 6mm; }
          .club-name { font-size: 16px; font-weight: bold; color: #c9a84c; margin-bottom: 2mm; }
          .coupon-title { font-size: 11px; color: #f0d080; }
          .content { margin: 6mm 0; }
          .discount { font-size: 32px; font-weight: bold; color: #c9a84c; margin: 3mm 0; }
          .discount-text { font-size: 10px; color: #f0d080; }
          .code { font-family: 'Courier New', monospace; font-size: 14px; font-weight: bold; letter-spacing: 1px; color: #c9a84c; margin: 3mm 0; }
          .qr-section { text-align: center; margin: 4mm 0; }
          .qr-section img { width: 45mm; height: 45mm; }
          .footer { text-align: center; font-size: 8px; color: #a0a0a0; margin-top: 4mm; }
          .exp-date { font-size: 9px; color: #f0d080; margin: 1mm 0; }
          @media print {
            body { margin: 0; padding: 0; background: white; }
            .coupon { margin: 0; box-shadow: none; page-break-after: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="coupon">
          <div class="header">
            <div class="club-name">🌴 نادي النخيل</div>
            <div class="coupon-title">كوبون خصم حصري</div>
          </div>
          <div class="content">
            <div class="discount-text">خصم</div>
            <div class="discount">${coupon.pct}%</div>
            <div class="code">${coupon.code}</div>
          </div>
          <div class="qr-section">
            <img src="${qrDataUrl}" alt="QR Code">
          </div>
          <div class="footer">
            <div class="exp-date">ينتهي: ${arDate(coupon.exp)}</div>
            <div>استخدم: ${coupon.desc || "على جميع الخدمات"}</div>
            <div style="margin-top: 1mm; font-size: 7px;">طُبِعَ: ${new Date().toLocaleDateString('ar-EG')}</div>
          </div>
        </div>
      </body>
      </html>
    `;

      printWindow.document.write(html);
      printWindow.document.close();

      setTimeout(() => {
        try {
          printWindow.print();
          setTimeout(() => printWindow.close(), 1000);
        } catch (e) {
          showToast("❌ خطأ في الطباعة");
          console.error("Print Error:", e);
        }
      }, 500);

      showToast("✓ تم فتح نافذة الطباعة");
    } catch (error) {
      showToast("❌ حدث خطأ غير متوقع: " + error.message);
      console.error("Print Error:", error);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
      <div ref={qrRef} style={{ padding: 16, background: "white", borderRadius: 8 }} key={coupon.id}>
        {coupon?.code ? (
          <QRCode
            value={coupon.code}
            size={120}
            level="H"
            includeMargin={true}
            quietZone={10}
          />
        ) : (
          <div style={{ fontSize: 12, color: "red" }}>خطأ: لا يوجد كود كوبون</div>
        )}
      </div>
      <Btn gold onClick={handlePrint} style={{ width: "100%", justifyContent: "center" }}>
        🖨️ طباعة على 80 مم
      </Btn>
    </div>
  );
}

/* ============================ COUPONS ============================ */
export default function Coupons({ ctx }) {
  const { coupons, setCoupons, showToast } = ctx;
  const [modal, setModal] = useState(false);
  const [printModal, setPrintModal] = useState(null);
  const [printHistory, setPrintHistory] = useState(JSON.parse(localStorage.getItem("coupon_print_history") || "[]"));
  const [f, setF] = useState({ code: "", desc: "", pct: "", limit: "", exp: "" });

  const save = () => {
    if (!f.code.trim() || !f.pct) { showToast("أدخل الكود ونسبة الخصم"); return; }
    if (!f.exp) { showToast("حدد تاريخ الانتهاء"); return; }
    const newCoupon = {
      id: Date.now(),
      code: f.code.toUpperCase(),
      desc: f.desc,
      pct: parseInt(f.pct),
      used: 0,
      limit: parseInt(f.limit) || 100,
      exp: f.exp,
      status: "نشط",
      createdAt: todayISO()
    };
    setCoupons(c => [...c, newCoupon]);
    showToast("تم إنشاء الكوبون");
    setModal(false);
    setF({ code: "", desc: "", pct: "", limit: "", exp: "" });
  };

  const handlePrint = (coupon) => {
    setPrintModal(coupon);
  };

  const recordPrint = () => {
    if (!printModal || printModal === "history") return;
    try {
      const record = {
        couponCode: printModal.code,
        couponId: printModal.id,
        printedAt: new Date().toISOString(),
        discount: printModal.pct,
      };
      const newHistory = [record, ...printHistory];
      setPrintHistory(newHistory);
      localStorage.setItem("coupon_print_history", JSON.stringify(newHistory));
      showToast("✓ تم تسجيل طباعة الكوبون");
      setPrintModal(null);
    } catch (e) {
      showToast("❌ حدث خطأ في تسجيل الطباعة");
      console.error(e);
    }
  };
  return (
    <>
      <PageTop
        title="كوبونات الخصم"
        action={
          <div style={{ display: "flex", gap: 8 }}>
            <Btn gold onClick={() => setModal(true)}>+ إنشاء كوبون</Btn>
            {printHistory.length > 0 && (
              <Btn onClick={() => setPrintModal("history")}>📋 سجل الطباعة ({printHistory.length})</Btn>
            )}
          </div>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(290px,1fr))", gap: 11 }}>
        {coupons.map(c => (
          <div
            key={c.id}
            style={{
              background: C.crm,
              border: `1.5px dashed ${C.gold}`,
              borderRadius: 12,
              padding: ".9rem 1rem",
              display: "flex",
              flexDirection: "column",
              gap: 10
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontFamily: "monospace", fontSize: 15, fontWeight: 700, letterSpacing: 2, color: C.grn2 }}>
                  {c.code}
                </div>
                <div style={{ fontSize: 11, color: C.mt, marginTop: 3 }}>{c.desc}</div>
                <div style={{ fontSize: 10, color: C.k2, marginTop: 4 }}>استُخدم {c.used} / {c.limit} مرة</div>
              </div>
              <div style={{ textAlign: "left" }}>
                <Badge tone={c.status === "نشط" ? "g" : "r"}>{c.status}</Badge>
                <div style={{ fontSize: 10, color: C.mt, marginTop: 5 }}>ينتهي {arDate(c.exp)}</div>
              </div>
            </div>
            <Btn
              gold
              onClick={() => handlePrint(c)}
              style={{ justifyContent: "center", fontSize: 12, padding: "8px 12px" }}
            >
              🖨️ طباعة كوبون
            </Btn>
          </div>
        ))}
      </div>

      {modal && (
        <Modal title="إنشاء كوبون جديد" onClose={() => setModal(false)} width={440}>
          <Field label="كود الكوبون">
            <Inp value={f.code} onChange={e => setF({ ...f, code: e.target.value })} placeholder="GAME25" />
          </Field>
          <Field label="الوصف">
            <Inp
              value={f.desc}
              onChange={e => setF({ ...f, desc: e.target.value })}
              placeholder="خصم على الألعاب"
            />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="نسبة الخصم %">
              <Inp
                type="number"
                value={f.pct}
                onChange={e => setF({ ...f, pct: e.target.value })}
              />
            </Field>
            <Field label="حد الاستخدام">
              <Inp
                type="number"
                value={f.limit}
                onChange={e => setF({ ...f, limit: e.target.value })}
              />
            </Field>
          </div>
          <Field label="تاريخ الانتهاء">
            <Inp
              type="date"
              value={f.exp}
              onChange={e => setF({ ...f, exp: e.target.value })}
            />
          </Field>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn gold onClick={save} style={{ flex: 1, justifyContent: "center" }}>
              ✓ حفظ
            </Btn>
            <Btn onClick={() => setModal(false)}>إلغاء</Btn>
          </div>
        </Modal>
      )}

      {printModal && printModal !== "history" && (
        <Modal title={`طباعة كوبون: ${printModal.code}`} onClose={() => setPrintModal(null)} width={450}>
          <CouponPrintTemplate coupon={printModal} showToast={showToast} />
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <Btn
              gold
              onClick={recordPrint}
              style={{ flex: 1, justifyContent: "center" }}
            >
              ✓ تم الطباعة
            </Btn>
            <Btn onClick={() => setPrintModal(null)}>إلغاء</Btn>
          </div>
        </Modal>
      )}

      {printModal === "history" && (
        <Modal
          title={`سجل طباعة الكوبونات (${printHistory.length})`}
          onClose={() => setPrintModal(null)}
          width={600}
        >
          <div style={{ maxHeight: "60vh", overflowY: "auto" }}>
            {printHistory.length === 0 ? (
              <div style={{ textAlign: "center", color: C.mt, padding: "2rem" }}>
                لا توجد طباعات مسجلة
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: C.crm, color: C.gold }}>
                    <th style={{ padding: "10px", textAlign: "right", borderBottom: `1px solid ${C.k2}` }}>
                      الكود
                    </th>
                    <th style={{ padding: "10px", textAlign: "right", borderBottom: `1px solid ${C.k2}` }}>
                      الخصم
                    </th>
                    <th style={{ padding: "10px", textAlign: "right", borderBottom: `1px solid ${C.k2}` }}>
                      تاريخ الطباعة
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {printHistory.map((record, idx) => (
                    <tr key={idx} style={{ borderBottom: `1px solid ${C.k2}` }}>
                      <td style={{ padding: "10px", fontFamily: "monospace", fontWeight: "bold", color: C.grn2 }}>
                        {record.couponCode}
                      </td>
                      <td style={{ padding: "10px", color: C.mt }}>
                        {record.discount}%
                      </td>
                      <td style={{ padding: "10px", fontSize: 12, color: C.mt }}>
                        {new Date(record.printedAt).toLocaleDateString("ar-EG", {
                          year: "numeric",
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <Btn
              onClick={() => {
                setPrintHistory([]);
                localStorage.removeItem("coupon_print_history");
                showToast("تم حذف السجل");
              }}
              style={{ flex: 1, justifyContent: "center" }}
            >
              🗑️ حذف السجل
            </Btn>
            <Btn onClick={() => setPrintModal(null)}>إغلاق</Btn>
          </div>
        </Modal>
      )}
    </>
  );
}
