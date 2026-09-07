import { useState, useRef, useMemo } from "react";
import { C, THEMES, fmt } from "../constants/theme.js";
import { PageTop, Btn, Card, CardHead, Crest, Field, Inp, inputStyle, Badge } from "../components/ui.jsx";
import InvoiceDesigner from "./InvoiceDesigner.jsx";
import BackupManager from "./BackupManager.jsx";
import { todayISO } from "../utils/format.js";
import { DB } from "../db/db.js";

export default function Settings({ ctx }) {
  const { settings, setSettings, showToast, confirm } = ctx;
  const [tab, setTab] = useState("appearance");
  const set = (k, v) => setSettings(s => ({ ...s, [k]: v }));
  const fileRef = useRef(null);
  // يُقاس عند فتح تبويب قاعدة البيانات فقط — المرور على كل مفاتيح التخزين ليس مجانياً
  const storage = useMemo(() => (tab === "database" ? DB.usage() : null), [tab]);

  const onLogo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 800000) { showToast("حجم الصورة كبير — اختر صورة أصغر من 800KB"); return; }
    const reader = new FileReader();
    reader.onload = () => { set("logo", reader.result); showToast("تم تحديث الشعار"); };
    reader.readAsDataURL(file);
  };

  const TABS = [
    { id: "appearance", label: "المظهر والثيمات", icon: "🎨" },
    { id: "pos", label: "نقطة البيع", icon: "🛍" },
    { id: "printers", label: "الطابعات", icon: "🖨" },
    { id: "printing", label: "إعدادات الطباعة", icon: "📋" },
    { id: "invoice", label: "شكل الفاتورة", icon: "🧾" },
    { id: "content", label: "الكلمات والمعلومات", icon: "✍" },
    { id: "security", label: "الأمان", icon: "🔐" },
    { id: "loyalty", label: "الولاء والنقاط", icon: "🎁" },
    { id: "database", label: "قاعدة البيانات", icon: "🗄" },
  ];

  return (
    <>
      <PageTop title="الإعدادات" action={<Btn gold onClick={() => { ctx.setAuditLog(al => [{ id: "AU-" + Date.now(), date: todayISO(), by: ctx.user?.name || "—", type: "تعديل إعدادات", detail: "تحديث إعدادات النظام" }, ...al]); showToast("تم حفظ جميع الإعدادات"); }}>✓ حفظ الكل</Btn>} />

      {/* tab bar */}
      <div style={{ display: "flex", gap: 4, background: C.gold + "18", borderRadius: 12, padding: 4, marginBottom: "1.1rem", flexWrap: "wrap" }}>
        {TABS.map(t => (
          <div key={t.id} onClick={() => setTab(t.id)} style={{ padding: ".45rem 1rem", borderRadius: 9, fontSize: 12.5, cursor: "pointer", fontWeight: tab === t.id ? 700 : 500, background: tab === t.id ? C.grn : "transparent", color: tab === t.id ? C.gld : C.mt, transition: "all .2s", display: "flex", alignItems: "center", gap: 6 }}>
            <span>{t.icon}</span>{t.label}
          </div>
        ))}
      </div>

      {/* ===== APPEARANCE ===== */}
      {tab === "appearance" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Card className="nk-card-hover">
            <CardHead title="شعار النادي" sub="ارفع شعارك الخاص أو استخدم الشعار الافتراضي" />
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ width: 90, height: 90, borderRadius: 16, background: C.crm, border: `1px dashed ${C.gold}`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                {settings.logo ? <img src={settings.logo} alt="logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Crest size={64} />}
              </div>
              <div style={{ flex: 1 }}>
                <input ref={fileRef} type="file" accept="image/*" onChange={onLogo} style={{ display: "none" }} />
                <Btn gold onClick={() => fileRef.current?.click()} style={{ width: "100%", justifyContent: "center", marginBottom: 7 }}>📤 رفع صورة الشعار</Btn>
                {settings.logo && <Btn onClick={() => { set("logo", null); showToast("تم استرجاع الشعار الافتراضي"); }} style={{ width: "100%", justifyContent: "center" }}>استرجاع الافتراضي</Btn>}
                <div style={{ fontSize: 10.5, color: C.mt, marginTop: 6 }}>PNG أو JPG — أقل من 800KB — يُفضّل مربّع</div>
              </div>
            </div>
          </Card>

          <Card className="nk-card-hover">
            <CardHead title="الوضع الليلي" sub="راحة للعين في الإضاءة المنخفضة" />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: C.crm, borderRadius: 12, padding: "1rem 1.2rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 26 }}>{settings.dark ? "🌙" : "☀️"}</span>
                <div><div style={{ fontSize: 13, fontWeight: 600 }}>{settings.dark ? "الوضع الليلي مُفعّل" : "الوضع النهاري"}</div><div style={{ fontSize: 11, color: C.mt }}>اضغط للتبديل</div></div>
              </div>
              <div onClick={() => set("dark", !settings.dark)} style={{ width: 52, height: 28, borderRadius: 14, background: settings.dark ? C.grl : "#ccc", position: "relative", cursor: "pointer", transition: "background .3s" }}>
                <div style={{ position: "absolute", width: 22, height: 22, borderRadius: "50%", background: "#fff", top: 3, right: settings.dark ? 3 : 27, transition: "right .3s", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>{settings.dark ? "🌙" : "☀️"}</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, padding: "0 .3rem" }}>
              <div style={{ fontSize: 12.5, fontWeight: 600 }}>المؤثرات الحركية</div>
              <div onClick={() => set("animations", !settings.animations)} style={{ width: 34, height: 18, borderRadius: 9, background: settings.animations ? C.grl : "#ccc", position: "relative", cursor: "pointer" }}>
                <div style={{ position: "absolute", width: 14, height: 14, borderRadius: "50%", background: "#fff", top: 2, right: settings.animations ? 2 : 18, transition: "right .2s" }} />
              </div>
            </div>
          </Card>

          <Card className="nk-card-hover" style={{ gridColumn: "1/-1" }}>
            <CardHead title="ثيم الألوان" sub="اختر لوحة الألوان التي تناسب هوية ناديك — التغيير فوري وسلس" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(110px,1fr))", gap: 10 }}>
              {Object.entries(THEMES).map(([key, th], i) => (
                <div key={key} onClick={() => { set("theme", key); showToast(`تم تفعيل ثيم ${th.name}`); }} className="nk-theme-card"
                  style={{ border: `2px solid ${settings.theme === key ? th.accent : C.bc}`, borderRadius: 14, padding: ".8rem", cursor: "pointer", background: settings.theme === key ? th.accent + "12" : C.crm, transform: settings.theme === key ? "translateY(-2px)" : "none", boxShadow: settings.theme === key ? `0 6px 16px ${th.accent}33` : "none", animationDelay: `${i * 35}ms` }}>
                  <div style={{ display: "flex", gap: 5, marginBottom: 8 }}>
                    <div style={{ flex: 1, height: 34, borderRadius: 8, background: `linear-gradient(135deg,${th.brand},${th.brand2})` }} />
                    <div style={{ width: 20, height: 34, borderRadius: 8, background: th.accent }} />
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, textAlign: "center", color: settings.theme === key ? th.accentD : C.k2 }}>{th.name}</div>
                  {settings.theme === key && <div style={{ textAlign: "center", fontSize: 10, color: th.accent, marginTop: 3, fontWeight: 600, animation: settings.animations ? "nkPop .3s ease" : "none" }}>● مُفعّل</div>}
                </div>
              ))}
            </div>
          </Card>

          <Card className="nk-card-hover" style={{ gridColumn: "1/-1" }}>
            <CardHead title="🎨 لون خلفية مخصّص" sub="تجاوز لون خلفية الثيم المختار بلونك الخاص (اختياري)" />
            <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              <label style={{ position: "relative", cursor: "pointer" }}>
                <input type="color" value={settings.customBg || C.pg} onChange={e => set("customBg", e.target.value)} style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: 54, height: 54 }} />
                <div style={{ width: 54, height: 54, borderRadius: 14, background: settings.customBg || C.pg, border: `2px solid ${C.bc}`, boxShadow: "0 2px 8px rgba(0,0,0,.1)" }} />
              </label>
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 2 }}>{settings.customBg ? "لون مخصّص مُفعّل" : "لون خلفية الثيم الافتراضي"}</div>
                <div style={{ fontSize: 10.5, color: C.mt }}>اضغط المربّع لاختيار أي لون — يطبَّق فوراً على كل الصفحات</div>
              </div>
              {settings.customBg && <Btn sm onClick={() => { set("customBg", null); showToast("أُعيدت خلفية الثيم الافتراضية"); }}>↺ إعادة تعيين</Btn>}
            </div>
          </Card>
        </div>
      )}

      {/* ===== POS MODES ===== */}
      {tab === "pos" && (
        <Card className="nk-card-hover">
          <CardHead title="وضعية عرض نقطة البيع السريع" sub="اختر طريقة عرض المنتجات التي تناسب سرعة عملك" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
            {[
              { id: "grid", name: "شبكة البطاقات", desc: "بطاقات كبيرة بأيقونات — الأسرع للمس", preview: "grid" },
              { id: "list", name: "قائمة مفصّلة", desc: "صفوف بمعلومات أكثر لكل منتج", preview: "list" },
              { id: "compact", name: "مضغوط", desc: "أزرار صغيرة — أكبر عدد بالشاشة", preview: "compact" },
            ].map(m => (
              <div key={m.id} onClick={() => { set("posMode", m.id); showToast(`وضع ${m.name} مُفعّل`); }}
                style={{ border: `2px solid ${settings.posMode === m.id ? C.gold : C.bc}`, borderRadius: 14, padding: "1rem", cursor: "pointer", background: settings.posMode === m.id ? C.gold + "10" : C.crm, transition: "all .2s" }}>
                <div style={{ height: 70, background: C.cd, borderRadius: 8, padding: 8, marginBottom: 10, display: "flex", flexDirection: m.preview === "list" ? "column" : "row", flexWrap: m.preview === "grid" ? "wrap" : "nowrap", gap: 4, overflow: "hidden" }}>
                  {m.preview === "grid" && [1, 2, 3, 4, 5, 6].map(i => <div key={i} style={{ width: "30%", height: 26, borderRadius: 5, background: C.gold + "33" }} />)}
                  {m.preview === "list" && [1, 2, 3].map(i => <div key={i} style={{ width: "100%", height: 15, borderRadius: 4, background: C.gold + "33" }} />)}
                  {m.preview === "compact" && [1, 2, 3, 4, 5, 6, 7, 8].map(i => <div key={i} style={{ width: "22%", height: 16, borderRadius: 3, background: C.gold + "33" }} />)}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{m.name}</div>
                <div style={{ fontSize: 11, color: C.mt, marginTop: 2 }}>{m.desc}</div>
                {settings.posMode === m.id && <div style={{ fontSize: 10, color: C.grl, marginTop: 5, fontWeight: 700 }}>● الوضع الحالي</div>}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ===== أقسام مجانية للموظفين ===== */}
      {tab === "pos" && (
        <Card className="nk-card-hover" style={{ marginTop: 12 }}>
          <CardHead title="🎁 أقسام مجانية للموظفين" sub="عند تسجيل شراء موظف من نقطة البيع، أصناف هذه الأقسام لا تُخصم من راتبه ولا تُحتسب ضمن مبلغ الفاتورة" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))", gap: 8 }}>
            {Object.entries(ctx.cats).map(([k, label]) => {
              const list = settings.freeDeptsForEmployees || [];
              const active = list.includes(k);
              return (
                <div key={k} onClick={() => set("freeDeptsForEmployees", active ? list.filter(x => x !== k) : [...list, k])}
                  style={{ border: `1.5px solid ${active ? C.gold : C.bc}`, borderRadius: 10, padding: ".6rem .75rem", cursor: "pointer", background: active ? C.gold + "14" : C.crm, display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12.5, fontWeight: active ? 700 : 500 }}>
                  <span>{label}</span>{active && <span style={{ color: C.gdd }}>🎁</span>}
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: 10.5, color: C.mt, marginTop: 10, lineHeight: 1.7 }}>💡 مثال: فعّل «مياه» ليحصل الموظفون على مياه الشرب مجاناً كميزة عمل — تبقى تكلفتها مُحتسبة في التقارير المالية للشفافية، لكن دون خصم من راتب أحد.</div>
        </Card>
      )}
      {/* ===== PRINTERS ===== */}
      {tab === "printers" && (
        <Card className="nk-card-hover">
          <CardHead title="إعدادات الطابعة" sub="اختر نوع الطابعة المستخدمة لطباعة الفواتير" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[
              { id: "xprinter", name: "طابعة الإيصالات (Xprinter)", desc: "طابعة حرارية 80mm — إيصال ضيق سريع", icon: "🧾", width: "80mm", sample: "narrow" },
              { id: "a4", name: "الطابعة الكبيرة (A4)", desc: "طابعة عادية — فاتورة كاملة بحجم A4", icon: "🖨", width: "A4", sample: "wide" },
            ].map(p => (
              <div key={p.id} onClick={() => { set("printer", p.id); showToast(`تم اختيار ${p.name}`); }}
                style={{ border: `2px solid ${settings.printer === p.id ? C.gold : C.bc}`, borderRadius: 14, padding: "1.1rem", cursor: "pointer", background: settings.printer === p.id ? C.gold + "10" : C.crm, transition: "all .2s", textAlign: "center" }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>{p.icon}</div>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
                  <div style={{ width: p.sample === "narrow" ? 44 : 80, height: 60, background: "#fff", borderRadius: 4, border: `1px solid ${C.bc}`, padding: 5, boxShadow: "0 2px 6px rgba(0,0,0,.08)" }}>
                    <div style={{ height: 6, background: C.gold + "55", borderRadius: 2, marginBottom: 3, width: "60%", marginInline: "auto" }} />
                    {[1, 2, 3, 4].map(i => <div key={i} style={{ height: 3, background: "#ddd", borderRadius: 2, marginBottom: 2 }} />)}
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{p.name}</div>
                <div style={{ fontSize: 11, color: C.mt, marginTop: 3 }}>{p.desc}</div>
                <Badge tone="gold" style={{ marginTop: 8 }}>عرض: {p.width}</Badge>
                {settings.printer === p.id && <div style={{ fontSize: 10, color: C.grl, marginTop: 6, fontWeight: 700 }}>● الطابعة الحالية</div>}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, background: C.gold + "12", border: `0.5px solid ${C.gold}55`, borderRadius: 10, padding: ".8rem 1rem", fontSize: 12, color: C.gdd, display: "flex", gap: 8 }}>
            <span style={{ fontSize: 16 }}>💡</span>
            <span>عند إتمام أي بيع، سيتم تنسيق الفاتورة تلقائياً حسب الطابعة المختارة — الإيصال الحراري يظهر مضغوطاً بعرض 80mm، وطابعة A4 تعرض فاتورة رسمية كاملة.</span>
          </div>
        </Card>
      )}

      {/* ===== إعدادات الطباعة ===== */}
      {tab === "printing" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Card className="nk-card-hover">
            <CardHead title="إعدادات طباعة 80 مم" sub="خصّص حجم الخط والمسافات" />

            <Field label="🔤 حجم الخط (80 مم)">
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <input
                  type="range"
                  min="7"
                  max="11"
                  value={settings.receipt80FontSize || 9}
                  onChange={(e) => set("receipt80FontSize", parseInt(e.target.value))}
                  style={{ flex: 1 }}
                />
                <span style={{ fontWeight: 700, minWidth: 40 }}>{settings.receipt80FontSize || 9}px</span>
              </div>
            </Field>

            <Field label="🪟 الفراغ الداخلي (80 مم)">
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <input
                  type="range"
                  min="2"
                  max="10"
                  value={settings.receipt80Padding || 6}
                  onChange={(e) => set("receipt80Padding", parseInt(e.target.value))}
                  style={{ flex: 1 }}
                />
                <span style={{ fontWeight: 700, minWidth: 40 }}>{settings.receipt80Padding || 6}px</span>
              </div>
            </Field>

            <Field label="📦 خيارات">
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: 8 }}>
                <input
                  type="checkbox"
                  checked={settings.receipt80ShowBarcode !== false}
                  onChange={(e) => set("receipt80ShowBarcode", e.target.checked)}
                />
                <span>إظهار الباركود في 80 مم</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={settings.receipt80ShowFooter !== false}
                  onChange={(e) => set("receipt80ShowFooter", e.target.checked)}
                />
                <span>إظهار التذييل</span>
              </label>
            </Field>
          </Card>

          <Card className="nk-card-hover">
            <CardHead title="إعدادات الطباعة العادية" sub="خصّص حجم الخط والمسافات للفواتير العادية" />

            <Field label="🔤 حجم الخط">
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <input
                  type="range"
                  min="9"
                  max="14"
                  step="0.5"
                  value={settings.normalFontSize || 11.5}
                  onChange={(e) => set("normalFontSize", parseFloat(e.target.value))}
                  style={{ flex: 1 }}
                />
                <span style={{ fontWeight: 700, minWidth: 40 }}>{settings.normalFontSize || 11.5}px</span>
              </div>
            </Field>

            <Field label="🪟 الفراغ الداخلي">
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <input
                  type="range"
                  min="8"
                  max="20"
                  value={settings.normalPadding || 12}
                  onChange={(e) => set("normalPadding", parseInt(e.target.value))}
                  style={{ flex: 1 }}
                />
                <span style={{ fontWeight: 700, minWidth: 40 }}>{settings.normalPadding || 12}px</span>
              </div>
            </Field>

            <Field label="👣 خيارات">
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={settings.normalShowFooter !== false}
                  onChange={(e) => set("normalShowFooter", e.target.checked)}
                />
                <span>إظهار التذييل والتواقيع</span>
              </label>
            </Field>
          </Card>

          <div style={{ gridColumn: "1 / -1", background: C.gold + "12", border: `0.5px solid ${C.gold}55`, borderRadius: 10, padding: ".8rem 1rem", fontSize: 12, color: C.gdd, display: "flex", gap: 8 }}>
            <span style={{ fontSize: 16 }}>💡</span>
            <span>استخدم المتحركات (sliders) لتخصيص حجم الخط والمسافات حسب احتياجاتك. التغييرات تطبق تلقائياً عند الطباعة التالية.</span>
          </div>
        </div>
      )}

      {/* ===== INVOICE DESIGN ===== */}
      {tab === "invoice" && <InvoiceDesigner ctx={ctx} />}

      {/* ===== CONTENT ===== */}
      {tab === "content" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Card className="nk-card-hover">
            <CardHead title="معلومات النادي" sub="تظهر في الشريط الجانبي والفواتير" />
            <Field label="اسم النادي"><Inp value={settings.clubName} onChange={e => set("clubName", e.target.value)} /></Field>
            <Field label="الوصف / الشعار النصي"><Inp value={settings.clubSub} onChange={e => set("clubSub", e.target.value)} /></Field>
            <Field label="العنوان"><Inp value={settings.address} onChange={e => set("address", e.target.value)} /></Field>
            <Field label="رقم الهاتف"><Inp value={settings.phone} onChange={e => set("phone", e.target.value)} /></Field>
          </Card>
          <Card className="nk-card-hover">
            <CardHead title="الكلمات الترحيبية والفاتورة" sub="خصّص نبرة رسائل النظام" />
            <Field label="عنوان الترحيب (شاشة الدخول)"><Inp value={settings.welcomeTitle} onChange={e => set("welcomeTitle", e.target.value)} /></Field>
            <Field label="رسالة ترحيبية"><Inp value={settings.welcomeMsg} onChange={e => set("welcomeMsg", e.target.value)} /></Field>
            <Field label="تذييل الفاتورة"><textarea value={settings.invoiceFooter} onChange={e => set("invoiceFooter", e.target.value)} style={{ ...inputStyle, height: 52, resize: "none" }} /></Field>
            <div style={{ marginTop: 6, background: C.crm, borderRadius: 10, padding: ".7rem .9rem" }}>
              <div style={{ fontSize: 10.5, color: C.mt, marginBottom: 4 }}>معاينة رسالة الترحيب:</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.grn2 }}>{settings.welcomeTitle}</div>
              <div style={{ fontSize: 11.5, color: C.k2 }}>{settings.welcomeMsg}</div>
            </div>
          </Card>
        </div>
      )}

      {/* ===== SECURITY ===== */}
      {tab === "security" && (
        <Card className="nk-card-hover">
          <CardHead title="🔐 انتهاء الجلسة التلقائي" sub="سجّل خروج المستخدم تلقائياً بعد فترة خمول — مفيد لأجهزة الكاشير المشتركة" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 12 }}>
            {[{ v: 0, l: "معطّل" }, { v: 5, l: "5 دقائق" }, { v: 15, l: "15 دقيقة" }, { v: 30, l: "30 دقيقة" }].map(o => (
              <div key={o.v} onClick={() => set("sessionTimeout", o.v)} style={{ border: `1.5px solid ${(settings.sessionTimeout ?? 0) === o.v ? C.gold : C.bc}`, borderRadius: 10, padding: ".6rem", textAlign: "center", cursor: "pointer", fontSize: 12.5, fontWeight: 600, background: (settings.sessionTimeout ?? 0) === o.v ? C.gold + "14" : C.crm }}>{o.l}</div>
            ))}
          </div>
          <div style={{ fontSize: 11.5, color: C.mt, background: C.crm, borderRadius: 8, padding: ".6rem .8rem", lineHeight: 1.8 }}>💡 عند التفعيل، إن لم يتفاعل المستخدم مع النظام (لمس/نقر/كتابة) خلال المدة المحددة، يُسجَّل خروجه تلقائياً وتظهر شاشة الدخول من جديد — لحماية النظام عند ترك الجهاز دون مراقبة.</div>
        </Card>
      )}

      {/* ===== LOYALTY ===== */}
      {tab === "loyalty" && (
        <Card className="nk-card-hover">
          <CardHead title="🎁 نظام نقاط الولاء" sub="كافئ الزبائن المتكررين بنقاط تُستبدل بخصومات" />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: C.crm, borderRadius: 10, padding: ".7rem .9rem", marginBottom: 14 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>تفعيل نظام النقاط</span>
            <div onClick={() => set("loyaltyOn", !settings.loyaltyOn)} style={{ width: 40, height: 21, borderRadius: 11, position: "relative", cursor: "pointer", background: settings.loyaltyOn ? C.grl : "#ccc", transition: ".2s" }}>
              <div style={{ position: "absolute", width: 17, height: 17, borderRadius: "50%", background: "#fff", top: 2, right: settings.loyaltyOn ? 2 : 21, transition: ".2s" }} />
            </div>
          </div>
          {settings.loyaltyOn && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label={`اكسب نقطة واحدة لكل (${settings.currency || "د.ل"})`}><Inp type="number" value={settings.pointsPerCurrency ?? 10} onChange={e => set("pointsPerCurrency", parseFloat(e.target.value) || 1)} /></Field>
              <Field label="قيمة 100 نقطة عند الاستبدال"><Inp type="number" value={settings.pointsRedeemValue ?? 5} onChange={e => set("pointsRedeemValue", parseFloat(e.target.value) || 0)} /></Field>
            </div>
          )}
          <div style={{ fontSize: 11.5, color: C.mt, background: C.crm, borderRadius: 8, padding: ".6rem .8rem", lineHeight: 1.8, marginTop: 10 }}>
            💡 مثال بالإعدادات الحالية: زبون اشترى بـ{settings.pointsPerCurrency ?? 10} {settings.currency || "د.ل"} يكسب نقطة واحدة. عند وصوله 100 نقطة يمكنه استبدالها بخصم {fmt(settings.pointsRedeemValue ?? 5)} {settings.currency || "د.ل"} من نقطة البيع. النقاط تُمنح فقط عند اختيار زبون مسجَّل (وليس «زبون» عابر) في نقطة البيع.
          </div>
        </Card>
      )}

      {tab === "database" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Card className="nk-card-hover">
            <CardHead title="حالة قاعدة البيانات" sub="أين تُحفظ بياناتك الآن" />
            {DB.mode === "supabase" && (
              <div style={{ background: "#e8f8ee", border: "1px solid rgba(26,140,62,.35)", borderRadius: 12, padding: "1rem", textAlign: "center" }}>
                <div style={{ fontSize: 34 }}>☁️</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#1a5c2e", marginTop: 4 }}>سحابية — Supabase</div>
                <div style={{ fontSize: 11.5, color: C.mt, marginTop: 4, lineHeight: 1.8 }}>بياناتك محفوظة دائمياً في السحابة ومتزامنة بين كل الأجهزة المتصلة بنفس المشروع.</div>
              </div>
            )}
            {DB.mode === "local" && (
              <div style={{ background: C.gold + "12", border: `1px solid ${C.gold}55`, borderRadius: 12, padding: "1rem", textAlign: "center" }}>
                <div style={{ fontSize: 34 }}>💾</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: C.gdd, marginTop: 4 }}>محلية — على هذا الجهاز</div>
                <div style={{ fontSize: 11.5, color: C.mt, marginTop: 4, lineHeight: 1.8 }}>بياناتك محفوظة دائمياً في متصفح هذا الجهاز (تنجو من التحديث والإغلاق). لتفعيل السحابة والمزامنة بين الأجهزة، اتبع الخطوات المجاورة.</div>
              </div>
            )}
            {DB.mode === "memory" && (
              <div style={{ background: C.redbg, border: "1px solid rgba(192,57,43,.35)", borderRadius: 12, padding: "1rem", textAlign: "center" }}>
                <div style={{ fontSize: 34 }}>⚠️</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: C.red, marginTop: 4 }}>مؤقتة — في الذاكرة فقط</div>
                <div style={{ fontSize: 11.5, color: C.mt, marginTop: 4, lineHeight: 1.8 }}>هذه البيئة تمنع التخزين المحلي؛ البيانات ستُفقد عند تحديث الصفحة. شغّل النظام في متصفح عادي أو فعّل Supabase.</div>
              </div>
            )}
            {DB.error && <div style={{ marginTop: 10, fontSize: 11, color: C.red, background: C.redbg, borderRadius: 8, padding: ".5rem .7rem" }}>⚠ {DB.error}</div>}
            {/* مقياس المساحة — يجعل الاقتراب من الامتلاء مرئياً قبل أن يفشل الحفظ فجأة */}
            {storage && (
              <div style={{ marginTop: 12, borderTop: `0.5px solid ${C.bc}`, paddingTop: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 5 }}>
                  <span style={{ fontWeight: 600 }}>المساحة المستخدَمة</span>
                  <span style={{ color: storage.pct >= 80 ? C.red : C.mt, fontWeight: 600 }}>
                    {(storage.bytes / 1024 / 1024).toFixed(2)} من ~{(storage.limit / 1024 / 1024).toFixed(0)} م.ب ({storage.pct}%)
                  </span>
                </div>
                <div style={{ height: 8, borderRadius: 4, background: C.crm, overflow: "hidden" }}>
                  <div style={{ width: storage.pct + "%", height: "100%", background: storage.pct >= 80 ? C.red : storage.pct >= 60 ? C.gold : C.grl }} />
                </div>
                {storage.pct >= 60 && (
                  <div style={{ fontSize: 11, color: C.gdd, marginTop: 6, lineHeight: 1.8 }}>
                    المساحة تقترب من الامتلاء. صور المنتجات هي أكبر مستهلك عادةً — صدّر نسخة احتياطية واحذف الصور غير الضرورية.
                  </div>
                )}
              </div>
            )}
            <div style={{ marginTop: 12, borderTop: `0.5px solid ${C.bc}`, paddingTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.red, marginBottom: 6 }}>منطقة الخطر</div>
              <Btn danger onClick={async () => { if (await confirm("سيتم مسح كل البيانات نهائياً (بما فيها المستخدمون) والبدء بنظام فارغ. ستظهر شاشة إنشاء حساب المدير من جديد. هل أنت متأكد؟", { danger: true })) DB.reset(); }}>🗑 مسح كل البيانات والبدء من جديد</Btn>
            </div>
          </Card>
          <Card className="nk-card-hover">
            <CardHead title="تفعيل الحفظ السحابي (Supabase)" sub="مجاني — 4 خطوات لمرة واحدة" />
            <div style={{ fontSize: 12.5, lineHeight: 2.1, color: C.k2 }}>
              <b>1.</b> أنشئ حساباً ومشروعاً مجانياً على <b>supabase.com</b><br />
              <b>2.</b> افتح <b>SQL Editor</b> والصق محتوى ملف <code style={{ background: C.crm, padding: "1px 6px", borderRadius: 5 }}>supabase-schema.sql</code> المرفق ثم نفّذه<br />
              <b>3.</b> من <b>Settings → API</b> انسخ <b>Project URL</b> و <b>anon key</b><br />
              <b>4.</b> انسخ ملف <code style={{ background: C.crm, padding: "1px 6px", borderRadius: 5 }}>.env.example</code> باسم <code style={{ background: C.crm, padding: "1px 6px", borderRadius: 5 }}>.env.local</code> وضع القيمتين فيه:
              <pre style={{ background: "#14431f", color: "#f0d080", borderRadius: 9, padding: ".7rem .9rem", fontSize: 11, direction: "ltr", textAlign: "left", overflowX: "auto", marginTop: 6 }}>{`VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...`}</pre>
              أعد تشغيل خادم التطوير (npm run dev) — ستتحول الحالة إلى ☁️ سحابية تلقائياً، وكل جهاز يفتح النظام يرى نفس البيانات. لا تُرفع <code style={{ background: C.crm, padding: "1px 6px", borderRadius: 5 }}>.env.local</code> إلى أي مستودع عام — يحتوي مفاتيح مشروعك.
            </div>
          </Card>
          <div style={{ gridColumn: "1 / -1" }}><BackupManager ctx={ctx} /></div>
        </div>
      )}
    </>
  );
}
