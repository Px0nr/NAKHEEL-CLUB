import { useState } from "react";
import { C, fmt } from "../constants/theme.js";
import { PageTop, Btn, KCard, Card, CardHead, Table, Badge, Modal, Field, Sel, Inp } from "../components/ui.jsx";
import QuickAddSupplierModal from "../components/QuickAddSupplierModal.jsx";
import { todayISO, arDate } from "../utils/format.js";
import { DB } from "../db/db.js";

const labelMini = { fontSize: 10, color: C.mt, fontWeight: 600, marginBottom: 2 };

/* ============================ PURCHASES ============================ */
export default function Purchases({ ctx }) {
  const { products, setProducts, purchases, setPurchases, suppliers, setSuppliers, user, showToast } = ctx;
  const [modal, setModal] = useState(false);
  const [supplier, setSupplier] = useState("");
  const [newSupModal, setNewSupModal] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [pay, setPay] = useState("كاش");
  // each line: prodId, qty, qtyUnit ('pack'|'piece'), buyBasis ('pack'|'piece'), buyPrice, sellPiece, sellPack, exp
  const emptyLine = { prodId: "", qty: 1, qtyUnit: "pack", buyBasis: "pack", buyPrice: "", sellPiece: "", sellPack: "", exp: "" };
  const [lines, setLines] = useState([{ ...emptyLine }]);
  const cur = ctx.settings?.currency || "د.ل";

  const prodOf = (id) => products.find(x => x.id == id);

  const addLine = () => setLines(l => [...l, { ...emptyLine }]);
  const setLine = (i, k, v) => setLines(l => l.map((ln, idx) => {
    if (idx !== i) return ln;
    const nl = { ...ln, [k]: v };
    if (k === "prodId") {
      const p = prodOf(v);
      if (p) {
        const pack = p.packSize || 1;
        nl.qtyUnit = pack > 1 ? "pack" : "piece";
        nl.buyBasis = pack > 1 ? "pack" : "piece";
        nl.buyPrice = p.buy ? (pack > 1 ? String(p.buy * pack) : String(p.buy)) : "";
        nl.sellPiece = p.sell ? String(p.sell) : "";
        nl.sellPack = p.sellPack ? String(p.sellPack) : (p.sell && pack > 1 ? String(p.sell * pack) : "");
      }
    }
    return nl;
  }));
  const delLine = (i) => setLines(l => l.filter((_, idx) => idx !== i));

  // pieces added by a line (qty may be in packs or pieces)
  const piecesOf = (ln) => {
    const p = prodOf(ln.prodId);
    if (!p) return 0;
    const pack = p.packSize || 1;
    return ln.qtyUnit === "pack" ? ln.qty * pack : ln.qty;
  };
  // buy cost per single piece
  const buyPieceOf = (ln) => {
    const p = prodOf(ln.prodId);
    if (!p) return 0;
    const pack = p.packSize || 1;
    const bp = parseFloat(ln.buyPrice) || 0;
    return ln.buyBasis === "pack" ? bp / pack : bp;
  };
  const lineCost = (ln) => piecesOf(ln) * buyPieceOf(ln);
  const grand = lines.reduce((s, l) => s + lineCost(l), 0);

  const monthPurch = purchases.reduce((s, p) => s + p.total, 0);
  const dueTotal = suppliers.reduce((s, x) => s + x.due, 0);

  const save = () => {
    const valid = lines.filter(l => l.prodId && l.qty > 0);
    if (!supplier) { showToast("اختر المورد"); return; }
    if (!valid.length) { showToast("أضف منتجاً واحداً على الأقل"); return; }
    const num = "PO-" + ctx.nextCounter("po");
    const itemsStr = valid.map(l => {
      const p = prodOf(l.prodId);
      const unitLbl = l.qtyUnit === "pack" && p?.packSize > 1 ? p.unit : "قطعة";
      return `${p?.name} ×${l.qty} ${unitLbl}`;
    }).join("، ");

    setProducts(ps => ps.map(p => {
      const ln = valid.find(l => l.prodId == p.id);
      if (!ln) return p;
      const piecesAdded = piecesOf(ln);
      const buyPiece = buyPieceOf(ln);
      const sellPiece = parseFloat(ln.sellPiece) || 0;
      const sellPack = parseFloat(ln.sellPack) || 0;
      return {
        ...p,
        stock: (p.stock === null ? 0 : p.stock) + piecesAdded,
        buy: Math.round(buyPiece * 100) / 100,
        sell: sellPiece ? Math.round(sellPiece * 100) / 100 : p.sell,
        sellPack: sellPack ? Math.round(sellPack * 100) / 100 : p.sellPack,
        exp: (p.hasExp && ln.exp) ? ln.exp : p.exp,
        supplier: p.supplier || supplier,
      };
    }));

    setPurchases(pr => [{ id: num, supplier, date, items: itemsStr, pay, total: Math.round(grand * 100) / 100, status: "جديد", by: user?.name || "—" }, ...pr]);
    setSuppliers(sup => sup.map(x => x.name === supplier
      ? { ...x, total: x.total + grand, due: (x.due || 0) + (pay === "آجل" ? grand : 0), status: pay === "آجل" ? "آجل" : x.status }
      : x));
    // حفظ فوري (بلا انتظار التأجيل المعتاد) — هذه عملية حرجة تُحدِّث المخزون ولا يجب أن تُفقد
    DB.flush("products"); DB.flush("purchases"); DB.flush("suppliers");
    showToast(`تم حفظ التوريد #${num} وتحديث المخزون والأسعار${pay === "آجل" ? " (آجل)" : ""}`);
    setModal(false); setLines([{ ...emptyLine }]); setSupplier("");
  };

  const PAY_TONE = { "كاش": "g", "بطاقة": "b", "تحويل": "p", "آجل": "a" };
  return (
    <>
      <PageTop title="فواتير المشتريات والتوريد" action={<Btn gold onClick={() => setModal(true)}>+ فاتورة توريد</Btn>} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 11, marginBottom: "1.1rem" }}>
        <KCard label="مشتريات الشهر" value={fmt(monthPurch)} sub={cur} bar={C.red} />
        <KCard label="عدد الفواتير" value={purchases.length} bar="#2a78d6" />
        <KCard label="مستحقات آجلة" value={fmt(dueTotal)} sub={cur} bar={C.gold} />
      </div>
      <Card>
        <CardHead title="سجل فواتير التوريد" sub="عند التوريد يُحدَّث المخزون (بالقطع) وسعر الشراء والبيع وتاريخ الصلاحية" />
        <Table cols={[{ h: "رقم", w: "13%" }, { h: "المورد", w: "18%" }, { h: "التاريخ", w: "14%" }, { h: "المنتجات", w: "24%" }, { h: "الدفع", w: "12%" }, { h: "الإجمالي", w: "11%" }, { h: "الحالة", w: "8%" }]}
          rows={purchases.map(p => ["#" + p.id, p.supplier, arDate(p.date), p.items, <Badge tone={PAY_TONE[p.pay] || "g"}>{p.pay}</Badge>, fmt(p.total) + " " + cur, <Badge tone={p.status === "قيد الشحن" ? "a" : "g"}>{p.status}</Badge>])} />
      </Card>

      {modal && (
        <Modal title="فاتورة توريد جديدة" onClose={() => setModal(false)} width={720}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="المورد">
              <div style={{ display: "flex", gap: 6 }}>
                <Sel value={supplier} onChange={e => setSupplier(e.target.value)} style={{ flex: 1 }}><option value="">اختر المورد...</option>{suppliers.map(s => <option key={s.id}>{s.name}</option>)}</Sel>
                <Btn sm gold onClick={() => setNewSupModal(true)} style={{ whiteSpace: "nowrap" }}>+ مورد</Btn>
              </div>
            </Field>
            <Field label="تاريخ الفاتورة"><Inp type="date" value={date} onChange={e => setDate(e.target.value)} /></Field>
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.mt, margin: ".3rem 0 .5rem" }}>الأصناف الموردة</div>
          {lines.map((ln, i) => {
            const p = prodOf(ln.prodId);
            const pack = p?.packSize || 1;
            const isPackaged = pack > 1;
            const piecesAdded = piecesOf(ln);
            const buyPiece = buyPieceOf(ln);
            return (
              <div key={i} style={{ background: C.crm, borderRadius: 10, padding: ".6rem .7rem", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 7 }}>
                  <Sel value={ln.prodId} onChange={e => setLine(i, "prodId", e.target.value)} style={{ flex: 2.5, background: C.cd }}><option value="">اختر المنتج...</option>{products.map(pr => <option key={pr.id} value={pr.id}>{pr.name}{pr.packSize > 1 ? ` (${pr.unit} = ${pr.packSize} قطعة)` : ""}</option>)}</Sel>
                  <button onClick={() => delLine(i)} aria-label="إزالة الصنف" style={{ background: "none", border: "none", cursor: "pointer", color: C.mt, fontSize: 15 }}>✕</button>
                </div>
                {p && (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: isPackaged ? "0.8fr 1fr 1fr 1fr" : "1fr 1.4fr", gap: 6, alignItems: "end", marginBottom: 6 }}>
                      <div>
                        <div style={labelMini}>الكمية</div>
                        <Inp type="number" value={ln.qty} onChange={e => setLine(i, "qty", parseInt(e.target.value) || 1)} style={{ background: C.cd }} min="1" />
                      </div>
                      {isPackaged && (
                        <div>
                          <div style={labelMini}>وحدة الكمية</div>
                          <Sel value={ln.qtyUnit} onChange={e => setLine(i, "qtyUnit", e.target.value)} style={{ background: C.cd }}>
                            <option value="pack">{p.unit} (×{pack})</option>
                            <option value="piece">قطعة</option>
                          </Sel>
                        </div>
                      )}
                      <div>
                        <div style={labelMini}>سعر الشراء</div>
                        <Inp type="number" value={ln.buyPrice} onChange={e => setLine(i, "buyPrice", e.target.value)} style={{ background: C.cd }} placeholder="0" />
                      </div>
                      {isPackaged && (
                        <div>
                          <div style={labelMini}>أساس السعر</div>
                          <Sel value={ln.buyBasis} onChange={e => setLine(i, "buyBasis", e.target.value)} style={{ background: C.cd }}>
                            <option value="pack">لكل {p.unit}</option>
                            <option value="piece">لكل قطعة</option>
                          </Sel>
                        </div>
                      )}
                    </div>
                    {isPackaged && parseFloat(ln.buyPrice) > 0 && (
                      <div style={{ background: C.bluebg, borderRadius: 7, padding: ".4rem .7rem", fontSize: 11.5, color: C.blue, marginBottom: 6 }}>
                        🧮 تكلفة القطعة الواحدة: <b>{fmt(buyPiece)} {cur}</b>{ln.buyBasis === "pack" ? ` (${ln.buyPrice} ÷ ${pack})` : ""}
                      </div>
                    )}
                    <div style={{ display: "grid", gridTemplateColumns: isPackaged ? (p.hasExp ? "1fr 1fr 1fr" : "1fr 1fr") : (p.hasExp ? "1fr 1fr" : "1fr"), gap: 6, alignItems: "end" }}>
                      <div>
                        <div style={labelMini}>سعر بيع القطعة</div>
                        <Inp type="number" value={ln.sellPiece} onChange={e => setLine(i, "sellPiece", e.target.value)} style={{ background: C.cd }} placeholder="0" />
                      </div>
                      {isPackaged && (
                        <div>
                          <div style={labelMini}>سعر بيع {p.unit}</div>
                          <Inp type="number" value={ln.sellPack} onChange={e => setLine(i, "sellPack", e.target.value)} style={{ background: C.cd }} placeholder={ln.sellPiece ? fmt((parseFloat(ln.sellPiece) || 0) * pack) : "0"} />
                        </div>
                      )}
                      {p.hasExp && <div><div style={labelMini}>تاريخ الصلاحية</div><Inp type="date" value={ln.exp} onChange={e => setLine(i, "exp", e.target.value)} style={{ background: C.cd }} /></div>}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 7, fontSize: 11, color: C.mt, flexWrap: "wrap", gap: 4 }}>
                      <span>➕ يُضاف <b>{piecesAdded}</b> قطعة للمخزون{ln.qtyUnit === "pack" && isPackaged ? ` (${ln.qty} ${p.unit} × ${pack})` : ""}</span>
                      {parseFloat(ln.sellPiece) > 0 && buyPiece > 0 && <span style={{ color: "#1a8c3e" }}>ربح القطعة: {fmt((parseFloat(ln.sellPiece) || 0) - buyPiece)} {cur}</span>}
                      <span style={{ fontWeight: 700, color: C.grn2 }}>إجمالي السطر: {fmt(lineCost(ln))} {cur}</span>
                    </div>
                  </>
                )}
              </div>
            );
          })}
          <Btn sm onClick={addLine} style={{ marginTop: 2 }}>+ إضافة صنف</Btn>
          <Field label="طريقة الدفع" full><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 4 }}>
            {["كاش", "بطاقة", "تحويل", "آجل"].map(m => <div key={m} onClick={() => setPay(m)} style={{ gridColumn: m === "آجل" ? "1/-1" : "auto", border: `1px solid ${pay === m ? C.gold : C.bc}`, borderRadius: 8, padding: ".45rem", textAlign: "center", cursor: "pointer", fontSize: 12, background: pay === m ? "rgba(201,168,76,.12)" : C.crm, color: pay === m ? C.grn2 : C.k2, fontWeight: pay === m ? 600 : 500 }}>{m}</div>)}
          </div></Field>
          <div style={{ background: C.crm, borderRadius: 9, padding: ".65rem .85rem", margin: ".75rem 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ fontSize: 12, color: C.mt, fontWeight: 600 }}>إجمالي الفاتورة</span><span style={{ fontSize: 17, fontWeight: 700, color: C.grn2 }}>{fmt(grand)} {cur}</span></div>
          <div style={{ display: "flex", gap: 8 }}><Btn gold onClick={save} style={{ flex: 1, justifyContent: "center" }}>✓ حفظ وتوريد</Btn><Btn onClick={() => setModal(false)}>إلغاء</Btn></div>
        </Modal>
      )}

      {newSupModal && <QuickAddSupplierModal onClose={() => setNewSupModal(false)} ctx={ctx} onCreated={(s) => setSupplier(s.name)} />}
    </>
  );
}
