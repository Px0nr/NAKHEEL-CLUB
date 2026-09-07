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
  const [printMode, setPrintMode] = useState("auto"); // auto | receipt80
  const [showSettings, setShowSettings] = useState(false);
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

  // تجهيز ملف الـPDF تلقائياً عند فتح المعاينة
  useEffect(() => {
    let cancelled = false;
    const prepare = async () => {
      // ننتظر لحظة حتى يكتمل عرض المستند والخط
      await new Promise(r => setTimeout(r, 350));
      try {
        const b = await html2pdf().set({
          margin: [8, 8, 10, 8],
          image: { type: "jpeg", quality: 0.96 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
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
  }, []);
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

  const printDoc = (mode = "auto") => {
    document.body.classList.add("nk-printing");
    if (mode === "receipt80") document.body.classList.add("nk-receipt-print");
    const done = () => {
      document.body.classList.remove("nk-printing");
      document.body.classList.remove("nk-receipt-print");
      window.removeEventListener("afterprint", done);
    };
    window.addEventListener("afterprint", done);
    setTimeout(done, 3000);
    window.print();
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
            <button onClick={() => printDoc("auto")} style={btn("rgba(255,255,255,.14)", "#fff")}>🖨 طباعة عادية</button>
            <button onClick={() => printDoc("receipt80")} style={btn("#ff9800", "#fff")}>🧾 طباعة 80 مم</button>
          </>
        )}
        {state !== "ready" && <button onClick={() => printDoc()} style={btn("rgba(255,255,255,.14)", "#fff")}>🖨 طباعة / حفظ</button>}
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
                <div style={{ fontSize: isReceiptMode ? 13 : 18, fontWeight: 900, color: D.grn }}>{s.clubName || "نادي النخيل"}</div>
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
