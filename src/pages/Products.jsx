import { useState, useEffect, useRef } from "react";
import { C, fmt } from "../constants/theme.js";
import { CATS } from "../constants/seeds.js";
import { PageTop, Btn, KCard, Card, CardHead, Sel, inputStyle, Table, Badge, Modal, Field, Inp } from "../components/ui.jsx";
import { genBarcode, BarcodeSVG } from "../components/barcode.jsx";
import { todayISO, arDate, productBarcodes, matchesBarcodePartial } from "../utils/format.js";
import { DB } from "../db/db.js";

/* ============================ PRODUCTS ============================ */
export default function Products({ ctx, can }) {
  const { products, setProducts, waste, setWaste, user, showToast, settings, cats, setCats } = ctx;
  const cur = settings?.currency || "د.ل";
  const [modal, setModal] = useState(false);
  const [editingId, setEditingId] = useState(null); // null = add mode
  const [filter, setFilter] = useState("");
  const [q, setQ] = useState(() => (ctx.searchIntent && ctx.searchIntent.type === "product") ? ctx.searchIntent.query : "");
  useEffect(() => { if (ctx.searchIntent && ctx.searchIntent.type === "product") ctx.setSearchIntent(null); }, []);
  const [wasteItem, setWasteItem] = useState(null); // منتج قيد تسجيل الإتلاف
  const [wasteForm, setWasteForm] = useState({ qty: 1, reason: "سكب / انسكاب", note: "", date: todayISO() });
  const WASTE_REASONS = ["سكب / انسكاب", "تسريب عبوة", "كسر", "انتهاء الصلاحية", "تلف بالتخزين", "أخرى"];
  const applyWaste = () => {
    if (!wasteItem) return;
    const qty = Math.min(wasteItem.stock, Math.max(1, parseInt(wasteForm.qty) || 1));
    const cost = Math.round((wasteItem.buy || 0) * qty * 100) / 100;
    setProducts(ps => ps.map(p => p.id === wasteItem.id ? { ...p, stock: Math.max(0, p.stock - qty) } : p));
    setWaste(w => [{ id: "WS-" + Date.now(), date: wasteForm.date, pid: wasteItem.id, name: wasteItem.name, cat: wasteItem.cat, qty, reason: wasteForm.reason, note: wasteForm.note.trim(), cost, by: user?.name || "—" }, ...w]);
    showToast(`تم تسجيل إتلاف ${qty} ${wasteItem.unit} من «${wasteItem.name}» — خسارة ${fmt(cost)} ${cur}`);
    setWasteItem(null); setWasteForm({ qty: 1, reason: "سكب / انسكاب", note: "", date: todayISO() });
  };
  const empty = { bc: "", extraBc: "", name: "", cat: "", newCat: "", unit: "علبة", packSize: "", min: "", hasExp: "no", supplier: "", status: "active", img: null, sell: "", sellPack: "" };
  const [form, setForm] = useState(empty);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const PACK_UNITS = ["صندوق", "كرتون", "كيس", "علبة"];
  const isPack = PACK_UNITS.includes(form.unit);
  const isEdit = editingId !== null;

  const shown = products.filter(p =>
    (!filter || p.cat === filter) && (p.name.includes(q) || matchesBarcodePartial(p, q))
  );
  const lowCount = products.filter(p => p.stock !== null && p.min && p.stock < p.min).length;
  const stockValue = products.reduce((s, p) => s + (p.buy || 0) * (p.stock || 0), 0);

  const openAdd = () => { setEditingId(null); setForm(empty); setModal(true); };
  const openEdit = (p) => {
    setEditingId(p.id);
    setForm({
      bc: p.bc, extraBc: (p.barcodes || []).join(", "), name: p.name, cat: p.cat, newCat: "", unit: p.unit, packSize: p.packSize > 1 ? String(p.packSize) : "",
      min: p.min ? String(p.min) : "", hasExp: p.hasExp ? "yes" : "no", supplier: p.supplier || "", status: p.status,
      img: p.img || null, sell: p.sell ? String(p.sell) : "", sellPack: p.sellPack ? String(p.sellPack) : "",
    });
    setModal(true);
  };

  const resolveCat = () => {
    if (form.cat !== "__new") return form.cat;
    const name = form.newCat.trim();
    if (!name) return null;
    // create key and register
    const key = "cat_" + Date.now().toString().slice(-6);
    setCats(cs => ({ ...cs, [key]: name }));
    CATS[key] = name; // immediate availability
    return key;
  };

  const save = () => {
    if (!form.name.trim() || !form.cat) { showToast("أدخل اسم المنتج والقسم"); return; }
    if (form.cat === "__new" && !form.newCat.trim()) { showToast("أدخل اسم القسم الجديد"); return; }
    if (isPack && form.packSize && parseInt(form.packSize) < 1) { showToast("عدد القطع في العبوة يجب أن يكون 1 أو أكثر"); return; }
    const cat = resolveCat();
    if (!cat) { showToast("أدخل اسم القسم الجديد"); return; }
    const packSize = isPack ? (parseInt(form.packSize) || 1) : 1;
    const isService = form.unit === "ساعة" || form.unit === "جلسة" || form.unit === "كود رقمي";

    // باركودات إضافية (نكهات/أنواع لنفس المنتج بنفس السعر) — مفصولة بفواصل
    const extraBarcodes = (form.extraBc || "").split(",").map(b => b.trim()).filter(Boolean);
    const allCodesEntered = [form.bc.trim(), ...extraBarcodes].filter(Boolean);
    const conflict = products.find(p => p.id !== editingId && allCodesEntered.some(c => productBarcodes(p).includes(c)));
    if (conflict) { showToast(`الباركود مستخدم بالفعل في المنتج «${conflict.name}»`); return; }

    if (isEdit) {
      const oldP = products.find(p => p.id === editingId);
      const newSell = parseFloat(form.sell) || 0;
      setProducts(ps => ps.map(p => p.id === editingId ? {
        ...p,
        bc: form.bc.trim() || p.bc, barcodes: extraBarcodes, name: form.name.trim(), cat, unit: form.unit, packSize,
        min: parseInt(form.min) || 0, hasExp: form.hasExp === "yes",
        supplier: form.supplier, status: form.status, img: form.img,
        sell: parseFloat(form.sell) || 0,
        sellPack: parseFloat(form.sellPack) || 0,
      } : p));
      if (oldP && oldP.sell !== newSell) {
        ctx.setAuditLog(al => [{ id: "AU-" + Date.now(), date: todayISO(), by: user?.name || "—", type: "تعديل سعر", detail: `${form.name.trim()}: ${fmt(oldP.sell)} ← ${fmt(newSell)} ${cur}` }, ...al]);
      }
      showToast(`تم تحديث «${form.name.trim()}»`);
    } else {
      const bc = form.bc.trim() || genBarcode(products);
      setProducts(ps => [...ps, {
        id: Math.max(0, ...ps.map(x => x.id)) + 1, bc, barcodes: extraBarcodes, name: form.name.trim(), cat, unit: form.unit,
        packSize, sell: 0, sellPack: 0, buy: 0,
        stock: isService ? null : 0, min: parseInt(form.min) || 0,
        hasExp: form.hasExp === "yes", exp: null,
        supplier: form.supplier, status: form.status, img: form.img,
      }]);
      showToast(`تمت إضافة المنتج «${form.name.trim()}» — يُسعّر عند أول توريد`);
    }
    DB.flush("products"); DB.flush("auditLog"); // حفظ فوري — لا ننتظر التأجيل المعتاد لعملية مهمة كإضافة/تعديل منتج
    setForm(empty); setModal(false); setEditingId(null);
  };

  const STATUS = { active: ["نشط", "g"], limited: ["محدود", "a"], inactive: ["غير نشط", "r"] };
  const imgRef = useRef(null);
  const onImg = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 700000) { showToast("حجم الصورة كبير — اختر أصغر من 700KB"); return; }
    const reader = new FileReader();
    reader.onload = () => set("img", reader.result);
    reader.readAsDataURL(file);
  };

  return (
    <>
      <PageTop title="إدارة المنتجات" action={can("inventory") && <Btn gold onClick={openAdd}>+ إضافة منتج</Btn>} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 11, marginBottom: "1.1rem" }}>
        <KCard label="إجمالي المنتجات" value={products.length} sub="منتج" bar={C.grl} />
        <KCard label="مخزون منخفض" value={lowCount} sub="تحتاج تزويد" bar={C.red} />
        <KCard label="قيمة المخزون" value={fmt(stockValue)} sub={cur} bar={C.gold} />
      </div>
      <Card>
        <CardHead title="قائمة المنتجات" sub="اضغط «تعديل» لتغيير البيانات أو الأسعار أو الصورة" right={
          <div style={{ display: "flex", gap: 7 }}>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="بحث بالاسم أو الباركود..." style={{ ...inputStyle, width: 170 }} />
            <Sel value={filter} onChange={e => setFilter(e.target.value)} style={{ width: 130 }}><option value="">كل الأقسام</option>{Object.entries(cats).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Sel>
          </div>
        } />
        <Table cols={[{ h: "الباركود", w: "11%" }, { h: "الاسم", w: "19%" }, { h: "القسم", w: "10%" }, { h: "العبوة", w: "10%" }, { h: "بيع/قطعة", w: "8%" }, { h: "بيع/عبوة", w: "8%" }, { h: "شراء/قطعة", w: "8%" }, { h: "المخزون", w: "8%" }, { h: "الصلاحية", w: "8%" }, { h: "إجراءات", w: "10%" }]}
          rows={shown.map(p => [
            <span><span style={{ fontFamily: "monospace", fontSize: 11, background: C.crm, padding: "2px 6px", borderRadius: 5 }}>{p.bc}</span>{p.barcodes && p.barcodes.length > 0 && <span title={p.barcodes.join(", ")} style={{ fontSize: 9.5, background: C.gold + "22", color: C.gdd, padding: "2px 5px", borderRadius: 5, marginRight: 4, fontWeight: 700 }}>+{p.barcodes.length}</span>}</span>,
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>{p.img ? <img src={p.img} alt="" style={{ width: 26, height: 26, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} /> : <span style={{ width: 26, height: 26, borderRadius: 6, background: C.crm, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>{p.cat === "games" ? "🎮" : "☕"}</span>}<span style={{ fontWeight: 600 }}>{p.name}</span></span>,
            <Badge tone={p.cat === "games" ? "g" : "a"}>{CATS[p.cat] || p.cat}</Badge>,
            <span>{p.unit}{p.packSize > 1 ? <span style={{ fontSize: 10, color: C.mt }}> (×{p.packSize})</span> : ""}</span>,
            p.sell ? <span style={{ fontWeight: 600, color: C.grn2 }}>{p.sell} {cur}</span> : <span style={{ color: C.mt, fontSize: 11 }}>لم يُسعّر</span>,
            p.packSize > 1 ? (p.sellPack ? <span style={{ fontWeight: 600, color: C.gdd }}>{p.sellPack} {cur}</span> : <span style={{ color: C.mt, fontSize: 11 }}>{p.sell ? fmt(p.sell * p.packSize) + " " + cur : "—"}</span>) : "—",
            p.buy ? p.buy + " " + cur : "—",
            p.stock !== null ? <span style={{ color: p.min && p.stock < p.min ? C.red : C.k2, fontWeight: p.min && p.stock < p.min ? 600 : 400 }}>{p.stock}</span> : "خدمة",
            <span style={{ fontSize: 11 }}>{p.hasExp ? arDate(p.exp) : "—"}</span>,
            can("inventory") ? (
              <div style={{ display: "flex", gap: 4 }}>
                <Btn sm onClick={() => openEdit(p)}>✎ تعديل</Btn>
                {p.stock !== null && <Btn sm danger onClick={() => { setWasteItem(p); setWasteForm({ qty: 1, reason: "سكب / انسكاب", note: "", date: todayISO() }); }}>🗑 إتلاف</Btn>}
              </div>
            ) : "—",
          ])} />
      </Card>

      {wasteItem && (
        <Modal title={`تسجيل إتلاف — ${wasteItem.name}`} onClose={() => setWasteItem(null)} width={440}>
          <div style={{ fontSize: 12, color: C.mt, marginBottom: 12, background: C.crm, borderRadius: 8, padding: ".55rem .8rem" }}>المتوفر حالياً: <b>{wasteItem.stock} {wasteItem.unit}</b> — سعر الشراء: <b>{fmt(wasteItem.buy || 0)} {cur}</b> / {wasteItem.unit}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label={"الكمية التالفة (" + wasteItem.unit + ")"}><Inp type="number" min="1" max={wasteItem.stock} value={wasteForm.qty} onChange={e => setWasteForm({ ...wasteForm, qty: e.target.value })} /></Field>
            <Field label="التاريخ"><Inp type="date" value={wasteForm.date} onChange={e => setWasteForm({ ...wasteForm, date: e.target.value })} /></Field>
            <Field label="السبب" full><Sel value={wasteForm.reason} onChange={e => setWasteForm({ ...wasteForm, reason: e.target.value })}>{WASTE_REASONS.map(r => <option key={r}>{r}</option>)}</Sel></Field>
            <Field label="ملاحظة (اختياري)" full><Inp value={wasteForm.note} onChange={e => setWasteForm({ ...wasteForm, note: e.target.value })} placeholder="مثال: سقط كوب أثناء التقديم" /></Field>
          </div>
          <div style={{ background: "#fdeaea", border: "0.5px solid rgba(192,57,43,.25)", borderRadius: 9, padding: ".6rem .85rem", margin: ".4rem 0 1rem", fontSize: 12.5, display: "flex", justifyContent: "space-between" }}>
            <span>الخسارة المقدّرة</span><b style={{ color: C.red }}>{fmt(Math.round((wasteItem.buy || 0) * (Math.max(1, parseInt(wasteForm.qty) || 1)) * 100) / 100)} {cur}</b>
          </div>
          <div style={{ display: "flex", gap: 8 }}><Btn danger onClick={applyWaste} style={{ flex: 1, justifyContent: "center" }}>🗑 تأكيد الإتلاف وخصمه من المخزون</Btn><Btn onClick={() => setWasteItem(null)}>إلغاء</Btn></div>
        </Modal>
      )}

      {modal && (
        <Modal title={isEdit ? `تعديل منتج — ${form.name || ""}` : "إضافة منتج جديد"} onClose={() => { setModal(false); setEditingId(null); }}>
          <div style={{ display: "flex", gap: 7, alignItems: "flex-end", marginBottom: ".75rem" }}>
            <div style={{ flex: 1 }}><Field label="رقم المنتج / الباركود"><Inp value={form.bc} onChange={e => set("bc", e.target.value)} placeholder="يُولّد تلقائياً إن تُرك فارغاً" /></Field></div>
            {!isEdit && <Btn onClick={() => set("bc", genBarcode(products))} style={{ marginBottom: ".75rem", background: C.grn, color: C.gld, border: "none" }}>توليد</Btn>}
          </div>
          {form.bc && <div style={{ marginBottom: ".75rem" }}><BarcodeSVG code={form.bc} /></div>}
          <Field label="باركودات إضافية لنفس المنتج (اختياري)" full>
            <Inp value={form.extraBc} onChange={e => set("extraBc", e.target.value)} placeholder="مثال: نكهة عنب، نكهة مانجا — افصل بينها بفاصلة ," />
          </Field>
          <div style={{ fontSize: 10.5, color: C.mt, marginTop: -6, marginBottom: ".75rem", lineHeight: 1.7 }}>💡 لمنتج له عدة أنواع/نكهات بنفس السعر (كعصير بأنواع عنب/مانجا/برتقال) — أدخل باركود كل نوع هنا مفصولاً بفاصلة، وسيتعرّف عليها الماسح جميعاً كصنف واحد بنفس السعر والمخزون.</div>
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: ".75rem", background: C.crm, borderRadius: 10, padding: ".7rem .85rem" }}>
            <div style={{ width: 64, height: 64, borderRadius: 12, background: C.cd, border: `1px dashed ${C.gold}`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
              {form.img ? <img src={form.img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 24, color: C.mt }}>🖼</span>}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>صورة المنتج {isEdit ? "(يمكن تغييرها)" : "(اختياري)"}</div>
              <input ref={imgRef} type="file" accept="image/*" onChange={onImg} style={{ display: "none" }} />
              <div style={{ display: "flex", gap: 6 }}>
                <Btn sm gold onClick={() => imgRef.current?.click()}>📤 {form.img ? "تغيير الصورة" : "رفع صورة"}</Btn>
                {form.img && <Btn sm onClick={() => set("img", null)}>إزالة</Btn>}
              </div>
              <div style={{ fontSize: 10, color: C.mt, marginTop: 4 }}>تظهر في الكتالوج ونقطة البيع — أقل من 700KB</div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="اسم المنتج *" full><Inp value={form.name} onChange={e => set("name", e.target.value)} placeholder="مثال: Red Bull" /></Field>
            <Field label="القسم *">
              <Sel value={form.cat} onChange={e => set("cat", e.target.value)}>
                <option value="">اختر...</option>
                {Object.entries(cats).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                <option value="__new">➕ إضافة قسم جديد...</option>
              </Sel>
            </Field>
            {form.cat === "__new" && <Field label="اسم القسم الجديد *"><Inp value={form.newCat} onChange={e => set("newCat", e.target.value)} placeholder="مثال: مشروبات ساخنة" /></Field>}
            <Field label="الوحدة / العبوة"><Sel value={form.unit} onChange={e => set("unit", e.target.value)}>{["علبة", "قطعة", "كود رقمي", "صندوق", "كرتون", "كيس", "وجبة", "ساعة", "جلسة", "زجاجة", "كوب"].map(u => <option key={u}>{u}</option>)}</Sel></Field>
            {isPack && <Field label={`عدد القطع في ${form.unit} *`}><Inp type="number" value={form.packSize} onChange={e => set("packSize", e.target.value)} placeholder="مثال: 24" min="1" /></Field>}
            <Field label="الحد الأدنى للتنبيه (بالقطعة)"><Inp type="number" value={form.min} onChange={e => set("min", e.target.value)} /></Field>
            <Field label="له تاريخ صلاحية؟"><Sel value={form.hasExp} onChange={e => set("hasExp", e.target.value)}><option value="no">لا</option><option value="yes">نعم</option></Sel></Field>
            <Field label="المورد الافتراضي"><Sel value={form.supplier} onChange={e => set("supplier", e.target.value)}><option value="">بدون</option>{ctx.suppliers.map(s => <option key={s.id}>{s.name}</option>)}</Sel></Field>
            <Field label="الحالة"><Sel value={form.status} onChange={e => set("status", e.target.value)}><option value="active">نشط</option><option value="limited">محدود</option><option value="inactive">غير نشط</option></Sel></Field>
          </div>
          {isEdit && (
            <div style={{ background: C.gold + "10", border: `0.5px solid ${C.gold}55`, borderRadius: 10, padding: ".7rem .85rem", margin: ".5rem 0" }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: C.gdd, marginBottom: 8 }}>💰 تعديل أسعار البيع الحالية</div>
              <div style={{ display: "grid", gridTemplateColumns: isPack ? "1fr 1fr" : "1fr", gap: 10 }}>
                <Field label={`سعر بيع القطعة (${cur})`}><Inp type="number" value={form.sell} onChange={e => set("sell", e.target.value)} placeholder="0" /></Field>
                {isPack && <Field label={`سعر بيع ${form.unit} (${cur})`}><Inp type="number" value={form.sellPack} onChange={e => set("sellPack", e.target.value)} placeholder={form.sell ? fmt(form.sell * (parseInt(form.packSize) || 1)) : "0"} /></Field>}
              </div>
              {isPack && form.sell && form.packSize && <div style={{ fontSize: 11, color: C.mt }}>سعر {form.unit} المحسوب من القطع: {fmt(form.sell * (parseInt(form.packSize) || 1))} {cur}{form.sellPack ? ` — السعر المخصص: ${form.sellPack} ${cur}` : ""}</div>}
            </div>
          )}
          {isPack && form.packSize > 1 && !isEdit && <div style={{ background: C.bluebg, border: `0.5px solid ${C.blue}33`, borderRadius: 8, padding: ".55rem .8rem", margin: ".5rem 0", fontSize: 12, color: C.blue }}>📦 كل {form.unit} = <b>{form.packSize} قطعة</b> — سيُحسب المخزون بالقطع تلقائياً عند التوريد</div>}
          {!isEdit && <div style={{ background: C.gold + "12", border: `0.5px solid ${C.gold}44`, borderRadius: 8, padding: ".6rem .8rem", margin: ".5rem 0", fontSize: 11.5, color: C.gdd, display: "flex", gap: 7 }}><span>💡</span><span>أسعار الشراء والبيع وتاريخ الصلاحية تُحدَّد عند توريد المنتج من قسم <b>المشتريات</b> — هنا تُعرّف المنتج في الكتالوج فقط.</span></div>}
          <div style={{ display: "flex", gap: 8, marginTop: ".5rem" }}><Btn gold onClick={save} style={{ flex: 1, justifyContent: "center" }}>✓ {isEdit ? "حفظ التعديلات" : "حفظ المنتج"}</Btn><Btn onClick={() => { setModal(false); setEditingId(null); }}>إلغاء</Btn></div>
        </Modal>
      )}
    </>
  );
}
