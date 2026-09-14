import { useState, useEffect } from "react";
import { C, fmt } from "../constants/theme.js";
import { CATS, PERIOD_NAME, PERIOD_ICON } from "../constants/seeds.js";
import { PageTop, Btn, KCard, Card, Badge, Modal, Field, Sel, Inp } from "../components/ui.jsx";
import { todayISO, arDate } from "../utils/format.js";
import { promoActiveNow } from "../utils/promos.js";

/* ============================ PROMOTIONS (التخفيضات والعروض) ============================ */
export default function Promotions({ ctx }) {
  const { promotions, setPromotions, cats, showToast } = ctx;
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const empty = { name: "", cat: "all", pct: "", from: todayISO(), to: "", period: "allday" };
  const [f, setF] = useState(empty);
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick(x => x + 1), 30000); return () => clearInterval(t); }, []);

  const activeNow = promotions.filter(p => promoActiveNow(p));
  const scheduled = promotions.filter(p => p.active && !promoActiveNow(p) && p.to >= todayISO());
  const catName = (k) => k === "all" ? "كل الأقسام" : (cats[k] || CATS[k] || k);

  const openAdd = () => { setEditId(null); setF(empty); setModal(true); };
  const openEdit = (p) => { setEditId(p.id); setF({ name: p.name, cat: p.cat, pct: String(p.pct), from: p.from, to: p.to, period: p.period }); setModal(true); };

  const save = () => {
    if (!f.name.trim()) { showToast("أدخل اسم العرض"); return; }
    const pct = parseInt(f.pct);
    if (!pct || pct < 1 || pct > 90) { showToast("نسبة الخصم يجب أن تكون بين 1 و 90"); return; }
    if (!f.to) { showToast("حدد تاريخ نهاية العرض"); return; }
    if (f.to < f.from) { showToast("تاريخ النهاية قبل البداية"); return; }
    if (editId) {
      setPromotions(ps => ps.map(p => p.id === editId ? { ...p, name: f.name.trim(), cat: f.cat, pct, from: f.from, to: f.to, period: f.period } : p));
      showToast("تم تحديث العرض");
    } else {
      setPromotions(ps => [...ps, { id: Math.max(0, ...ps.map(x => x.id)) + 1, name: f.name.trim(), cat: f.cat, pct, from: f.from, to: f.to, period: f.period, active: true }]);
      showToast("تم إنشاء العرض وتفعيله");
    }
    setModal(false); setEditId(null); setF(empty);
  };
  const toggle = (id) => setPromotions(ps => ps.map(p => p.id === id ? { ...p, active: !p.active } : p));
  const remove = (id) => { setPromotions(ps => ps.filter(p => p.id !== id)); showToast("تم حذف العرض"); };

  const statusOf = (p) => {
    if (!p.active) return { label: "موقوف", tone: "r" };
    if (promoActiveNow(p)) return { label: "فعّال الآن", tone: "g" };
    if (p.from > todayISO()) return { label: "مجدول", tone: "b" };
    if (p.to < todayISO()) return { label: "منتهي", tone: "r" };
    return { label: "خارج الفترة الزمنية", tone: "a" };
  };

  return (
    <>
      <PageTop title="التخفيضات والعروض" action={<Btn gold onClick={openAdd}>+ عرض جديد</Btn>} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 11, marginBottom: "1.1rem" }}>
        <KCard label="عروض فعّالة الآن" value={activeNow.length} sub="تُطبَّق على نقطة البيع" bar="#1a8c3e" />
        <KCard label="عروض مجدولة" value={scheduled.length} sub="قادمة أو خارج فترتها" bar="#2a78d6" />
        <KCard label="إجمالي العروض" value={promotions.length} sub="عرض" bar={C.gold} />
      </div>

      {activeNow.length > 0 && (
        <div style={{ background: "linear-gradient(135deg,#e8f8ee,#fff)", border: "1px solid rgba(26,140,62,.3)", borderRadius: 12, padding: ".7rem 1rem", marginBottom: "1rem", fontSize: 12.5, color: "#1a5c2e" }}>
          🏷 <b>{activeNow.length}</b> عرض فعّال الآن: {activeNow.map(p => `${p.name} (-${p.pct}% على ${catName(p.cat)})`).join(" · ")} — الأسعار المخفّضة تظهر تلقائياً في نقطة البيع.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {promotions.length === 0 && <Card><div style={{ textAlign: "center", padding: "2rem", color: C.mt }}>لا توجد عروض — أنشئ أول عرض تخفيض.</div></Card>}
        {promotions.map(p => {
          const st = statusOf(p);
          return (
            <Card key={p.id} className="nk-card-hover" style={{ borderRight: `4px solid ${st.tone === "g" ? "#1a8c3e" : st.tone === "b" ? "#2a78d6" : st.tone === "r" ? C.red : C.gold}` }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 52, height: 52, borderRadius: 12, background: C.gold + "18", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: C.gdd }}>-{p.pct}%</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>{p.name} <Badge tone={st.tone}>{st.label}</Badge></div>
                    <div style={{ fontSize: 11.5, color: C.mt, marginTop: 3 }}>
                      القسم: <b style={{ color: C.k2 }}>{catName(p.cat)}</b> · {PERIOD_ICON[p.period]} {PERIOD_NAME[p.period]}
                    </div>
                    <div style={{ fontSize: 11, color: C.mt, marginTop: 2 }}>من {arDate(p.from)} إلى {arDate(p.to)}</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div onClick={() => toggle(p.id)} title={p.active ? "إيقاف" : "تفعيل"} style={{ width: 38, height: 20, borderRadius: 10, background: p.active ? C.grl : "#ccc", position: "relative", cursor: "pointer" }}>
                    <div style={{ position: "absolute", width: 16, height: 16, borderRadius: "50%", background: "#fff", top: 2, right: p.active ? 2 : 20, transition: "right .2s" }} />
                  </div>
                  <Btn sm onClick={() => openEdit(p)}>✎ تعديل</Btn>
                  <Btn sm danger onClick={() => remove(p.id)}>حذف</Btn>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {modal && (
        <Modal title={editId ? "تعديل عرض" : "عرض تخفيض جديد"} onClose={() => setModal(false)} width={480}>
          <Field label="اسم العرض *"><Inp value={f.name} onChange={e => set("name", e.target.value)} placeholder="مثال: عرض عيد الفطر — ألعاب" /></Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="القسم المستهدف">
              <Sel value={f.cat} onChange={e => set("cat", e.target.value)}>
                <option value="all">كل الأقسام</option>
                {Object.entries(cats).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Sel>
            </Field>
            <Field label="نسبة الخصم % *"><Inp type="number" value={f.pct} onChange={e => set("pct", e.target.value)} placeholder="20" min="1" max="90" /></Field>
            <Field label="من تاريخ"><Inp type="date" value={f.from} onChange={e => set("from", e.target.value)} /></Field>
            <Field label="إلى تاريخ *"><Inp type="date" value={f.to} onChange={e => set("to", e.target.value)} /></Field>
          </div>
          <Field label="الفترة الزمنية للتطبيق" full>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 7 }}>
              {["morning", "evening", "allday"].map(pr => (
                <div key={pr} onClick={() => set("period", pr)} style={{ border: `1.5px solid ${f.period === pr ? C.gold : C.bc}`, borderRadius: 10, padding: ".6rem .4rem", textAlign: "center", cursor: "pointer", background: f.period === pr ? C.gold + "14" : C.crm }}>
                  <div style={{ fontSize: 20 }}>{PERIOD_ICON[pr]}</div>
                  <div style={{ fontSize: 10.5, fontWeight: 600, marginTop: 3 }}>{pr === "morning" ? "صباحية" : pr === "evening" ? "مسائية" : "كامل اليوم"}</div>
                  <div style={{ fontSize: 9, color: C.mt }}>{pr === "morning" ? "6ص – 4م" : pr === "evening" ? "4م – 12م" : "24 ساعة"}</div>
                </div>
              ))}
            </div>
          </Field>
          {f.pct && <div style={{ background: "rgba(26,140,62,.07)", border: "0.5px solid rgba(26,140,62,.2)", borderRadius: 8, padding: ".55rem .8rem", margin: ".3rem 0 .7rem", fontSize: 12, color: "#1a5c2e" }}>مثال: منتج سعره 50 → يصبح <b>{fmt(50 * (1 - (parseInt(f.pct) || 0) / 100))}</b> خلال فترة العرض</div>}
          <div style={{ display: "flex", gap: 8 }}><Btn gold onClick={save} style={{ flex: 1, justifyContent: "center" }}>✓ {editId ? "حفظ التعديل" : "إنشاء وتفعيل"}</Btn><Btn onClick={() => setModal(false)}>إلغاء</Btn></div>
        </Modal>
      )}
    </>
  );
}
