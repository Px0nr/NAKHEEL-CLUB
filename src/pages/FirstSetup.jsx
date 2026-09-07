import { useState } from "react";
import { C } from "../constants/theme.js";
import { Crest } from "../components/ui.jsx";
import { genSalt, hashPassword } from "../utils/auth.js";

/* ============================ FIRST SETUP (إنشاء المدير الرئيسي) ============================ */
export default function FirstSetup({ settings = {}, onCreate }) {
  const [f, setF] = useState({ name: "", username: "admin", password: "", confirm: "", clubName: settings.clubName || "نادي النخيل" });
  const [err, setErr] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));

  const create = async () => {
    if (!f.name.trim()) { setErr("أدخل اسمك الكامل"); return; }
    if (!f.username.trim()) { setErr("أدخل اسم المستخدم"); return; }
    if (!f.password || f.password.length < 4) { setErr("أدخل رمز دخول من 4 خانات على الأقل"); return; }
    if (f.password !== f.confirm) { setErr("رمز الدخول وتأكيده غير متطابقين"); return; }
    setBusy(true);
    const passwordSalt = genSalt();
    const passwordHash = await hashPassword(f.password, passwordSalt);
    const admin = {
      id: 1, name: f.name.trim(), username: f.username.trim(), passwordSalt, passwordHash, role: "مدير", shift: "—", active: true,
      perms: { invoices: true, discounts: true, cancel: true, reports: true, customers: true, prices: true, purchases: true, inventory: true, salaries: true },
      pages: {},
    };
    onCreate(admin);
  };

  return (
    <div dir="rtl" style={{ fontFamily: "'Tajawal',sans-serif", minHeight: "100vh", background: "radial-gradient(circle at 30% 20%, #1a5c2e 0%, #14431f 45%, #0a2712 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 22, padding: "2.2rem 2rem", width: 460, maxWidth: "95vw", boxShadow: "0 24px 70px rgba(0,0,0,.4)" }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>{settings.logo ? <img src={settings.logo} alt="" style={{ width: 66, height: 66, borderRadius: 16, objectFit: "cover" }} /> : <Crest size={66} />}</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: C.grn2 }}>مرحباً بك في {f.clubName}</div>
          <div style={{ display: "inline-block", background: C.gold + "1c", color: C.gdd, fontSize: 12, fontWeight: 700, borderRadius: 20, padding: ".25rem .9rem", marginTop: 8 }}>⚙ الإعداد الأولي — إنشاء حساب المدير</div>
          <div style={{ fontSize: 12, color: C.mt, marginTop: 10, lineHeight: 1.8 }}>هذه أول مرة تشغّل فيها النظام (أو بعد تصفيره).<br />أنشئ حساب المدير الرئيسي للبدء.</div>
        </div>

        <div style={{ textAlign: "right", marginBottom: 12 }}>
          <label style={{ fontSize: 11, color: C.mt, fontWeight: 600 }}>الاسم الكامل *</label>
          <input value={f.name} autoFocus onChange={e => { set("name", e.target.value); setErr(""); }} placeholder="مثال: أحمد الحسين"
            style={{ width: "100%", marginTop: 4, fontSize: 13, border: `0.5px solid ${C.bc}`, borderRadius: 10, padding: ".6rem .8rem", background: C.crm, fontFamily: "inherit", outline: "none" }} />
        </div>
        <div style={{ textAlign: "right", marginBottom: 12 }}>
          <label style={{ fontSize: 11, color: C.mt, fontWeight: 600 }}>اسم المستخدم (للدخول) *</label>
          <input value={f.username} onChange={e => { set("username", e.target.value); setErr(""); }} placeholder="admin"
            onKeyDown={e => e.key === "Enter" && create()}
            style={{ width: "100%", marginTop: 4, fontSize: 13, border: `0.5px solid ${C.bc}`, borderRadius: 10, padding: ".6rem .8rem", background: C.crm, fontFamily: "inherit", outline: "none", direction: "ltr", textAlign: "left" }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
          <div style={{ textAlign: "right" }}>
            <label style={{ fontSize: 11, color: C.mt, fontWeight: 600 }}>رمز الدخول *</label>
            <input type={showPwd ? "text" : "password"} autoComplete="new-password" value={f.password} onChange={e => { set("password", e.target.value); setErr(""); }} placeholder="••••••"
              style={{ width: "100%", marginTop: 4, fontSize: 14, border: `0.5px solid ${C.bc}`, borderRadius: 10, padding: ".6rem .8rem", background: C.crm, fontFamily: "inherit", outline: "none" }} />
          </div>
          <div style={{ textAlign: "right" }}>
            <label style={{ fontSize: 11, color: C.mt, fontWeight: 600 }}>تأكيد الرمز *</label>
            <input type={showPwd ? "text" : "password"} autoComplete="new-password" value={f.confirm} onChange={e => { set("confirm", e.target.value); setErr(""); }} placeholder="••••••" onKeyDown={e => e.key === "Enter" && create()}
              style={{ width: "100%", marginTop: 4, fontSize: 14, border: `0.5px solid ${C.bc}`, borderRadius: 10, padding: ".6rem .8rem", background: C.crm, fontFamily: "inherit", outline: "none" }} />
          </div>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: C.mt, marginBottom: 12, cursor: "pointer" }}><input type="checkbox" checked={showPwd} onChange={e => setShowPwd(e.target.checked)} /> إظهار الرمز أثناء الكتابة</label>

        {err && <div style={{ color: C.red, fontSize: 12, marginBottom: 12, textAlign: "center" }}>{err}</div>}

        <button onClick={create} disabled={busy} style={{ width: "100%", padding: ".8rem", borderRadius: 12, background: "linear-gradient(135deg,#c9a84c,#b8923c)", color: "#fff", border: "none", fontSize: 14.5, fontWeight: 700, cursor: busy ? "default" : "pointer", fontFamily: "inherit", opacity: busy ? .7 : 1 }}>{busy ? "⏳ جارٍ الإنشاء..." : "✓ إنشاء الحساب والدخول"}</button>

        <div style={{ fontSize: 10.5, color: C.mt, marginTop: 16, textAlign: "center", lineHeight: 1.7 }}>
          سيحصل هذا الحساب على كامل صلاحيات الإدارة.<br />
          يمكنك إضافة بائعين وموظفين لاحقاً من قسم المستخدمين.
        </div>
      </div>
    </div>
  );
}
