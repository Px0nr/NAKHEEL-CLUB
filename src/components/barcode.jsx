import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

export function genBarcode(products) {
  const year = new Date().getFullYear();
  return "NKH" + year + String(products.length + 1).padStart(4, "0");
}

// باركود Code128 حقيقي قابل للمسح فعلياً بأي قارئ (وليس رسماً شكلياً)
export function BarcodeSVG({ code, height = 34 }) {
  const svgRef = useRef(null);
  useEffect(() => {
    if (!code || !svgRef.current) return;
    try {
      JsBarcode(svgRef.current, code, {
        format: "CODE128", background: "#111", lineColor: "#fff",
        width: 1.6, height: height - 12, fontSize: 11, fontOptions: "600",
        textMargin: 3, margin: 6, font: "monospace",
      });
    } catch { /* كود غير صالح لـ Code128 — يُترك فارغاً */ }
  }, [code, height]);
  if (!code) return null;
  return (
    <div style={{ background: "#111", borderRadius: 7, padding: ".3rem .5rem", textAlign: "center" }}>
      <svg ref={svgRef} style={{ width: "100%", height }} />
    </div>
  );
}
