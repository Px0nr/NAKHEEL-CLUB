import { useState } from "react";
import { C, fmt } from "../constants/theme.js";
import { ASSET_STATUS } from "../constants/seeds.js";
import { PageTop, Btn, KCard, Card, CardHead, Sel, inputStyle, Badge, Modal, Field, Inp } from "../components/ui.jsx";
import QuickAddSupplierModal from "../components/QuickAddSupplierModal.jsx";
import { todayISO, arDate, daysBetween } from "../utils/format.js";

const actBtn = (color) => ({ background: color + "18", border: "none", borderRadius: 6, color, fontSize: 12, fontWeight: 700, padding: "4px 8px", cursor: "pointer", fontFamily: "inherit" });

/* ============================ ASSETS (موارد النادي) ============================ */
export default function Assets({ ctx }) {
  const { assets, setAssets, suppliers, user, showToast } = ctx;
  const cur = ctx.settings?.currency || "د.ل";
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [modal, setModal] = useState(false);
  const [supModal, setSupModal] = useState(false);
  const [actionAsset, setActionAsset] = useState(null); // { asset, type }
  const [detail, setDetail] = useState(null);

  const empty = { name: "", cat: "أجهزة ألعاب", qty: 1, addedAt: todayISO(), supplier: "", cost: "" };
  const [f, setF] = useState(empty);
  const [act, setAct] = useState({ date: todayISO(), note: "", cost: "" });

  const CATS_A = ["أجهزة ألعاب", "معدات رياضية", "أثاث", "إلكترونيات", "أخرى"];
  const counts = {
    all: assets.length,
    active: assets.filter(a => a.status === "active").length,
    maintenance: assets.filter(a => a.status === "maintenance").length,
    damaged: assets.filter(a => a.status === "damaged").length,
    lost: assets.filter(a => a.status === "lost").length,
  };
  const shown = assets.filter(a => (filter === "all" || a.status === filter) && (a.name.includes(q) || a.cat.includes(q)));
  const totalValue = assets.filter(a => a.status !== "lost" && a.status !== "damaged").reduce((s, a) => s + (a.cost || 0) * (a.qty || 1), 0);

  const addAsset = () => {
    if (!f.name.trim()) { showToast("أدخل اسم المورد"); return; }
    setAssets(a => [...a, { id: "a" + Date.now(), name: f.name.trim(), cat: f.cat, qty: parseInt(f.qty) || 1, addedAt: f.addedAt, supplier: f.supplier, cost: parseFloat(f.cost) || 0, status: "active", history: [] }]);
    showToast("تمت إضافة المورد للنادي"); setModal(false); setF(empty);
  };

  // تنفيذ إجراء على مورد: صيانة / تلف / فقد / إرجاع من صيانة
  const applyAction = () => {
    const { asset, type } = actionAsset;
    setAssets(list => list.map(a => {
      if (a.id !== asset.id) return a;
      const hist = [...(a.history || [])];
      const doneBy = user?.name || "—";
      if (type === "maintenance") {
        hist.push({ event: "إرسال للصيانة", date: act.date, note: act.note || "—", by: doneBy });
        return { ...a, status: "maintenance", history: hist, maintStart: act.date };
      }
      if (type === "return") {
        hist.push({ event: "عاد من الصيانة", date: act.date, from: a.maintStart, note: act.note || "تم الإصلاح", cost: parseFloat(act.cost) || 0, by: doneBy });
        return { ...a, status: "active", history: hist, maintStart: null };
      }
      if (type === "damaged") { hist.push({ event: "سُجّل كتالف", date: act.date, note: act.note || "—", by: doneBy }); return { ...a, status: "damaged", history: hist, damagedAt: act.date }; }
      if (type === "lost") { hist.push({ event: "سُجّل كمفقود", date: act.date, note: act.note || "—", by: doneBy }); return { ...a, status: "lost", history: hist, lostAt: act.date }; }
      if (type === "restore") { hist.push({ event: "أُعيد للخدمة", date: act.date, note: act.note || "—", by: doneBy }); return { ...a, status: "active", history: hist }; }
      return a;
    }));
    const labels = { maintenance: "أُرسل للصيانة", return: "عاد من الصيانة", damaged: "سُجّل كتالف", lost: "سُجّل كمفقود", restore: "أُعيد للخدمة" };
    showToast(`${asset.name}: ${labels[type]}`);
    setActionAsset(null); setAct({ date: todayISO(), note: "", cost: "" });
  };

  const actionTitle = (type) => ({ maintenance: "إرسال للصيانة", return: "إرجاع من الصيانة", damaged: "تسجيل كتالف", lost: "تسجيل كمفقود", restore: "إعادة للخدمة" }[type]);

  return (
    <>
      <PageTop title="موارد النادي" action={<Btn gold onClick={() => { setF(empty); setModal(true); }}>+ إضافة مورد</Btn>} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 11, marginBottom: "1.1rem" }}>
        <KCard label="إجمالي الموارد" value={counts.all} sub="عنصر" bar={C.gold} />
        <KCard label="قيمة الموجودات" value={fmt(totalValue)} sub={cur} bar="#1a8c3e" />
        <KCard label="في الصيانة" value={counts.maintenance} sub="حالياً" bar="#2a78d6" />
        <KCard label="تالف / مفقود" value={counts.damaged + counts.lost} sub="عنصر" bar={C.red} />
      </div>

      <Card>
        <CardHead title="سجل الموارد" right={<input value={q} onChange={e => setQ(e.target.value)} placeholder="بحث..." style={{ ...inputStyle, width: 150 }} />} />
        {/* شرائح الفلترة حسب الحالة */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          {[["all", "الكل", C.gold], ["active", "موجود ✅", "#1a8c3e"], ["maintenance", "صيانة 🔧", "#2a78d6"], ["damaged", "تالف ⚠️", "#c0392b"], ["lost", "مفقود ❓", "#8a6a20"]].map(([k, l, c]) => (
            <span key={k} onClick={() => setFilter(k)} style={{ cursor: "pointer", fontSize: 11.5, fontWeight: 600, padding: ".35rem .85rem", borderRadius: 20, background: filter === k ? c : C.crm, color: filter === k ? "#fff" : C.k2, border: `0.5px solid ${filter === k ? c : C.bc}` }}>{l} ({counts[k]})</span>
          ))}
        </div>

        <div className="nk-tbl-wrap">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>{["المورد", "الفئة", "العدد", "تاريخ الإضافة", "التكلفة", "الحالة", "إجراءات"].map((h, i) => <th key={i} style={{ background: C.grn, color: C.gld, padding: "8px 10px", textAlign: "right", fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap" }}>{h}</th>)}</tr></thead>
            <tbody>
              {shown.map(a => {
                const st = ASSET_STATUS[a.status];
                return (
                  <tr key={a.id} style={{ borderBottom: `0.5px solid ${C.bc}` }}>
                    <td style={{ padding: "8px 10px", fontSize: 12.5, fontWeight: 600 }}>{a.name}</td>
                    <td style={{ padding: "8px 10px", fontSize: 12, color: C.mt }}>{a.cat}</td>
                    <td style={{ padding: "8px 10px", fontSize: 12 }}>{a.qty}</td>
                    <td style={{ padding: "8px 10px", fontSize: 11.5, color: C.mt }}>{arDate(a.addedAt)}</td>
                    <td style={{ padding: "8px 10px", fontSize: 12 }}>{a.cost ? fmt(a.cost) + " " + cur : "—"}</td>
                    <td style={{ padding: "8px 10px" }}><Badge tone={st.tone}>{st.icon} {st.label}</Badge></td>
                    <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        <button onClick={() => setDetail(a)} title="السجل" style={actBtn(C.mt)}>📋</button>
                        {a.status === "active" && <>
                          <button onClick={() => { setActionAsset({ asset: a, type: "maintenance" }); setAct({ date: todayISO(), note: "", cost: "" }); }} title="صيانة" style={actBtn("#2a78d6")}>🔧</button>
                          <button onClick={() => { setActionAsset({ asset: a, type: "damaged" }); setAct({ date: todayISO(), note: "", cost: "" }); }} title="تالف" style={actBtn("#c0392b")}>⚠️</button>
                          <button onClick={() => { setActionAsset({ asset: a, type: "lost" }); setAct({ date: todayISO(), note: "", cost: "" }); }} title="مفقود" style={actBtn("#8a6a20")}>❓</button>
                        </>}
                        {a.status === "maintenance" && <button onClick={() => { setActionAsset({ asset: a, type: "return" }); setAct({ date: todayISO(), note: "", cost: "" }); }} title="إرجاع من الصيانة" style={actBtn("#1a8c3e")}>✅ إرجاع</button>}
                        {(a.status === "damaged" || a.status === "lost") && <button onClick={() => { setActionAsset({ asset: a, type: "restore" }); setAct({ date: todayISO(), note: "", cost: "" }); }} title="إعادة للخدمة" style={actBtn("#1a8c3e")}>↩ إرجاع</button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {shown.length === 0 && <div style={{ textAlign: "center", color: C.mt, fontSize: 12.5, padding: "2rem" }}>لا موارد مطابقة</div>}
        </div>
      </Card>

      {/* نافذة الإجراء */}
      {actionAsset && (
        <Modal title={`${actionTitle(actionAsset.type)} — ${actionAsset.asset.name}`} onClose={() => setActionAsset(null)} width={440}>
          <Field label="التاريخ"><Inp type="date" value={act.date} onChange={e => setAct({ ...act, date: e.target.value })} /></Field>
          {actionAsset.type === "return" ? (
            <>
              <Field label="العطل الذي تم إصلاحه"><Inp value={act.note} onChange={e => setAct({ ...act, note: e.target.value })} placeholder="مثال: استبدال زر التحكم" /></Field>
              <Field label={"تكلفة الإصلاح (" + cur + ")"}><Inp type="number" value={act.cost} onChange={e => setAct({ ...act, cost: e.target.value })} placeholder="0" /></Field>
              {actionAsset.asset.maintStart && <div style={{ fontSize: 11.5, color: C.mt, background: C.crm, borderRadius: 8, padding: ".5rem .7rem", marginBottom: 10 }}>مدة الصيانة: من {arDate(actionAsset.asset.maintStart)} إلى {arDate(act.date)} ({daysBetween(actionAsset.asset.maintStart, act.date)} يوم)</div>}
            </>
          ) : (
            <Field label={actionAsset.type === "maintenance" ? "وصف العطل" : "ملاحظة"}><Inp value={act.note} onChange={e => setAct({ ...act, note: e.target.value })} placeholder={actionAsset.type === "maintenance" ? "مثال: لا يستجيب زر X" : "سبب التلف/الفقد"} /></Field>
          )}
          <div style={{ display: "flex", gap: 8 }}><Btn gold onClick={applyAction} style={{ flex: 1, justifyContent: "center" }}>✓ تأكيد</Btn><Btn onClick={() => setActionAsset(null)}>إلغاء</Btn></div>
        </Modal>
      )}

      {/* نافذة سجل المورد */}
      {detail && (
        <Modal title={`سجل — ${detail.name}`} onClose={() => setDetail(null)} width={520}>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", background: C.crm, borderRadius: 10, padding: ".7rem 1rem", marginBottom: 12, fontSize: 12 }}>
            <span>الفئة: <b>{detail.cat}</b></span><span>العدد: <b>{detail.qty}</b></span>
            <span>أُضيف: <b>{arDate(detail.addedAt)}</b></span>
            {detail.supplier && <span>المورّد: <b>{detail.supplier}</b></span>}
            <span>الحالة: <Badge tone={ASSET_STATUS[detail.status].tone}>{ASSET_STATUS[detail.status].icon} {ASSET_STATUS[detail.status].label}</Badge></span>
          </div>
          {(!detail.history || detail.history.length === 0) ? <div style={{ textAlign: "center", color: C.mt, fontSize: 12.5, padding: "1.5rem" }}>لا أحداث مسجّلة — المورد بحالته الأصلية.</div> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {detail.history.map((h, i) => (
                <div key={i} style={{ borderRight: `3px solid ${C.gold}`, background: C.crm, borderRadius: 8, padding: ".55rem .8rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, fontWeight: 700 }}><span>{h.event}</span><span style={{ color: C.mt, fontWeight: 500 }}>{arDate(h.date)}</span></div>
                  {h.note && h.note !== "—" && <div style={{ fontSize: 11.5, color: C.k2, marginTop: 3 }}>📝 {h.note}</div>}
                  {h.from && <div style={{ fontSize: 11, color: C.mt, marginTop: 2 }}>مدة الصيانة: {daysBetween(h.from, h.date)} يوم</div>}
                  {h.cost > 0 && <div style={{ fontSize: 11, color: "#c0392b", marginTop: 2 }}>تكلفة الإصلاح: {fmt(h.cost)} {cur}</div>}
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}

      {/* نافذة إضافة مورد */}
      {modal && (
        <Modal title="إضافة مورد جديد للنادي" onClose={() => setModal(false)} width={480}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="اسم المورد *" full><Inp value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="مثال: يد تحكم PS5" /></Field>
            <Field label="الفئة"><Sel value={f.cat} onChange={e => setF({ ...f, cat: e.target.value })}>{CATS_A.map(c => <option key={c}>{c}</option>)}</Sel></Field>
            <Field label="العدد"><Inp type="number" value={f.qty} onChange={e => setF({ ...f, qty: e.target.value })} min="1" /></Field>
            <Field label="تاريخ الإضافة"><Inp type="date" value={f.addedAt} onChange={e => setF({ ...f, addedAt: e.target.value })} /></Field>
            <Field label={"التكلفة للوحدة (" + cur + ")"}><Inp type="number" value={f.cost} onChange={e => setF({ ...f, cost: e.target.value })} placeholder="0" /></Field>
            <Field label="المورّد (اختياري)" full>
              <div style={{ display: "flex", gap: 6 }}>
                <Sel value={f.supplier} onChange={e => setF({ ...f, supplier: e.target.value })} style={{ flex: 1 }}><option value="">— بدون —</option>{suppliers.map(s => <option key={s.id}>{s.name}</option>)}</Sel>
                <Btn sm gold onClick={() => setSupModal(true)} style={{ whiteSpace: "nowrap" }}>+ مورّد</Btn>
              </div>
            </Field>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}><Btn gold onClick={addAsset} style={{ flex: 1, justifyContent: "center" }}>✓ إضافة</Btn><Btn onClick={() => setModal(false)}>إلغاء</Btn></div>
        </Modal>
      )}

      {/* نافذة إضافة مورّد سريع */}
      {supModal && <QuickAddSupplierModal onClose={() => setSupModal(false)} ctx={ctx} onCreated={(s) => setF(ff => ({ ...ff, supplier: s.name }))} />}
    </>
  );
}
