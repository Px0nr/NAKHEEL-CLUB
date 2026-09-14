import { useState, useEffect, useRef } from "react";
import html2pdf from "html2pdf.js";
import JsBarcode from "jsbarcode";
import { Crest } from "./ui.jsx";

export function PdfPreview({ doc, onClose, globalSettings }) {
  const s = doc.settings || {};
  const cfg = doc.cfg;
  const gs = globalSettings || {};
  const sheetRef = useRef(null);
  const barcodeRef = useRef(null);
  const [state, setState] = useState("preparing"); // preparing | ready | failed
  const [blob, setBlob] = useState(null);
  const [blobUrl, setBlobUrl] = useState(null);
  const [note, setNote] = useState("");
  // يبدأ تلقائياً بوضع الإيصال إن كانت الطابعة الحرارية مُختارة في الإعدادات —
  // كان يبدأ دائماً بالوضع العادي بغض النظر عن اختيار الطابعة، فيضطر من يملك
  // طابعة حرارية للضغط يدوياً على «طباعة 80 مم» في كل مستند
  const [printMode, setPrintMode] = useState(gs.printer === "xprinter" ? "receipt80" : "auto"); // auto | receipt80
  const [showSettings, setShowSettings] = useState(false);
  // عدد النسخ — يبدأ من إعداد النظام العام لكنه قابل للتعديل لهذه الطباعة
  // بعينها فقط (فاتورة واحدة أحياناً، نسختان -للزبون وللمحل- أحياناً أخرى)
  const [copies, setCopies] = useState(Math.max(1, parseInt(gs.printCopies) || 1));
  const docNo = cfg.docNo || ("DOC-" + Date.now().toString().slice(-6));
  const fileName = docNo + ".pdf";
  const isReceiptMode = printMode === "receipt80";

  // إعدادات الطباعة المخزنة (دمج الإعدادات العامة مع localStorage)
  const [printSettings, setPrintSettings] = useState(() => {
    try {
      const local = JSON.parse(localStorage.getItem("print_settings")) || {};
      return {
        receipt80FontSize: gs.receipt80FontSize || 9,
        receipt80Padding: gs.receipt80Padding || 6,
        normalFontSize: gs.normalFontSize || 11.5,
        normalPadding: gs.normalPadding || 12,
        showBarcode: gs.receipt80ShowBarcode !== false,
        hideFooter: gs.normalShowFooter === false || local.hideFooter,
      };
    } catch {
      return {
        receipt80FontSize: gs.receipt80FontSize || 9,
        receipt80Padding: gs.receipt80Padding || 6,
        normalFontSize: gs.normalFontSize || 11.5,
        normalPadding: gs.normalPadding || 12,
        showBarcode: gs.receipt80ShowBarcode !== false,
        hideFooter: gs.normalShowFooter === false,
      };
    }
  });

  const updatePrintSettings = (newSettings) => {
    setPrintSettings(prev => {
      const updated = { ...prev, ...newSettings };
      localStorage.setItem("print_settings", JSON.stringify(updated));
      return updated;
    });
  };

  // توليد الباركود عند التحديث
  useEffect(() => {
    if (barcodeRef.current && isReceiptMode && printSettings.showBarcode !== false) {
      try {
        JsBarcode(barcodeRef.current, docNo, { format: "CODE128", width: 1.5, height: 35 });
      } catch (e) {
        // تجاهل الأخطاء في الباركود
      }
    }
  }, [docNo, isReceiptMode, printSettings.showBarcode]);

  // تجهيز ملف الـPDF تلقائياً عند فتح المعاينة — يُعاد التجهيز أيضاً عند تبديل
  // الوضع بين عادي/80مم، إذ لكل وضع تخطيط وحجم صفحة مختلفَين تماماً
  useEffect(() => {
    let cancelled = false;
    setState("preparing");
    const prepare = async () => {
      // ننتظر لحظة حتى يكتمل عرض المستند والخط
      await new Promise(r => setTimeout(r, 350));
      try {
        // وضع الإيصال 80مم كان يُصدَّر دائماً بصيغة A4 بغض النظر عن اختيار
        // المستخدم — الملف المُنزَّل أو المُشارَك عبر واتساب يكون صفحة A4
        // كاملة بمحتوى ضيق داخلها، لا إيصالاً حقيقياً بحجم 80مم. الحجم هنا
        // يُحسب من الارتفاع الفعلي للمحتوى المعروض (ورق حراري لفّة مستمرة
        // بلا طول صفحة ثابت، فلا معنى لاستخدام A4 أو حتى طول 80مم ثابت).
        let jsPdfOpts = { unit: "mm", format: "a4", orientation: "portrait" };
        let margin = [8, 8, 10, 8];
        if (isReceiptMode && sheetRef.current) {
          const pxToMm = 0.264583;
          const heightMm = Math.max(60, sheetRef.current.scrollHeight * pxToMm + 16);
          jsPdfOpts = { unit: "mm", format: [80, heightMm], orientation: "portrait" };
          margin = [3, 3, 5, 3];
        }
        const b = await html2pdf().set({
          margin,
          image: { type: "jpeg", quality: 0.96 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
          jsPDF: jsPdfOpts,
        }).from(sheetRef.current).output("blob");
        if (cancelled) return;
        const url = URL.createObjectURL(b);
        setBlob(b); setBlobUrl(url); setState("ready");
      } catch {
        if (!cancelled) setState("failed");
      }
    };
    prepare();
    return () => { cancelled = true; };
  }, [isReceiptMode]);
  useEffect(() => () => { if (blobUrl) URL.revokeObjectURL(blobUrl); }, [blobUrl]);

  // مشاركة أصلية (الأجهزة اللوحية/الهواتف): تفتح قائمة النظام ← واتساب والملف مرفق
  const shareFile = async () => {
    if (!blob) return;
    try {
      const f = new File([blob], fileName, { type: "application/pdf" });
      if (navigator.canShare && navigator.canShare({ files: [f] })) {
        await navigator.share({ files: [f], title: cfg.title });
      } else {
        setNote("المشاركة المباشرة غير مدعومة في هذا المتصفح — استخدم زر التنزيل ثم شارك الملف من جهازك.");
      }
    } catch { /* المستخدم أغلق قائمة المشاركة */ }
  };

  const printDoc = (mode = "auto", copyCount = 1) => {
    document.body.classList.add("nk-printing");
    // @page لا يمكن تقييده بصنف على body في CSS القياسية (هو قاعدة عامة على
    // مستوى المستند) — بلا هذا الحقن المؤقت، حجم الصفحة الفعلي المُرسل
    // للطابعة يبقى افتراضي المتصفح (A4/Letter غالباً) حتى مع تضييق المحتوى
    // بصرياً إلى 80مم، فتُنتج الطابعات الحرارية تغذية ورق زائدة بعد كل إيصال
    let pageStyleEl = null;
    if (mode === "receipt80") {
      document.body.classList.add("nk-receipt-print");
      pageStyleEl = document.createElement("style");
      pageStyleEl.textContent = "@page { size: 80mm auto; margin: 0; }";
      document.head.appendChild(pageStyleEl);
    }
    // متصفحات الويب لا تعرض معامل "عدد النسخ" لـwindow.print() برمجياً — الحل
    // العملي هو استدعاء print() مرة أخرى بعد كل afterprint حتى نطبع العدد
    // المطلوب. هذا يهم تحديداً أجهزة الكاشير التي تعمل بوضع طباعة صامتة
    // (بلا نافذة طباعة أصلاً)، فتعتمد بصمت على آخر عدد نسخ محفوظ للطابعة —
    // قد يكون 2 دون علم المستخدم وبلا أي مكان لتعديله من هناك
    const total = Math.max(1, parseInt(copyCount) || 1);
    let printed = 0;
    const cleanup = () => {
      document.body.classList.remove("nk-printing");
      document.body.classList.remove("nk-receipt-print");
      if (pageStyleEl) { pageStyleEl.remove(); pageStyleEl = null; }
      window.removeEventListener("afterprint", onAfterPrint);
    };
    const triggerPrint = () => { printed++; window.print(); };
    const onAfterPrint = () => {
      if (printed < total) setTimeout(triggerPrint, 400);
      else cleanup();
    };
    window.addEventListener("afterprint", onAfterPrint);
    // شبكة أمان: بعض أوضاع الطباعة الصامتة لا تُطلق afterprint إطلاقاً
    setTimeout(cleanup, total * 4000 + 1500);
    triggerPrint();
  };

  const btn = (bg, color) => ({ background: bg, color, border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, padding: "8px 15px", cursor: "pointer", fontFamily: "inherit", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 5 });
  const hint = note
    || (state === "preparing" ? "⏳ جارٍ تجهيز ملف الـPDF تلقائياً..."
      : state === "failed" ? "تعذّر تجهيز الملف — استخدم زر «طباعة / حفظ» واختر PDF."
        : "✅ الملف جاهز — نزّله أو شاركه عبر واتساب 📎 مباشرة");

  const D = { grn: "#1a5c2e", gold: "#c9a84c", gld: "#f0d080", mt: "#7a7870", crm: "#faf8f2" };
  const th = { background: D.grn, color: D.gld, padding: isReceiptMode ? "4px 5px" : "7px 9px", textAlign: "right", fontSize: isReceiptMode ? 9 : 11.5, fontWeight: 700 };
  const td = { padding: isReceiptMode ? "3px 5px" : "6px 9px", borderBottom: "0.5px solid #e8e4d8", fontSize: isReceiptMode ? 9 : 11.5, color: "#1a1a18" };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 700, background: "rgba(12,20,14,.75)", display: "flex", flexDirection: "column" }}>
      {/* شريط الأدوات */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: ".65rem .9rem", background: D.grn, boxShadow: "0 2px 12px rgba(0,0,0,.3)", flexWrap: "wrap" }}>
        <span style={{ color: D.gld, fontWeight: 700, fontSize: 13, flex: 1, minWidth: 130 }}>📄 {cfg.title}</span>
        {state === "ready" && (
          <>
            <a href={blobUrl} download={fileName} style={btn(D.gold, "#fff")}>⬇ تنزيل PDF</a>
            <button onClick={shareFile} style={btn("#25D366", "#fff")}>📤 مشاركة</button>
          </>
        )}
        {state === "preparing" && <span style={{ ...btn("rgba(255,255,255,.14)", "#fff"), cursor: "default" }}>⏳ تجهيز الملف...</span>}
        {state === "ready" && (
          <>
            {/* التبديل هنا يُعيد أيضاً تجهيز الملف بحجم الصفحة الصحيح لهذا الوضع
                (انظر useEffect أعلاه) — لا يكتفي بتغيير الطباعة الفورية فقط */}
            <button onClick={() => setPrintMode("auto")} style={btn(printMode === "auto" ? "rgba(255,255,255,.32)" : "rgba(255,255,255,.14)", "#fff")}>🖨 عرض عادي</button>
            <button onClick={() => setPrintMode("receipt80")} style={btn(printMode === "receipt80" ? "#ff9800" : "rgba(255,255,255,.14)", "#fff")}>🧾 عرض 80 مم</button>
            {/* عدد نسخ هذه الطباعة تحديداً — لا يغيّر الإعداد العام في النظام،
                يتيح فقط رفع/خفض العدد لهذا الإصدار بعينه (فاتورة واحدة أحياناً،
                نسختان -للزبون وللمحل- أحياناً أخرى) */}
            <input type="number" min="1" max="5" value={copies} onChange={e => setCopies(Math.max(1, Math.min(5, parseInt(e.target.value) || 1)))}
              title="عدد النسخ لهذه الطباعة" style={{ width: 44, textAlign: "center", borderRadius: 8, border: "1px solid rgba(255,255,255,.3)", background: "rgba(255,255,255,.14)", color: "#fff", fontSize: 13, padding: "6px 4px" }} />
            <button onClick={() => printDoc(printMode, copies)} style={btn(D.gold, "#fff")}>🖨 طباعة</button>
          </>
        )}
        {state !== "ready" && <button onClick={() => printDoc("auto", copies)} style={btn("rgba(255,255,255,.14)", "#fff")}>🖨 طباعة / حفظ</button>}
        <button onClick={() => setShowSettings(!showSettings)} style={btn("rgba(255,255,255,.14)", "#fff")}>⚙️ إعدادات</button>
        <button onClick={onClose} style={btn("rgba(255,255,255,.14)", "#fff")}>✕ إغلاق</button>
      </div>
      <div style={{ background: state === "ready" ? "#e8f8ee" : "#fdf6e3", color: state === "ready" ? "#1a5c2e" : "#8a6a20", fontSize: 11.5, padding: "6px 14px", textAlign: "center" }}>
        {hint}
      </div>

      {/* نافذة الإعدادات */}
      {showSettings && (
        <div style={{ background: "#f5f1e8", borderBottom: "1px solid #ddd", padding: "12px 14px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, maxWidth: 600 }}>
            <div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12 }}>
                <input
                  type="checkbox"
                  checked={printSettings.showBarcode !== false}
                  onChange={(e) => updatePrintSettings({ showBarcode: e.target.checked })}
                />
                📦 إظهار الباركود في 80 مم
              </label>
            </div>

            <div>
              <label style={{ fontSize: 12, display: "block", marginBottom: 4 }}>
                📏 حجم الخط (80 مم): <b>{printSettings.receipt80FontSize || 9}px</b>
              </label>
              <input
                type="range"
                min="7"
                max="11"
                value={printSettings.receipt80FontSize || 9}
                onChange={(e) => updatePrintSettings({ receipt80FontSize: parseInt(e.target.value) })}
                style={{ width: "100%" }}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, display: "block", marginBottom: 4 }}>
                📏 حجم الخط (عادي): <b>{printSettings.normalFontSize || 11.5}px</b>
              </label>
              <input
                type="range"
                min="9"
                max="14"
                step="0.5"
                value={printSettings.normalFontSize || 11.5}
                onChange={(e) => updatePrintSettings({ normalFontSize: parseFloat(e.target.value) })}
                style={{ width: "100%" }}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, display: "block", marginBottom: 4 }}>
                🪟 الفراغ (80 مم): <b>{printSettings.receipt80Padding || 6}px</b>
              </label>
              <input
                type="range"
                min="2"
                max="10"
                value={printSettings.receipt80Padding || 6}
                onChange={(e) => updatePrintSettings({ receipt80Padding: parseInt(e.target.value) })}
                style={{ width: "100%" }}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, display: "block", marginBottom: 4 }}>
                🪟 الفراغ (عادي): <b>{printSettings.normalPadding || 12}px</b>
              </label>
              <input
                type="range"
                min="8"
                max="20"
                value={printSettings.normalPadding || 12}
                onChange={(e) => updatePrintSettings({ normalPadding: parseInt(e.target.value) })}
                style={{ width: "100%" }}
              />
            </div>

            <div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12 }}>
                <input
                  type="checkbox"
                  checked={printSettings.hideFooter !== true}
                  onChange={(e) => updatePrintSettings({ hideFooter: !e.target.checked })}
                />
                👣 إظهار التذييل
              </label>
            </div>
          </div>
        </div>
      )}

      {/* المستند */}
      <div style={{ flex: 1, overflowY: "auto", padding: isReceiptMode ? "8px 5px" : "18px 10px" }}>
        <div ref={sheetRef} className="nk-pdf-sheet" dir="rtl" style={{
          maxWidth: isReceiptMode ? 220 : 780,
          margin: "0 auto",
          background: "#fff",
          padding: isReceiptMode ? `${printSettings.receipt80Padding || 6}px 10px` : `26px ${printSettings.normalPadding || 12}px`,
          borderRadius: isReceiptMode ? 2 : 6,
          boxShadow: isReceiptMode ? "none" : "0 8px 30px rgba(0,0,0,.35)",
          fontFamily: "'Tajawal',sans-serif",
          color: "#1a1a18",
          fontSize: isReceiptMode ? `${printSettings.receipt80FontSize || 9}px` : `${printSettings.normalFontSize || 11.5}px`
        }}>
          {/* الترويسة */}
          <div style={{
            display: isReceiptMode ? "flex" : "flex",
            flexDirection: isReceiptMode ? "column" : "row",
            alignItems: "center",
            justifyContent: isReceiptMode ? "center" : "space-between",
            borderBottom: `${isReceiptMode ? 1.5 : 2.5}px solid ${D.gold}`,
            paddingBottom: isReceiptMode ? 6 : 12,
            marginBottom: isReceiptMode ? 6 : 14,
            gap: isReceiptMode ? 4 : 11
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: isReceiptMode ? 6 : 11, flexDirection: isReceiptMode ? "column" : "row" }}>
              {s.logo ? <img src={s.logo} alt="" style={{ width: isReceiptMode ? 32 : 54, height: isReceiptMode ? 32 : 54, borderRadius: 12, objectFit: "cover" }} /> : <Crest size={isReceiptMode ? 32 : 54} />}
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: isReceiptMode ? 13 : 18, fontWeight: 900, color: D.grn, ...(isReceiptMode ? { maxWidth: 190, overflowWrap: "anywhere", wordBreak: "break-word", lineHeight: 1.3 } : {}) }}>{s.clubName || "نادي النخيل"}</div>
                {!isReceiptMode && <div style={{ fontSize: 10.5, color: D.mt, marginTop: 2 }}>{s.clubSub || "النادي الرياضي الترفيهي"}</div>}
              </div>
            </div>
            {!isReceiptMode && <div style={{ textAlign: "left", fontSize: 10.5, color: D.mt, lineHeight: 1.8 }}>
              {s.address || "مصراتة، ليبيا"}<br />هاتف: {s.phone || ""}<br />التاريخ: {new Date().toLocaleDateString("ar-LY")}
            </div>}
          </div>

          <div style={{ textAlign: "center", margin: isReceiptMode ? "3px 0 6px" : "4px 0 12px" }}>
            <span style={{ fontSize: isReceiptMode ? 12 : 16, fontWeight: 700, color: D.grn, borderBottom: `1.5px dashed ${D.gold}`, paddingBottom: 3 }}>{cfg.title}</span>
          </div>

          {!isReceiptMode && <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, background: D.crm, border: "0.5px solid rgba(201,168,76,.35)", borderRadius: 10, padding: "9px 13px", marginBottom: 12, fontSize: 11.5 }}>
            <span>{cfg.recipientLabel || "إلى"}: <b style={{ color: D.grn }}>{cfg.recipientName || "—"}</b></span>
            {cfg.recipientPhone && <span>الهاتف: <b style={{ color: D.grn }}>{cfg.recipientPhone}</b></span>}
            <span>رقم المستند: <b style={{ color: D.grn }}>{docNo}</b></span>
          </div>}
          {isReceiptMode && <div style={{ textAlign: "center", fontSize: 9, marginBottom: 6, color: D.mt }}>
            {cfg.recipientName && <div>👤 {cfg.recipientName}</div>}
            <div>رقم: {docNo}</div>
          </div>}

          {/* باركود في 80 مم */}
          {isReceiptMode && printSettings.showBarcode !== false && (
            <div style={{ textAlign: "center", marginBottom: isReceiptMode ? 4 : 12 }}>
              <svg ref={barcodeRef} style={{ margin: "0 auto", maxWidth: "100%" }}></svg>
              <div style={{ fontSize: isReceiptMode ? 8 : 10, color: D.mt, marginTop: 2 }}>{docNo}</div>
            </div>
          )}

          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 12 }}>
            <thead><tr>{cfg.columns.map((c, i) => <th key={i} style={th}>{c}</th>)}</tr></thead>
            <tbody>{cfg.rows.map((r, ri) => (
              <tr key={ri} style={{ background: ri % 2 ? D.crm : "#fff" }}>{r.map((cell, ci) => <td key={ci} style={td}>{cell}</td>)}</tr>
            ))}</tbody>
          </table>

          {cfg.totals && cfg.totals.length > 0 && (
            <div style={{ display: "flex", marginBottom: isReceiptMode ? 6 : 12 }}>
              <div style={{ minWidth: isReceiptMode ? 140 : 250, border: "1px solid rgba(201,168,76,.5)", borderRadius: isReceiptMode ? 4 : 10, overflow: "hidden" }}>
                {cfg.totals.map((t, i) => {
                  const last = i === cfg.totals.length - 1;
                  return (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: isReceiptMode ? "4px 8px" : "7px 13px", fontSize: isReceiptMode ? 10 : (last ? 13 : 12), borderBottom: last ? "none" : "0.5px solid rgba(201,168,76,.25)", background: last ? D.grn : "transparent", color: last ? D.gld : "#1a1a18", fontWeight: last ? 700 : 500 }}>
                      <span>{t[0]}</span><span>{t[1]}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {cfg.note && !isReceiptMode && <div style={{ background: "#fdf6e3", border: `0.5px dashed ${D.gold}`, borderRadius: 9, padding: "8px 12px", fontSize: 11, color: "#8a6a20", marginBottom: 12 }}>📌 {cfg.note}</div>}

          {!isReceiptMode && <div style={{ marginTop: 24, display: "flex", justifyContent: "space-between", fontSize: 10.5, color: D.mt }}>
            <div style={{ width: 150, borderTop: "1px dashed #aaa", textAlign: "center", paddingTop: 4 }}>توقيع المستلم</div>
            <div style={{ width: 150, borderTop: "1px dashed #aaa", textAlign: "center", paddingTop: 4 }}>الختم / الإدارة</div>
          </div>}
          {printSettings.hideFooter !== true && (
            <div style={{ textAlign: "center", fontSize: isReceiptMode ? 8 : 10, color: D.mt, borderTop: isReceiptMode ? "none" : "1px solid rgba(201,168,76,.4)", paddingTop: isReceiptMode ? 4 : 8, marginTop: isReceiptMode ? 6 : 10 }}>
              {isReceiptMode ? (
                <div>
                  <div style={{ fontSize: 9, fontWeight: 600 }}>{new Date().toLocaleDateString("ar-LY", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</div>
                  <div style={{ marginTop: 2 }}>شكراً لتعاملكم 🙏</div>
                </div>
              ) : (
                <>{s.invoiceFooter || "شكراً لتعاملكم — " + (s.clubName || "نادي النخيل")} — مستند مُولّد آلياً</>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
