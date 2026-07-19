import { useState, useRef } from "react";
import { C, fmt } from "../constants/theme.js";
import { CATS } from "../constants/seeds.js";
import { PageTop, Card, Badge, Btn, Sel, Inp, inputStyle } from "../components/ui.jsx";
import NewCustomerModal from "../components/NewCustomerModal.jsx";
import { todayISO, matchesBarcode, matchesBarcodePartial } from "../utils/format.js";
import { promoFor } from "../utils/promos.js";

const qbtn = { width: 22, height: 22, borderRadius: 6, border: `0.5px solid ${C.bc}`, background: C.crm, cursor: "pointer", fontSize: 13, fontFamily: "inherit" };
const posUnitBtn = (primary) => ({ flex: 1, padding: ".28rem .3rem", borderRadius: 6, fontSize: 10.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", border: `1px solid ${primary ? C.gold : C.bc}`, background: primary ? C.gold + "18" : C.crm, color: primary ? C.gdd : C.k2, whiteSpace: "nowrap" });
const Row = ({ label, val, color }) => <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: color || C.k2, marginBottom: ".4rem" }}><span>{label}</span><span>{val}</span></div>;

/* ============================ POS ============================ */
export default function POS({ ctx, can }) {
  const { products, setProducts, invoices, setInvoices, coupons, customers, setCustomers, employees, promotions, user, showToast, settings } = ctx;
  const cur = settings?.currency || "د.ل";
  const [cart, setCart] = useState({});
  const [pay, setPay] = useState("cash");
  const [coupon, setCoupon] = useState("");
  const [discPct, setDiscPct] = useState(0);
  const [catFilter, setCatFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [bcInput, setBcInput] = useState("");
  const bcRef = useRef(null);
  const [deferCustomer, setDeferCustomer] = useState(null);
  const [custModal, setCustModal] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [pointsCustomer, setPointsCustomer] = useState(null);
  const [redeemPoints, setRedeemPoints] = useState(false);
  const [deferEmployee, setDeferEmployee] = useState(null);

  const PAY_LABEL = { cash: "كاش", card: "بطاقة", transfer: "تحويل", defer: "آجل", employee: "موظف" };
  const shown = products.filter(p =>
    (catFilter === "all" || p.cat === catFilter) &&
    (search === "" || p.name.includes(search) || matchesBarcodePartial(p, search))
  );

  // إضافة صنف عبر الباركود (Enter أو قارئ باركود) — يطابق الباركود الأساسي أو أياً من الباركودات الإضافية لنفس المنتج
  const addByBarcode = () => {
    const code = bcInput.trim();
    if (!code) return;
    const p = products.find(x => matchesBarcode(x, code)) || products.find(x => matchesBarcodePartial(x, code));
    if (!p) { showToast(`لا يوجد صنف بالباركود «${code}»`); setBcInput(""); return; }
    add(p, "piece");
    setBcInput("");
    bcRef.current?.focus();
  };
  // piecesInCartFor: total pieces already reserved for a product across piece+pack lines
  const piecesReserved = (pid) => Object.values(cart).filter(it => it.pid === pid).reduce((s, it) => s + it.qty * it.perPieces, 0);
  const add = (p, sellUnit = "piece") => {
    if (!p.sell) { showToast(`«${p.name}» غير مُسعّر بعد — يُسعّر عند التوريد`); return; }
    const pack = p.packSize || 1;
    const perPieces = sellUnit === "pack" ? pack : 1;
    const key = p.id + ":" + sellUnit;
    const already = piecesReserved(p.id);
    if (p.stock !== null && p.stock < already + perPieces) { showToast(`لا يوجد مخزون كافٍ من «${p.name}»`); return; }
    const promo = promoFor(promotions, p.cat);
    const factor = promo ? 1 - promo.pct / 100 : 1;
    const baseUnitPrice = sellUnit === "pack" ? (p.sellPack || p.sell * pack) : p.sell;
    const unitPrice = Math.round(baseUnitPrice * factor * 100) / 100;
    const unitLabel = sellUnit === "pack" ? p.unit : "قطعة";
    setCart(c => ({ ...c, [key]: { key, pid: p.id, cat: p.cat, name: p.name, img: p.img, sell: p.sell, unitPrice, perPieces, sellUnit, unitLabel, promoPct: promo ? promo.pct : 0, qty: (c[key]?.qty || 0) + 1 } }));
  };
  const chg = (key, d) => setCart(c => {
    const q = (c[key]?.qty || 0) + d;
    const nc = { ...c };
    if (q <= 0) delete nc[key]; else nc[key] = { ...nc[key], qty: q };
    return nc;
  });
  const items = Object.values(cart);
  const isEmployeeSale = pay === "employee";
  const freeDepts = settings?.freeDeptsForEmployees || [];
  const isFreeItem = (it) => isEmployeeSale && freeDepts.includes(it.cat);
  const sub = items.reduce((s, i) => s + (isFreeItem(i) ? 0 : i.unitPrice * i.qty), 0);
  const freeValue = items.reduce((s, i) => s + (isFreeItem(i) ? i.unitPrice * i.qty : 0), 0);
  const disc = Math.round(sub * discPct / 100);
  const custForPoints = pay === "defer" ? deferCustomer : (pay === "employee" ? null : pointsCustomer);
  const redeemBlocks = (settings?.loyaltyOn && redeemPoints && custForPoints) ? Math.floor((custForPoints.points || 0) / 100) : 0;
  const pointsDiscount = Math.min(redeemBlocks * (settings?.pointsRedeemValue || 0), Math.max(0, sub - disc));
  const total = Math.max(0, sub - disc - pointsDiscount);

  const applyCoupon = () => {
    const c = coupons.find(x => x.code === coupon.trim().toUpperCase() && x.status === "نشط");
    if (c) { setDiscPct(c.pct); showToast(`كوبون ${c.code} مفعّل — خصم ${c.pct}%`); }
    else { setDiscPct(0); showToast("كود الخصم غير صحيح"); }
  };

  const checkout = () => {
    if (!items.length) return;
    const num = "INV-" + (1048 + invoices.filter(i => i.id.startsWith("INV-1")).length);
    const details = items.map(i => `${i.name} ×${i.qty} ${i.sellUnit === "pack" ? i.unitLabel : ""}`.trim()).join("، ");
    let custName = "زبون نقدي";

    if (pay === "defer") {
      if (!deferCustomer) { showToast("اختر زبوناً أو سجّل زبوناً جديداً للبيع الآجل"); return; }
      custName = deferCustomer.name;
      setCustomers(cs => cs.map(c => c.id === deferCustomer.id
        ? { ...c, debt: (c.debt || 0) + total, total: c.total + total, invoices: c.invoices + 1, last: todayISO() }
        : c));
    } else if (pay === "employee") {
      if (!deferEmployee) { showToast("اختر الموظف الذي يشتري"); return; }
      custName = deferEmployee.name;
    } else if (custForPoints) {
      custName = custForPoints.name;
    }

    // نقاط الولاء: استبدال (إن اختير) ثم اكتساب نقاط جديدة على قيمة البيع النهائية
    if (settings?.loyaltyOn && custForPoints) {
      const earned = Math.floor(total / (settings.pointsPerCurrency || 10));
      const redeemed = redeemBlocks * 100;
      setCustomers(cs => cs.map(c => c.id === custForPoints.id ? { ...c, points: Math.max(0, (c.points || 0) - redeemed + earned) } : c));
    }

    // decrement stock in pieces (sum piece+pack lines per product)
    setProducts(ps => ps.map(p => {
      const pieces = items.filter(it => it.pid === p.id).reduce((s, it) => s + it.qty * it.perPieces, 0);
      if (pieces && p.stock !== null) return { ...p, stock: Math.max(0, p.stock - pieces) };
      return p;
    }));
    // تكلفة البضاعة المباعة (COGS) = مجموع (سعر شراء القطعة × عدد القطع)
    const cost = items.reduce((s, it) => {
      const p = products.find(x => x.id === it.pid);
      return s + (p?.buy || 0) * it.qty * it.perPieces;
    }, 0);
    setInvoices(iv => [{ id: num, customer: custName, date: todayISO(), source: "منتج", details, items: items.map(it => ({ pid: it.pid, cat: it.cat, name: it.name, qty: it.qty, lineTotal: isFreeItem(it) ? 0 : Math.round(it.unitPrice * it.qty * 100) / 100, free: isFreeItem(it) || undefined })), pay: PAY_LABEL[pay], discount: [discPct ? discPct + "%" : "", pointsDiscount ? `نقاط -${fmt(pointsDiscount)}` : "", freeValue > 0 ? `مزايا مجانية -${fmt(freeValue)}` : ""].filter(Boolean).join(" + ") || "—", total, cost: Math.round(cost * 100) / 100, status: pay === "defer" ? "معلقة" : "مدفوعة", by: user?.name || "—", time: new Date().toTimeString().slice(0, 5), ...(pay === "defer" ? { dueDate: dueDate || todayISO() } : {}), ...(pay === "employee" ? { empId: deferEmployee.id } : {}) }, ...iv]);
    showToast(pay === "defer" ? `فاتورة آجلة #${num} على ${custName} — ${fmt(total)} ${ctx.settings?.currency || "د.ل"}` : pay === "employee" ? `فاتورة موظف #${num} على ${custName} — ${fmt(total)} ${cur}${freeValue > 0 ? ` (مزايا مجانية ${fmt(freeValue)} ${cur})` : ""}` : `تم إنشاء الفاتورة #${num} — ${fmt(total)} ${ctx.settings?.currency || "د.ل"}`);
    setCart({}); setDiscPct(0); setCoupon(""); setDeferCustomer(null); setDueDate(""); setPointsCustomer(null); setRedeemPoints(false); setDeferEmployee(null);
  };

  const CAT_ICON = { games: "🎮", cafe: "☕" };
  const mode = ctx.settings?.posMode || "grid";
  return (
    <>
      <PageTop title="نقطة البيع السريع" />
      <div style={{ display: "grid", gridTemplateColumns: ctx.scr?.isTab ? "1fr" : "1fr 360px", gap: 14, alignItems: "start" }}>
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: ".7rem", flexWrap: "wrap" }}>
            <div style={{ flex: 1.2, minWidth: 170, display: "flex", alignItems: "center", gap: 6, background: C.cd, border: `0.5px solid ${C.bc}`, borderRadius: 10, padding: ".42rem .75rem" }}>
              <span style={{ color: C.mt, fontSize: 14 }}>🔍</span>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث عن صنف بالاسم..." style={{ border: "none", outline: "none", background: "transparent", fontSize: 12.5, width: "100%", fontFamily: "inherit", color: C.ink }} />
              {search && <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: C.mt, fontSize: 13 }}>✕</button>}
            </div>
            <div style={{ flex: 1, minWidth: 190, display: "flex", alignItems: "center", gap: 6, background: C.grn, borderRadius: 10, padding: ".42rem .75rem", border: `1px solid ${C.gold}55` }}>
              <span style={{ fontSize: 14 }}>📷</span>
              <input ref={bcRef} value={bcInput} onChange={e => setBcInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addByBarcode()}
                placeholder="امسح الباركود أو اكتبه ثم Enter"
                style={{ border: "none", outline: "none", background: "transparent", fontSize: 12.5, width: "100%", fontFamily: "inherit", color: C.gld, letterSpacing: 1 }} />
              <button onClick={addByBarcode} style={{ background: C.gold, border: "none", borderRadius: 6, color: "#fff", fontSize: 11, fontWeight: 700, padding: "3px 10px", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>إضافة</button>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, marginBottom: ".9rem", flexWrap: "wrap" }}>
            {[["all", "الكل"], ...Object.entries(ctx.cats || CATS)].map(([k, l]) => (
              <button key={k} onClick={() => setCatFilter(k)} style={{ padding: ".3rem .8rem", borderRadius: 20, fontSize: 12, cursor: "pointer", fontFamily: "inherit", border: `0.5px solid ${C.bc}`, background: catFilter === k ? C.grn : C.crm, color: catFilter === k ? C.gld : C.k2, fontWeight: catFilter === k ? 600 : 400 }}>{l}</button>
            ))}
          </div>

          {shown.length === 0 && (
            <div style={{ textAlign: "center", padding: "2rem 1rem", color: C.mt, fontSize: 12.5, background: C.cd, borderRadius: 11, border: `0.5px dashed ${C.bc}` }}>لا توجد أصناف مطابقة{search ? ` لـ«${search}»` : ""}.</div>
          )}
          {mode === "grid" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(130px,1fr))", gap: 10 }}>
              {shown.map(p => {
                const promo = promoFor(promotions, p.cat);
                const dSell = promo && p.sell ? Math.round(p.sell * (1 - promo.pct / 100) * 100) / 100 : null;
                return (
                <div key={p.id} className="nk-card-hover" style={{ background: C.cd, border: `0.5px solid ${promo ? "#1a8c3e55" : C.bc}`, borderRadius: 11, padding: ".8rem .75rem", textAlign: "center", position: "relative" }}>
                  {promo && p.sell ? <span style={{ position: "absolute", top: 6, left: 6, background: "#1a8c3e", color: "#fff", fontSize: 9.5, fontWeight: 700, borderRadius: 6, padding: "1px 6px" }}>-{promo.pct}%</span> : null}
                  <div onClick={() => add(p, "piece")} style={{ cursor: "pointer" }}>
                    <div style={{ width: 46, height: 46, borderRadius: 12, margin: "0 auto .5rem", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, background: p.cat === "games" ? C.grl + "22" : C.gold + "22", overflow: "hidden" }}>{p.img ? <img src={p.img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : CAT_ICON[p.cat]}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>{p.name}</div>
                    {dSell !== null
                      ? <div style={{ fontSize: 13, fontWeight: 700 }}><span style={{ color: C.mt, textDecoration: "line-through", fontSize: 10.5, marginLeft: 4 }}>{p.sell}</span><span style={{ color: "#1a8c3e" }}>{dSell} {cur}</span></div>
                      : <div style={{ fontSize: 13, fontWeight: 700, color: C.grn2 }}>{p.sell ? `${p.sell} ${cur}` : "غير مُسعّر"}</div>}
                    <div style={{ fontSize: 10, color: C.mt, marginTop: 2 }}>{p.stock !== null ? `مخزون: ${p.stock} قطعة` : "خدمة"}</div>
                  </div>
                  {p.packSize > 1 && p.sell ? (
                    <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                      <button onClick={() => add(p, "piece")} style={posUnitBtn(false)}>قطعة</button>
                      <button onClick={() => add(p, "pack")} style={posUnitBtn(true)}>{p.unit} — {fmt(Math.round((p.sellPack || p.sell * p.packSize) * (promo ? 1 - promo.pct / 100 : 1) * 100) / 100)}</button>
                    </div>
                  ) : null}
                </div>
                );
              })}
            </div>
          )}
          {mode === "list" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {shown.map(p => (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, background: C.cd, border: `0.5px solid ${C.bc}`, borderRadius: 10, padding: ".55rem .8rem" }}>
                  <div onClick={() => add(p, "piece")} style={{ width: 36, height: 36, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, background: p.cat === "games" ? C.grl + "22" : C.gold + "22", flexShrink: 0, overflow: "hidden", cursor: "pointer" }}>{p.img ? <img src={p.img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : CAT_ICON[p.cat]}</div>
                  <div onClick={() => add(p, "piece")} style={{ flex: 1, cursor: "pointer" }}><div style={{ fontSize: 12.5, fontWeight: 600 }}>{p.name}</div><div style={{ fontSize: 10.5, color: C.mt }}>{CATS[p.cat]} · {p.stock !== null ? `مخزون ${p.stock} قطعة` : "خدمة"}</div></div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.grn2 }}>{p.sell ? `${p.sell} ${cur}` : "—"}</div>
                  {p.packSize > 1 && p.sell ? <button onClick={() => add(p, "pack")} style={posUnitBtn(true)}>{p.unit}</button> : null}
                  <button onClick={() => add(p, "piece")} style={posUnitBtn(false)}>قطعة</button>
                </div>
              ))}
            </div>
          )}
          {mode === "compact" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(105px,1fr))", gap: 6 }}>
              {shown.map(p => (
                <div key={p.id} onClick={() => add(p, "piece")} style={{ background: C.cd, border: `0.5px solid ${C.bc}`, borderRadius: 8, padding: ".45rem .5rem", cursor: "pointer", textAlign: "center" }}>
                  <div style={{ fontSize: 11.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.grn2, marginTop: 2 }}>{p.sell || "—"}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <Card style={{ position: "sticky", top: "1rem" }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: ".9rem" }}>🛍 سلة المبيعات</div>
          {!items.length && <div style={{ textAlign: "center", padding: "2rem 0", color: C.mt, fontSize: 12.5 }}>لا توجد منتجات بعد<br /><span style={{ fontSize: 11 }}>اضغط على منتج لإضافته</span></div>}
          {items.map(it => (
            <div key={it.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: ".5rem 0", borderBottom: "0.5px solid rgba(201,168,76,.12)" }}>
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.name} {it.sellUnit === "pack" && <Badge tone="gold" style={{ fontSize: 9 }}>{it.unitLabel}</Badge>} {it.promoPct ? <Badge tone="g" style={{ fontSize: 9 }}>-{it.promoPct}%</Badge> : null}</div><div style={{ fontSize: 11, color: C.mt }}>{it.unitPrice} × {it.qty} {it.sellUnit === "pack" ? `(${it.perPieces} قطعة)` : ""}</div></div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: C.grn2, minWidth: 50, textAlign: "left" }}>{fmt(it.unitPrice * it.qty)}</span>
                <button onClick={() => chg(it.key, -1)} style={qbtn}>−</button>
                <span style={{ fontSize: 12, fontWeight: 700, minWidth: 16, textAlign: "center" }}>{it.qty}</span>
                <button onClick={() => chg(it.key, 1)} style={qbtn}>+</button>
              </div>
            </div>
          ))}
          {items.length > 0 && (
            <div style={{ marginTop: ".75rem", borderTop: `1px solid ${C.bc}`, paddingTop: ".75rem" }}>
              <Row label="المجموع الفرعي" val={fmt(sub) + " د.ل"} />
              {disc > 0 && <Row label="الخصم" val={"-" + fmt(disc) + " د.ل"} color="#1a8c3e" />}
              {pointsDiscount > 0 && <Row label="🎁 خصم النقاط" val={"-" + fmt(pointsDiscount) + " د.ل"} color="#1a8c3e" />}
              {freeValue > 0 && <Row label="🎁 مزايا مجانية (موظف)" val={fmt(freeValue) + " د.ل"} color="#1a8c3e" />}
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 15, borderTop: `0.5px solid ${C.bc}`, marginTop: ".5rem", paddingTop: ".5rem" }}><span>الإجمالي</span><span style={{ color: C.grn2 }}>{fmt(total)} د.ل</span></div>
              {can("discounts") && (
                <div style={{ display: "flex", gap: 7, marginTop: ".7rem" }}>
                  <input value={coupon} onChange={e => setCoupon(e.target.value)} placeholder="كود الخصم" style={{ ...inputStyle, flex: 1 }} />
                  <Btn sm onClick={applyCoupon}>تطبيق</Btn>
                </div>
              )}
              <div style={{ fontSize: 11, color: C.mt, fontWeight: 600, margin: ".8rem 0 5px" }}>طريقة الدفع</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {[["cash", "كاش"], ["card", "بطاقة"], ["transfer", "تحويل مصرفي"], ["defer", "آجل — زبون"], ["employee", "آجل — موظف (يُخصم من راتبه)"]].map(([k, l]) => (
                  <div key={k} onClick={() => setPay(k)} style={{ gridColumn: (k === "defer" || k === "employee") ? "1/-1" : "auto", border: `1px solid ${pay === k ? C.gold : C.bc}`, borderRadius: 8, padding: ".45rem .6rem", cursor: "pointer", fontSize: 12, fontWeight: pay === k ? 600 : 500, background: pay === k ? "rgba(201,168,76,.12)" : C.crm, color: pay === k ? C.grn2 : C.k2, textAlign: "center" }}>{l}</div>
                ))}
              </div>
              {pay === "defer" && (
                <div style={{ marginTop: 8, background: C.gold + "10", border: `0.5px solid ${C.gold}55`, borderRadius: 10, padding: ".7rem" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.gdd, marginBottom: 6 }}>البيع الآجل يُسجّل على حساب زبون</div>
                  {deferCustomer ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: C.cd, borderRadius: 8, padding: ".5rem .7rem" }}>
                      <div><div style={{ fontSize: 12.5, fontWeight: 600 }}>{deferCustomer.name}</div><div style={{ fontSize: 10.5, color: C.mt }}>📱 {deferCustomer.phone}</div></div>
                      <button onClick={() => setDeferCustomer(null)} style={{ background: "none", border: "none", cursor: "pointer", color: C.mt, fontSize: 14 }}>تغيير</button>
                    </div>
                  ) : (
                    <>
                      <Sel value="" onChange={e => { const c = customers.find(x => x.id == e.target.value); if (c) setDeferCustomer(c); }} style={{ marginBottom: 6 }}>
                        <option value="">اختر من قائمة الزبائن...</option>
                        {customers.map(c => <option key={c.id} value={c.id}>{c.name} — {c.phone}</option>)}
                      </Sel>
                      <Btn sm onClick={() => setCustModal(true)} style={{ width: "100%", justifyContent: "center" }}>+ تسجيل زبون جديد</Btn>
                    </>
                  )}
                  {deferCustomer && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontSize: 10.5, color: C.mt, fontWeight: 600, marginBottom: 3 }}>تاريخ استحقاق السداد</div>
                      <Inp type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={{ background: C.cd }} />
                    </div>
                  )}
                </div>
              )}
              {pay === "employee" && (
                <div style={{ marginTop: 8, background: C.purpbg, border: `0.5px solid ${C.purp}55`, borderRadius: 10, padding: ".7rem" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.purp, marginBottom: 6 }}>يُخصم المبلغ تلقائياً من راتب الموظف — تُحتسب هذه العملية ضمن مبيعات وأرباح النادي فوراً</div>
                  {deferEmployee ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: C.cd, borderRadius: 8, padding: ".5rem .7rem" }}>
                      <div><div style={{ fontSize: 12.5, fontWeight: 600 }}>{deferEmployee.name}</div><div style={{ fontSize: 10.5, color: C.mt }}>راتب {fmt(deferEmployee.salary)} {cur}</div></div>
                      <button onClick={() => setDeferEmployee(null)} style={{ background: "none", border: "none", cursor: "pointer", color: C.mt, fontSize: 14 }}>تغيير</button>
                    </div>
                  ) : (
                    <Sel value="" onChange={e => { const emp = employees.find(x => x.id == e.target.value); if (emp) setDeferEmployee(emp); }}>
                      <option value="">اختر الموظف...</option>
                      {employees.filter(e => e.status === "نشط").map(e => <option key={e.id} value={e.id}>{e.name} — {e.role}</option>)}
                    </Sel>
                  )}
                  {freeValue > 0 && <div style={{ marginTop: 8, fontSize: 11, color: "#1a8c3e", fontWeight: 600, background: "#eaf6ee", borderRadius: 7, padding: ".4rem .6rem" }}>🎁 {fmt(freeValue)} {cur} من هذه السلة مجانية (أقسام معفاة) — لن تُخصم من راتبه</div>}
                </div>
              )}
              {settings?.loyaltyOn && pay !== "defer" && pay !== "employee" && (
                <div style={{ marginTop: 8, background: "#fff7eb", border: `0.5px solid ${C.gold}55`, borderRadius: 10, padding: ".7rem" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.gdd, marginBottom: 6 }}>🎁 اختر زبوناً لكسب نقاط الولاء (اختياري)</div>
                  {pointsCustomer ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: C.cd, borderRadius: 8, padding: ".5rem .7rem" }}>
                      <div><div style={{ fontSize: 12.5, fontWeight: 600 }}>{pointsCustomer.name}</div><div style={{ fontSize: 10.5, color: C.mt }}>🎁 {pointsCustomer.points || 0} نقطة</div></div>
                      <button onClick={() => { setPointsCustomer(null); setRedeemPoints(false); }} style={{ background: "none", border: "none", cursor: "pointer", color: C.mt, fontSize: 14 }}>إزالة</button>
                    </div>
                  ) : (
                    <Sel value="" onChange={e => { const c = customers.find(x => x.id == e.target.value); if (c) setPointsCustomer(c); }}>
                      <option value="">اختر من قائمة الزبائن...</option>
                      {customers.map(c => <option key={c.id} value={c.id}>{c.name} — {c.points || 0} نقطة</option>)}
                    </Sel>
                  )}
                </div>
              )}
              {settings?.loyaltyOn && custForPoints && Math.floor((custForPoints.points || 0) / 100) > 0 && (
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, marginTop: 8, cursor: "pointer", background: "rgba(26,140,62,.07)", borderRadius: 8, padding: ".5rem .7rem" }}>
                  <input type="checkbox" checked={redeemPoints} onChange={e => setRedeemPoints(e.target.checked)} />
                  استخدام {Math.floor((custForPoints.points || 0) / 100) * 100} نقطة = خصم {fmt(Math.floor((custForPoints.points || 0) / 100) * (settings.pointsRedeemValue || 0))} {cur}
                </label>
              )}
              <button onClick={checkout} style={{ width: "100%", marginTop: ".9rem", padding: ".65rem", fontSize: 14, fontWeight: 700, borderRadius: 10, cursor: "pointer", border: "none", background: "linear-gradient(135deg," + C.gold + "," + C.gdd + ")", color: "#fff", fontFamily: "inherit" }}>✓ إتمام البيع</button>
            </div>
          )}
        </Card>
      </div>
      {custModal && <NewCustomerModal ctx={ctx} onClose={() => setCustModal(false)} onCreated={(c) => { setDeferCustomer(c); setCustModal(false); }} />}
    </>
  );
}
