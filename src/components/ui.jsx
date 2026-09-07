import { useState, useEffect, useRef } from "react";
import { C, T } from "../constants/theme.js";
import { motionEnabled } from "../utils/motionPrefs.js";

/* ---------- small UI atoms ---------- */
export const Badge = ({ tone = "g", children, style }) => {
  const map = {
    g: { bg: "#e1f4e8", c: "#1a5c2e" }, a: { bg: "#fef3d9", c: "#8a6a20" },
    r: { bg: C.redbg, c: "#922" }, b: { bg: C.bluebg, c: C.blue },
    gold: { bg: "rgba(201,168,76,.16)", c: C.gdd }, p: { bg: C.purpbg, c: C.purp },
  };
  const t = map[tone] || map.g;
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 7px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: t.bg, color: t.c, whiteSpace: "nowrap", ...style }}>{children}</span>;
};

export const Crest = ({ size = 46 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" style={{ flexShrink: 0, filter: "drop-shadow(0 2px 4px rgba(0,0,0,.3))" }}>
    <defs><linearGradient id="ngg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f0d080" /><stop offset="1" stopColor="#b8923c" /></linearGradient></defs>
    <path d="M50 6L88 22V52C88 74 70 90 50 96C30 90 12 74 12 52V22L50 6Z" fill="#1a5c2e" stroke="url(#ngg)" strokeWidth="2.5" />
    <path d="M50 32C50 32 50 46 44 52C40 56 36 56 36 56C36 56 40 56 43 60C46 64 46 72 50 72C54 72 54 64 57 60C60 56 64 56 64 56C64 56 60 56 56 52C50 46 50 32 50 32Z" fill="url(#ngg)" />
  </svg>
);

/* ---------- HUB ICONS (SVG) ----------
   أيقونات خطية موحّدة لمراكز العمل الثمانية في الشريط الجانبي — بديل احترافي
   عن الإيموجي الذي يظهر بأشكال متفاوتة بين ويندوز/أندرويد/iOS. تستخدم
   currentColor فتتلوّن تلقائياً حسب الثيم النشط ولون التبويب (نشط/غير نشط). */
export const HubIconPaths = {
  today:    "M4 10.5 12 4l8 6.5V19a1 1 0 01-1 1h-4v-6H9v6H5a1 1 0 01-1-1z",
  cart:     "M3 4h2l1.6 10.2A2 2 0 008.56 16H17a2 2 0 001.96-1.6L20.4 8H6.2 M9 20a1 1 0 100-2 1 1 0 000 2zM17 20a1 1 0 100-2 1 1 0 000 2z",
  calendar: "M4 5.5h16A1 1 0 0121 6.5V19a1 1 0 01-1 1H4a1 1 0 01-1-1V6.5a1 1 0 011-1zM3 10h18M8 3v4M16 3v4",
  box:      "M3.5 8 12 4l8.5 4v8L12 20l-8.5-4zM3.5 8 12 12l8.5-4M12 12v8",
  users:    "M9 12a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM3.5 20c.7-3.2 3-5 5.5-5s4.8 1.8 5.5 5M16.5 8.5a2.75 2.75 0 110-5.5M16 12.2c1.9.4 3.4 1.9 4 4.3",
  wallet:   "M4 7.5h14a2 2 0 012 2V17a2 2 0 01-2 2H4a2 2 0 01-2-2V9.5a2 2 0 012-2zM2 8l11-4.5L17 6M16.5 13.2a1.3 1.3 0 100-2.6 1.3 1.3 0 000 2.6z",
  chart:    "M4 20V10M10 20V4M16 20v-7M4 20h16",
  gear:     "M12 15.2a3.2 3.2 0 100-6.4 3.2 3.2 0 000 6.4zM12 3.5v2.2M12 18.3v2.2M5.4 6.4l1.55 1.55M17.05 16.05l1.55 1.55M3.5 12h2.2M18.3 12h2.2M5.4 17.6l1.55-1.55M17.05 7.95l1.55-1.55",
};
export const HubIcon = ({ id, size = 18, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...rest}>
    <path d={HubIconPaths[id] || HubIconPaths.today} />
  </svg>
);

export function PageTop({ title, action }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.1rem", flexWrap: "wrap", gap: 8 }}>
      <div style={{ fontSize: 18, fontWeight: 700 }}>{title}</div>
      <div style={{ display: "flex", gap: 7 }}>{action}</div>
    </div>
  );
}
export const Card = ({ children, style, className }) => (
  <div className={"nk-theme-transition" + (className ? " " + className : "")} style={{ background: C.cd, border: `0.5px solid ${C.bc}`, borderRadius: 13, padding: ".95rem 1.05rem", boxShadow: "0 1px 2px rgba(20,67,31,.03)", ...style }}>{children}</div>
);
export const CardHead = ({ title, sub, right }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: ".85rem", flexWrap: "wrap", gap: 6 }}>
    <div><div style={{ fontSize: 13, fontWeight: 700 }}>{title}</div>{sub && <div style={{ fontSize: 11, color: C.mt }}>{sub}</div>}</div>
    {right}
  </div>
);
export const Btn = ({ children, onClick, gold, danger, sm, style, ...rest }) => (
  <button onClick={onClick} style={{
    display: "inline-flex", alignItems: "center", gap: 5, padding: sm ? ".2rem .58rem" : ".36rem .82rem",
    borderRadius: 8, fontSize: sm ? 11.5 : 12.5, cursor: "pointer", fontFamily: "inherit", fontWeight: 500,
    border: `1px solid ${danger ? "rgba(192,57,43,.3)" : C.bc}`,
    background: gold ? "linear-gradient(135deg,#c9a84c,#b8923c)" : C.cd,
    color: gold ? "#fff" : danger ? C.red : C.ink, ...style,
  }} {...rest}>{children}</button>
);
export const KCard = ({ label, value, sub, bar = C.gold, delta }) => (
  <div className="nk-kcard" style={{ background: C.cd, border: `0.5px solid ${C.bc}`, borderRadius: 13, padding: ".85rem 1rem", position: "relative", overflow: "hidden", boxShadow: "0 1px 2px rgba(20,67,31,.04)" }}>
    <div className="nk-kcard-bar" style={{ position: "absolute", top: 0, right: 0, width: 4, height: "100%", background: bar }} />
    <div style={{ fontSize: T.font.xs, color: C.mt, marginBottom: ".18rem", fontWeight: 500 }}>{label}</div>
    <div style={{ fontSize: T.font.num, fontWeight: 700, lineHeight: 1 }}>{value}</div>
    {sub && <div style={{ fontSize: T.font.xs - 1, color: C.mt, marginTop: 2 }}>{sub}</div>}
    {delta && <div style={{ fontSize: 11, marginTop: ".28rem", fontWeight: 500, color: delta.up ? "#1a8c3e" : C.red }}>{delta.up ? "▲" : "▼"} {delta.text}</div>}
  </div>
);
export const Field = ({ label, children, full }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: ".75rem", gridColumn: full ? "1/-1" : "auto" }}>
    <label style={{ fontSize: 11, color: C.mt, fontWeight: 600 }}>{label}</label>{children}
  </div>
);
export const inputStyle = { fontSize: 12.5, border: `0.5px solid ${C.bc}`, borderRadius: 8, padding: ".4rem .7rem", background: C.crm, color: C.ink, outline: "none", fontFamily: "inherit", width: "100%" };
export const Inp = (p) => <input {...p} style={{ ...inputStyle, ...(p.style || {}) }} />;
export const Sel = (p) => <select {...p} style={{ ...inputStyle, ...(p.style || {}) }}>{p.children}</select>;

