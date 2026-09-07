import { useState } from "react";
import { C, fmt } from "../constants/theme.js";
import { Modal, Field, Inp, Btn } from "./ui.jsx";
import { BarcodeSVG } from "./barcode.jsx";

/* ---- طباعة ملصقات باركود (Code128 حقيقي قابل للمسح) لمنتج واحد ---- */
export default function LabelPrint({ product, cur, onClose }) {
  const [qty, setQty] = useState(12);
  const n = Math.min(200, Math.max(1, parseInt(qty) || 1));

  const printLabels = () => {
    document.body.classList.add("nk-printing-labels");
    const done = () => { document.body.classList.remove("nk-printing-labels"); window.removeEventListener("afterprint", done); };
    window.addEventListener("afterprint", done);
    setTimeout(done, 3000);
    window.print();
  };

  return (
    <Modal title={`طباعة ملصقات — ${product.name}`} onClose={onClose} width={420}>
      <Field label="عدد الملصقات"><Inp type="number" min="1" max="200" value={qty} onChange={e => setQty(e.target.value)} /></Field>
      <div style={{ background: C.crm, borderRadius: 9, padding: ".7rem", margin: ".6rem 0 1rem", textAlign: "center" }}>
        <BarcodeSVG code={product.bc} />
        <div style={{ fontSize: 11.5, color: C.k2, marginTop: 6, fontWeight: 600 }}>{product.name}{product.sell ? ` — ${fmt(product.sell)} ${cur}` : ""}</div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <Btn gold onClick={printLabels} style={{ flex: 1, justifyContent: "center" }}>🖨 طباعة {n} ملصقاً</Btn>
        <Btn onClick={onClose}>إغلاق</Btn>
      </div>

      {/* ورقة الطباعة الفعلية — مخفية على الشاشة، تظهر فقط عند الطباعة */}
      <div className="nk-label-sheet" style={{ display: "none" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "3mm", padding: "4mm" }}>
          {Array.from({ length: n }, (_, i) => (
            <div key={i} style={{ width: "45mm", border: "0.5px dashed #999", borderRadius: 4, padding: "2mm", textAlign: "center", pageBreakInside: "avoid" }}>
              <BarcodeSVG code={product.bc} height={30} />
              <div style={{ fontSize: 9, marginTop: 2, fontWeight: 700 }}>{product.name}</div>
              {product.sell > 0 && <div style={{ fontSize: 9.5, fontWeight: 700 }}>{fmt(product.sell)} {cur}</div>}
            </div>
          ))}
        </div>
      </div>
      <style>{`@media print { .nk-label-sheet { display: block !important; } }`}</style>
    </Modal>
  );
}
