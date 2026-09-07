import { useState, useEffect, useMemo, useRef } from "react";
import { C, T, fmt } from "../constants/theme.js";

/* ============================ COMMAND PALETTE (البحث الشامل) ============================ */
export default function CommandPalette({ open, onClose, products, customers, invoices, hubs, goPage, setSearchIntent, currency }) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => { if (open) { setQ(""); setActive(0); setTimeout(() => inputRef.current?.focus(), 30); } }, [open]);

  // فهرس الأوامر الثابتة: أي تبويب في أي مركز عمل يمكن الوصول إليه مباشرة بالاسم
  const pageCommands = useMemo(() =>
    hubs.flatMap(h => h.tabs.map(t => ({ kind: "page", id: t.id, label: t.label, sub: h.label, icon: t.icon || "▸" }))),
    [hubs]);

  const results = useMemo(() => {
    const term = q.trim();
    if (!term) return pageCommands.slice(0, 8);
    const out = [];
    // 1) أوامر التنقل
    pageCommands.filter(c => c.label.includes(term)).forEach(c => out.push(c));
    // 2) الزبائن (بالاسم أو الهاتف)
    (customers || []).filter(c => c.name.includes(term) || (c.phone || "").includes(term)).slice(0, 5)
      .forEach(c => out.push({ kind: "customer", id: c.id, label: c.name, sub: `${c.phone || "—"} ${c.debt > 0 ? `· دين ${fmt(c.debt)} ${currency}` : ""}`, icon: "👤" }));
    // 3) المنتجات (بالاسم أو الباركود)
    (products || []).filter(p => p.name.includes(term) || (p.bc || "").includes(term) || (p.barcodes || []).some(b => b.includes(term))).slice(0, 5)
      .forEach(p => out.push({ kind: "product", id: p.id, label: p.name, sub: `${p.bc || "بلا باركود"} · ${fmt(p.sell)} ${currency}`, icon: "📦" }));
    // 4) الفواتير (برقم الفاتورة)
    (invoices || []).filter(i => i.id.includes(term)).slice(0, 5)
      .forEach(i => out.push({ kind: "invoice", id: i.id, label: `فاتورة ${i.id}`, sub: `${i.customer} · ${fmt(i.total)} ${currency}`, icon: "🧾" }));
    return out.slice(0, 12);
  }, [q, pageCommands, customers, products, invoices, currency]);

  const choose = (r) => {
    if (!r) return;
    if (r.kind === "page") goPage(r.id);
    else if (r.kind === "customer") { setSearchIntent({ type: "customer", query: r.label, id: r.id }); goPage("customers"); }
    else if (r.kind === "product") { setSearchIntent({ type: "product", query: r.label, id: r.id }); goPage("products"); }
    else if (r.kind === "invoice") { setSearchIntent({ type: "invoice", query: r.id, id: r.id }); goPage("sales"); }
    onClose();
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive(a => Math.min(a + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); choose(results[active]); }
  };

  if (!open) return null;
  return (
    <div onClick={(e) => e.target === e.currentTarget && onClose()} style={{ position: "fixed", inset: 0, background: "rgba(10,30,15,.45)", backdropFilter: "blur(2px)", zIndex: 700, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "12vh" }}>
      <div className="nk-modal-in" style={{ width: 560, maxWidth: "92vw", background: C.cd, borderRadius: 16, boxShadow: "0 24px 70px rgba(0,0,0,.4)", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0.9rem 1.1rem", borderBottom: `1px solid ${C.bc}` }}>
          <span style={{ fontSize: 17, color: C.mt }}>🔎</span>
          <input ref={inputRef} value={q} onChange={(e) => { setQ(e.target.value); setActive(0); }} onKeyDown={onKeyDown}
            placeholder="ابحث عن زبون، منتج، فاتورة، أو صفحة..."
            style={{ flex: 1, border: "none", outline: "none", fontSize: T.font.lg, fontFamily: "inherit", background: "transparent", color: C.ink }} />
          <kbd style={{ fontSize: 10, color: C.mt, background: C.crm, border: `1px solid ${C.bc}`, borderRadius: 6, padding: "2px 6px" }}>Esc</kbd>
        </div>
        <div style={{ maxHeight: "55vh", overflowY: "auto", padding: 6 }}>
          {results.length === 0 && <div style={{ textAlign: "center", color: C.mt, fontSize: 13, padding: "2rem 0" }}>لا نتائج مطابقة</div>}
          {results.map((r, i) => (
            <div key={`${r.kind}-${r.id}`} onClick={() => choose(r)} onMouseEnter={() => setActive(i)}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: ".62rem .8rem", borderRadius: 10, cursor: "pointer",
                background: i === active ? C.gold + "1c" : "transparent" }}>
              <span style={{ fontSize: 16, width: 22, textAlign: "center", flexShrink: 0 }}>{r.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: T.font.sm, fontWeight: 600, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.label}</div>
                {r.sub && <div style={{ fontSize: T.font.xs, color: C.mt, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.sub}</div>}
              </div>
              {r.kind === "page" && <span style={{ fontSize: 10, color: C.mt }}>صفحة</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
