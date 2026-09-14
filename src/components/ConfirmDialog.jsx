import { useEffect, useRef } from "react";
import { C } from "../constants/theme.js";
import { Btn, useModalFocus } from "./ui.jsx";

/* ---- Custom confirm dialog (replaces window.confirm — friendlier on tablets, can't be mass-dismissed by accident) ---- */
export default function ConfirmDialog({ message, danger, onConfirm, onCancel }) {
  const dialogRef = useRef(null);
  useModalFocus(dialogRef);

  // Escape للإلغاء — نفس السلوك المتوقَّع في Modal، وهذه النافذة تُستخدم لكل
  // عملية خطرة في النظام (حذف، تراجع، تصفير) فغيابه هنا كان فجوة أوسع أثراً
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onCancel(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div onClick={(e) => e.target === e.currentTarget && onCancel()} style={{ position: "fixed", inset: 0, background: "rgba(10,30,15,.55)", backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)", zIndex: 800, display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
      <div ref={dialogRef} tabIndex={-1} role="alertdialog" aria-modal="true" className="nk-modal-in" style={{ background: C.cd, borderRadius: 16, padding: "1.4rem 1.5rem", width: 400, maxWidth: "96vw", boxShadow: "0 24px 60px rgba(0,0,0,.35)", textAlign: "center", outline: "none" }}>
        <div style={{ fontSize: 30, marginBottom: 8 }}>{danger ? "⚠️" : "❔"}</div>
        <div style={{ fontSize: 13.5, color: C.k2, lineHeight: 1.9, marginBottom: 18, whiteSpace: "pre-line" }}>{message}</div>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn danger={danger} gold={!danger} onClick={onConfirm} style={{ flex: 1, justifyContent: "center" }}>✓ تأكيد</Btn>
          <Btn onClick={onCancel} style={{ flex: 1, justifyContent: "center" }}>إلغاء</Btn>
        </div>
      </div>
    </div>
  );
}