/* مدة حركة الخروج — يجب أن تطابق .nk-modal-out في App.jsx.
   لا تُقاس عبر حدث animationend لأن الحركة قد تكون معطّلة (بمفتاح الإعدادات أو
   بتفضيل تقليل الحركة) فلا يُطلَق الحدث أبداً وتبقى النافذة مفتوحة للأبد. */
const MODAL_EXIT_MS = 170;

export function Modal({ title, onClose, children, width = 540 }) {
  const [closing, setClosing] = useState(false);
  const timerRef = useRef(null);

  // الإغلاق يؤجَّل ريثما تنتهي حركة الخروج، ثم يُبلَّغ الأب فيُزيل النافذة.
  // عند تعطيل الحركة يُغلق فوراً بلا تأخير مصطنع.
  const close = () => {
    if (closing) return;
    if (!motionEnabled()) { onClose(); return; }
    setClosing(true);
    timerRef.current = setTimeout(onClose, MODAL_EXIT_MS);
  };

  useEffect(() => () => clearTimeout(timerRef.current), []);

  // Escape للإغلاق — سلوك متوقَّع في أي نافذة، ولم يكن مدعوماً
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  return (
    <div onClick={(e) => e.target === e.currentTarget && close()}
      className={closing ? "nk-backdrop-out" : undefined}
      style={{ position: "fixed", inset: 0, background: "rgba(10,30,15,.5)", backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
      <div className={closing ? "nk-modal-out" : "nk-modal-in"} role="dialog" aria-modal="true"
        style={{ background: C.cd, borderRadius: 16, padding: "1.4rem 1.5rem", width, maxWidth: "96vw", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 24px 60px rgba(0,0,0,.35)" }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: "1.1rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {title}<button onClick={close} aria-label="إغلاق" style={{ cursor: "pointer", color: C.mt, fontSize: 18, background: "none", border: "none", fontFamily: "inherit" }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
export const Table = ({ cols, rows }) => (
  <div className="nk-tbl-wrap">
    <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
      <thead><tr>{cols.map((c, i) => <th key={i} style={{ width: c.w, textAlign: "right", padding: ".42rem .5rem", color: C.mt, fontWeight: 600, borderBottom: `1px solid ${C.bc}`, fontSize: 11 }}>{c.h}</th>)}</tr></thead>
      <tbody>{rows.map((r, ri) => (
        <tr key={ri} className="nk-row-in" style={{ animationDelay: ri < 20 ? `${ri * 22}ms` : "0ms" }}>{r.map((cell, ci) => <td key={ci} style={{ padding: ".48rem .5rem", borderBottom: `0.5px solid rgba(201,168,76,.09)`, color: C.k2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cell}</td>)}</tr>
      ))}</tbody>
    </table>
  </div>
);
