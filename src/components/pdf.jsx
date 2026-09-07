import { useState, useEffect, useRef } from "react";
import html2pdf from "html2pdf.js";
import { Crest } from "./ui.jsx";

export function PdfPreview({ doc, onClose }) {
  const s = doc.settings || {};
  const cfg = doc.cfg;
  const sheetRef = useRef(null);
  const [state, setState] = useState("preparing"); // preparing | ready | failed
  const [blob, setBlob] = useState(null);
  const [blobUrl, setBlobUrl] = useState(null);
  const [note, setNote] = useState("");
  const docNo = cfg.docNo || ("DOC-" + Date.now().toString().slice(-6));
  const fileName = docNo + ".pdf";

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

  const printDoc = () => {
    document.body.classList.add("nk-printing");
    const done = () => { document.body.classList.remove("nk-printing"); window.removeEventListener("afterprint", done); };
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
  const th = { background: D.grn, color: D.gld, padding: "7px 9px", textAlign: "right", fontSize: 11.5, fontWeight: 700 };
  const td = { padding: "6px 9px", borderBottom: "0.5px solid #e8e4d8", fontSize: 11.5, color: "#1a1a18" };

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
        <button onClick={printDoc} style={btn("rgba(255,255,255,.14)", "#fff")}>🖨 طباعة / حفظ</button>
        <button onClick={onClose} style={btn("rgba(255,255,255,.14)", "#fff")}>✕ إغلاق</button>
      </div>
      <div style={{ background: state === "ready" ? "#e8f8ee" : "#fdf6e3", color: state === "ready" ? "#1a5c2e" : "#8a6a20", fontSize: 11.5, padding: "6px 14px", textAlign: "center" }}>
        {hint}
      </div>

      {/* المستند */}
      <div style={{ flex: 1, overflowY: "auto", padding: "18px 10px" }}>
        <div ref={sheetRef} className="nk-pdf-sheet" dir="rtl" style={{ maxWidth: 780, margin: "0 auto", background: "#fff", padding: "26px 30px", borderRadius: 6, boxShadow: "0 8px 30px rgba(0,0,0,.35)", fontFamily: "'Tajawal',sans-serif", color: "#1a1a18" }}>
          {/* الترويسة */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `2.5px solid ${D.gold}`, paddingBottom: 12, marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
              {s.logo ? <img src={s.logo} alt="" style={{ width: 54, height: 54, borderRadius: 12, objectFit: "cover" }} /> : <Crest size={54} />}
              <div>
                <div style={{ fontSize: 18, fontWeight: 900, color: D.grn }}>{s.clubName || "نادي النخيل"}</div>
                <div style={{ fontSize: 10.5, color: D.mt, marginTop: 2 }}>{s.clubSub || "النادي الرياضي الترفيهي"}</div>
              </div>
            </div>
            <div style={{ textAlign: "left", fontSize: 10.5, color: D.mt, lineHeight: 1.8 }}>
              {s.address || "مصراتة، ليبيا"}<br />هاتف: {s.phone || ""}<br />التاريخ: {new Date().toLocaleDateString("ar-LY")}
            </div>
          </div>

          <div style={{ textAlign: "center", margin: "4px 0 12px" }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: D.grn, borderBottom: `1.5px dashed ${D.gold}`, paddingBottom: 3 }}>{cfg.title}</span>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, background: D.crm, border: "0.5px solid rgba(201,168,76,.35)", borderRadius: 10, padding: "9px 13px", marginBottom: 12, fontSize: 11.5 }}>
            <span>{cfg.recipientLabel || "إلى"}: <b style={{ color: D.grn }}>{cfg.recipientName || "—"}</b></span>
            {cfg.recipientPhone && <span>الهاتف: <b style={{ color: D.grn }}>{cfg.recipientPhone}</b></span>}
            <span>رقم المستند: <b style={{ color: D.grn }}>{docNo}</b></span>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 12 }}>
            <thead><tr>{cfg.columns.map((c, i) => <th key={i} style={th}>{c}</th>)}</tr></thead>
            <tbody>{cfg.rows.map((r, ri) => (
              <tr key={ri} style={{ background: ri % 2 ? D.crm : "#fff" }}>{r.map((cell, ci) => <td key={ci} style={td}>{cell}</td>)}</tr>
            ))}</tbody>
          </table>

          {cfg.totals && cfg.totals.length > 0 && (
            <div style={{ display: "flex", marginBottom: 12 }}>
              <div style={{ minWidth: 250, border: "1px solid rgba(201,168,76,.5)", borderRadius: 10, overflow: "hidden" }}>
                {cfg.totals.map((t, i) => {
                  const last = i === cfg.totals.length - 1;
                  return (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "7px 13px", fontSize: last ? 13 : 12, borderBottom: last ? "none" : "0.5px solid rgba(201,168,76,.25)", background: last ? D.grn : "transparent", color: last ? D.gld : "#1a1a18", fontWeight: last ? 700 : 500 }}>
                      <span>{t[0]}</span><span>{t[1]}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {cfg.note && <div style={{ background: "#fdf6e3", border: `0.5px dashed ${D.gold}`, borderRadius: 9, padding: "8px 12px", fontSize: 11, color: "#8a6a20", marginBottom: 12 }}>📌 {cfg.note}</div>}

          <div style={{ marginTop: 24, display: "flex", justifyContent: "space-between", fontSize: 10.5, color: D.mt }}>
            <div style={{ width: 150, borderTop: "1px dashed #aaa", textAlign: "center", paddingTop: 4 }}>توقيع المستلم</div>
            <div style={{ width: 150, borderTop: "1px dashed #aaa", textAlign: "center", paddingTop: 4 }}>الختم / الإدارة</div>
          </div>
          <div style={{ textAlign: "center", fontSize: 10, color: D.mt, borderTop: "1px solid rgba(201,168,76,.4)", paddingTop: 8, marginTop: 10 }}>
            {s.invoiceFooter || "شكراً لتعاملكم — " + (s.clubName || "نادي النخيل")} — مستند مُولّد آلياً
          </div>
        </div>
      </div>
    </div>
  );
}
