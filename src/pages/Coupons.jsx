import { useState } from "react";
import { C, fmt } from "../constants/theme.js";
import { PageTop, Btn, Badge, Modal, Field, Inp } from "../components/ui.jsx";
import { arDate, todayISO } from "../utils/format.js";
import { couponState, COUPON_STATE_TONE } from "../utils/coupons.js";

/* ============================ COUPONS ============================ */
export default function Coupons({ ctx }) {
  const { coupons, setCoupons, invoices, showToast, confirm } = ctx;
  const cur = ctx.settings?.currency || "د.ل";
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null); // كوبون قيد التعديل — null يعني إنشاء جديد
  const [printModal, setPrintModal] = useState(null);
  const [printHistory, setPrintHistory] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("coupon_print_history") || "[]");
    } catch {
      return [];
    }
  });
  const [f, setF] = useState({ code: "", desc: "", pct: "", limit: "", exp: "" });

  const openAdd = () => { setEditing(null); setF({ code: "", desc: "", pct: "", limit: "", exp: "" }); setModal(true); };
  const openEdit = (c) => { setEditing(c); setF({ code: c.code, desc: c.desc || "", pct: String(c.pct), limit: String(c.limit), exp: c.exp }); setModal(true); };

  // إيرادات هذا الكوبون فعلياً — كان لا يوجد أي رابط بين استخدام الكوبون والفاتورة
  // التي استُخدم فيها، فلا يمكن قياس أثره الحقيقي على المبيعات
  const couponRevenue = (c) => invoices.filter(iv => iv.couponId === c.id || iv.coupon === c.code).reduce((s, iv) => s + iv.total, 0);

  const save = () => {
    if (!f.code.trim() || !f.pct) {
      showToast("أدخل الكود ونسبة الخصم");
      return;
    }
    if (!f.exp) {
      showToast("حدد تاريخ الانتهاء");
      return;
    }
    // نسبة خصم بلا حدود كانت تقبل قيماً سالبة أو أكبر من 100% بلا أي تحقق
    const pct = parseInt(f.pct);
    if (!(pct >= 1 && pct <= 100)) { showToast("نسبة الخصم يجب أن تكون بين 1% و100%"); return; }
    const limit = parseInt(f.limit) || 100;
    if (limit < 1) { showToast("حد الاستخدام يجب أن يكون 1 على الأقل"); return; }
    const code = f.code.toUpperCase().trim();
    // لا تحقق سابقاً من تكرار الكود — كوبونان بنفس الكود كانا يتطابقان معاً في
    // نقطة البيع بصمت، فيُطبَّق أولهما دائماً بلا أي تنبيه عن التكرار
    const dup = coupons.find(x => x.code === code && x.id !== editing?.id);
    if (dup) { showToast(`الكود «${code}» مستخدم بالفعل لكوبون آخر`); return; }

    if (editing) {
      setCoupons(cs => cs.map(x => x.id === editing.id ? { ...x, code, desc: f.desc, pct, limit, exp: f.exp } : x));
      showToast("✓ تم تحديث الكوبون");
    } else {
      const newCoupon = { id: Date.now(), code, desc: f.desc, pct, used: 0, limit, exp: f.exp, status: "نشط", createdAt: todayISO() };
      setCoupons((c) => [...c, newCoupon]);
      showToast("✓ تم إنشاء الكوبون");
    }
    setModal(false);
    setEditing(null);
    setF({ code: "", desc: "", pct: "", limit: "", exp: "" });
  };

  // تعطيل/تفعيل يدوي — لم تكن هناك وسيلة لإيقاف كوبون مبكراً سوى حذفه نهائياً
  const toggleActive = (c) => {
    setCoupons(cs => cs.map(x => x.id === c.id ? { ...x, status: x.status === "نشط" ? "معطّل" : "نشط" } : x));
    showToast(c.status === "نشط" ? "تم تعطيل الكوبون" : "تم تفعيل الكوبون");
  };
  const deleteCoupon = async (c) => {
    if (!(await confirm(`حذف الكوبون «${c.code}» نهائياً؟`))) return;
    setCoupons(cs => cs.filter(x => x.id !== c.id));
    showToast("تم حذف الكوبون");
  };

  const handlePrint = (coupon) => {
    if (!coupon?.code || !coupon?.pct || !coupon?.exp) {
      showToast("❌ بيانات الكوبون غير كاملة");
      return;
    }

    try {
      const expDate = coupon.exp ? arDate(coupon.exp) : "غير محدد";
      const html = `
<!DOCTYPE html>
<html dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>كوبون - ${coupon.code}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; }
    body { font-family: Arial, sans-serif; background: white; display: flex; align-items: center; justify-content: center; }
    .coupon {
      width: 80mm;
      padding: 8mm;
      border: 2px solid #c9a84c;
      background: linear-gradient(135deg, #0a2712 0%, #14431f 100%);
      color: white;
      text-align: center;
    }
    .club-name { font-size: 16px; font-weight: bold; color: #c9a84c; margin-bottom: 2mm; }
    .title { font-size: 11px; color: #f0d080; }
    .discount-num { font-size: 32px; font-weight: bold; color: #c9a84c; margin: 4mm 0; }
    .code { font-family: monospace; font-size: 14px; color: #c9a84c; margin: 3mm 0; letter-spacing: 1px; }
    .footer { font-size: 8px; color: #a0a0a0; margin-top: 4mm; }
    @media print {
      body { margin: 0; padding: 0; display: block; }
      .coupon { margin: 0; page-break-after: avoid; }
    }
  </style>
</head>
<body>
  <div class="coupon">
    <div class="club-name">نادي النخيل</div>
    <div class="title">كوبون خصم حصري</div>
    <div style="margin: 6mm 0;">
      <div style="font-size: 10px; color: #f0d080;">خصم</div>
      <div class="discount-num">${coupon.pct}%</div>
      <div class="code">${coupon.code}</div>
    </div>
    <div class="footer">
      <div>ينتهي: ${expDate}</div>
      <div>${coupon.desc || "على جميع الخدمات"}</div>
      <div style="margin-top: 2mm; font-size: 7px;">طبع: ${new Date().toLocaleDateString("ar-EG")}</div>
    </div>
  </div>
  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 100);
    };
  </script>
</body>
</html>`;

      // طريقة بديلة: استخدام Blob و object URL
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);

      // فتح في نافذة جديدة أو tab
      const printWindow = window.open(url, "_blank", "width=800,height=600");

      // إذا فشل فتح النافذة، استخدم طريقة بديلة
      if (!printWindow) {
        // طريقة بديلة: استخدام iframe
        const iframe = document.createElement("iframe");
        iframe.style.display = "none";
        iframe.onload = function() {
          iframe.contentWindow.document.write(html);
          iframe.contentWindow.document.close();
          setTimeout(() => {
            iframe.contentWindow.print();
          }, 100);
        };
        iframe.src = "about:blank";
        document.body.appendChild(iframe);

        showToast("✓ جاري تحضير الطباعة (بدون نافذة منبثقة)");
      } else {
        showToast("✓ افتح قائمة الطباعة (Ctrl+P أو Cmd+P)");
        URL.revokeObjectURL(url);
      }

      // تسجيل الطباعة
      const record = {
        couponCode: coupon.code,
        couponId: coupon.id,
        printedAt: new Date().toISOString(),
        discount: coupon.pct,
      };
      const newHistory = [record, ...printHistory];
      setPrintHistory(newHistory);
      localStorage.setItem("coupon_print_history", JSON.stringify(newHistory));

      setPrintModal(null);
    } catch (error) {
      showToast("❌ خطأ في الطباعة: " + (error.message || "غير معروف"));
      console.error(error);
    }
  };

  return (
    <>
      <PageTop
        title="كوبونات الخصم"
        action={
          <div style={{ display: "flex", gap: 8 }}>
            <Btn gold onClick={openAdd}>
              + إنشاء كوبون
            </Btn>
            {printHistory.length > 0 && (
              <Btn onClick={() => setPrintModal("history")}>
                📋 سجل الطباعة ({printHistory.length})
              </Btn>
            )}
          </div>
        }
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(290px,1fr))",
          gap: 11,
        }}
      >
        {coupons && coupons.length > 0 ? (
          coupons.map((c) => (
            <div
              key={c.id}
              style={{
                background: C.crm,
                border: `1.5px dashed ${C.gold}`,
                borderRadius: 12,
                padding: ".9rem 1rem",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div
                    style={{
                      fontFamily: "monospace",
                      fontSize: 15,
                      fontWeight: 700,
                      letterSpacing: 2,
                      color: C.grn2,
                    }}
                  >
                    {c.code}
                  </div>
                  <div style={{ fontSize: 11, color: C.mt, marginTop: 3 }}>
                    {c.desc}
                  </div>
                  <div style={{ fontSize: 10, color: C.k2, marginTop: 4 }}>
                    استُخدم {c.used || 0} / {c.limit} مرة
                  </div>
                  <div style={{ fontSize: 10, color: C.mt, marginTop: 2 }}>
                    إيراد الفواتير المرتبطة: {fmt(couponRevenue(c))} {cur}
                  </div>
                </div>
                <div style={{ textAlign: "left" }}>
                  <Badge tone={COUPON_STATE_TONE[couponState(c)]}>
                    {couponState(c)}
                  </Badge>
                  <div style={{ fontSize: 10, color: C.mt, marginTop: 5 }}>
                    ينتهي {arDate(c.exp)}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <Btn
                  gold
                  onClick={() => handlePrint(c)}
                  style={{ flex: 1, justifyContent: "center", fontSize: 12, padding: "8px 12px" }}
                >
                  🖨️ طباعة
                </Btn>
                <Btn sm onClick={() => openEdit(c)}>✎ تعديل</Btn>
                <Btn sm onClick={() => toggleActive(c)}>{c.status === "نشط" ? "⏸ تعطيل" : "▶ تفعيل"}</Btn>
                <Btn sm danger onClick={() => deleteCoupon(c)}>🗑 حذف</Btn>
              </div>
            </div>
          ))
        ) : (
          <div style={{ gridColumn: "1 / -1", textAlign: "center", color: C.mt }}>
            لا توجد كوبونات - اضغط "إنشاء كوبون" لإضافة واحد جديد
          </div>
        )}
      </div>

      {modal && (
        <Modal title={editing ? `تعديل كوبون — ${editing.code}` : "إنشاء كوبون جديد"} onClose={() => { setModal(false); setEditing(null); }} width={440}>
          <Field label="كود الكوبون">
            <Inp
              value={f.code}
              onChange={(e) => setF({ ...f, code: e.target.value })}
              placeholder="SUMMER50"
            />
          </Field>
          <Field label="الوصف">
            <Inp
              value={f.desc}
              onChange={(e) => setF({ ...f, desc: e.target.value })}
              placeholder="خصم الصيف"
            />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="نسبة الخصم %">
              <Inp
                type="number"
                value={f.pct}
                onChange={(e) => setF({ ...f, pct: e.target.value })}
                placeholder="50"
              />
            </Field>
            <Field label="حد الاستخدام">
              <Inp
                type="number"
                value={f.limit}
                onChange={(e) => setF({ ...f, limit: e.target.value })}
                placeholder="100"
              />
            </Field>
          </div>
          <Field label="تاريخ الانتهاء">
            <Inp
              type="date"
              value={f.exp}
              onChange={(e) => setF({ ...f, exp: e.target.value })}
            />
          </Field>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn gold onClick={save} style={{ flex: 1, justifyContent: "center" }}>
              ✓ {editing ? "حفظ التعديلات" : "حفظ"}
            </Btn>
            <Btn onClick={() => { setModal(false); setEditing(null); }}>إلغاء</Btn>
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
              <div
                style={{ textAlign: "center", color: C.mt, padding: "2rem" }}
              >
                لا توجد طباعات مسجلة
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: C.crm, color: C.gold }}>
                    <th
                      style={{
                        padding: "10px",
                        textAlign: "right",
                        borderBottom: `1px solid ${C.k2}`,
                      }}
                    >
                      الكود
                    </th>
                    <th
                      style={{
                        padding: "10px",
                        textAlign: "right",
                        borderBottom: `1px solid ${C.k2}`,
                      }}
                    >
                      الخصم
                    </th>
                    <th
                      style={{
                        padding: "10px",
                        textAlign: "right",
                        borderBottom: `1px solid ${C.k2}`,
                      }}
                    >
                      التاريخ والساعة
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {printHistory.map((record, idx) => (
                    <tr key={idx} style={{ borderBottom: `1px solid ${C.k2}` }}>
                      <td
                        style={{
                          padding: "10px",
                          fontFamily: "monospace",
                          fontWeight: "bold",
                          color: C.grn2,
                        }}
                      >
                        {record.couponCode}
                      </td>
                      <td style={{ padding: "10px", color: C.mt }}>
                        {record.discount}%
                      </td>
                      <td style={{ padding: "10px", fontSize: 12, color: C.mt }}>
                        {new Date(record.printedAt).toLocaleDateString(
                          "ar-EG",
                          {
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        )}
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
                showToast("✓ تم حذف السجل");
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
