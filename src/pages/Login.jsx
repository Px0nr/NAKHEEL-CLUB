import { useState } from "react";
import { C } from "../constants/theme.js";
import { Crest } from "../components/ui.jsx";
import { genSalt, hashPassword, verifyPassword } from "../utils/auth.js";

/* ============================ LOGIN ============================ */
export default function Login({ users, onLogin, settings = {}, setUsers }) {
  const [selected, setSelected] = useState(null);
  const [pwd, setPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [err, setErr] = useState("");
  const [shake, setShake] = useState(false);
  const [phase, setPhase] = useState("idle"); // idle | checking | success
  const activeUsers = users.filter(u => u.active);

  const submit = async () => {
    if (!selected || phase !== "idle") return;
    if (selected.passwordHash) {
      const ok = await verifyPassword(pwd, selected.passwordSalt, selected.passwordHash);
      if (!ok) {
        setErr("رمز الدخول غير صحيح"); setPwd(""); setShake(true);
        setTimeout(() => setShake(false), 420);
        return;
      }
    } else if (selected.password) {
      // حساب قديم برمز نصي غير مشفَّر — تحقّق ثم رقِّه فوراً لرمز مشفَّر
      if (pwd !== selected.password) {
        setErr("رمز الدخول غير صحيح"); setPwd(""); setShake(true);
        setTimeout(() => setShake(false), 420);
        return;
      }
      if (setUsers) {
        const passwordSalt = genSalt();
        const passwordHash = await hashPassword(pwd, passwordSalt);
        setUsers(us => us.map(u => u.id === selected.id ? { ...u, passwordHash, passwordSalt, password: undefined } : u));
      }
    }
    // لمسة احترافية: نبضة نجاح قصيرة قبل الدخول الفعلي
    setPhase("checking");
    setTimeout(() => {
      setPhase("success");
      setTimeout(() => onLogin(selected), 480);
    }, 420);
  };
  const roleIcon = (r) => r === "مدير" ? "👑" : "🧑‍💼";
  const pick = (u) => { setSelected(u); setErr(""); setPwd(""); };
  const back = () => { setSelected(null); setPwd(""); setErr(""); setPhase("idle"); };

  return (
    <div dir="rtl" style={{ fontFamily: "'Tajawal',sans-serif", minHeight: "100vh", background: "radial-gradient(circle at 30% 20%, #1a5c2e 0%, #14431f 45%, #0a2712 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, position: "relative", overflow: "hidden" }}>
      <style>{`
        @keyframes nkPopIn{0%{opacity:0;transform:translateY(22px) scale(.96)}100%{opacity:1;transform:none}}
        @keyframes nkGlowBg{0%,100%{opacity:.5;transform:scale(1)}50%{opacity:.85;transform:scale(1.08)}}
        @keyframes nkGlowBg2{0%,100%{opacity:.35;transform:scale(1)}50%{opacity:.6;transform:scale(1.12)}}
        @keyframes nkFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-14px)}}
        @keyframes nkCardIn{0%{opacity:0;transform:translateY(14px) scale(.94)}100%{opacity:1;transform:none}}
        @keyframes nkShake{10%,90%{transform:translateX(-1px)}20%,80%{transform:translateX(2px)}30%,50%,70%{transform:translateX(-5px)}40%,60%{transform:translateX(5px)}}
        @keyframes nkShimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
        @keyframes nkSpin{to{transform:rotate(360deg)}}
        @keyframes nkCheckPop{0%{opacity:0;transform:scale(.3) rotate(-20deg)}60%{transform:scale(1.15) rotate(4deg)}100%{opacity:1;transform:scale(1) rotate(0)}}
        @keyframes nkSlideIn{0%{opacity:0;transform:translateX(14px)}100%{opacity:1;transform:none}}
        @keyframes nkRing{0%{box-shadow:0 0 0 0 rgba(201,168,76,.55)}100%{box-shadow:0 0 0 10px rgba(201,168,76,0)}}
        .nk-login-card:hover { transform: translateY(-3px); box-shadow: 0 10px 26px rgba(0,0,0,.1); border-color: rgba(201,168,76,.55) !important; }
        .nk-login-card:active { transform: translateY(-1px) scale(.98); }
        .nk-login-card { transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease; }
        .nk-shake { animation: nkShake .42s ease; }
        .nk-btn-primary { transition: transform .15s ease, box-shadow .15s ease, filter .15s ease; }
        .nk-btn-primary:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 20px rgba(201,168,76,.4); filter: brightness(1.04); }
        .nk-btn-primary:active:not(:disabled) { transform: translateY(0) scale(.98); }
        .nk-back-btn { transition: color .15s ease, transform .15s ease; }
        .nk-back-btn:hover { color: #c9a84c !important; transform: translateX(3px); }
        .nk-eye-btn { transition: color .15s ease, transform .15s ease; }
        .nk-eye-btn:hover { color: #c9a84c !important; transform: translateY(-50%) scale(1.12); }
        .nk-pwd-input:focus { border-color: #c9a84c !important; box-shadow: 0 0 0 3px rgba(201,168,76,.15); }
      `}</style>

      {/* خلفية متوهجة متحركة */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", background: "radial-gradient(circle at 78% 82%, rgba(201,168,76,.16) 0%, transparent 42%)", animation: "nkGlowBg 6s ease-in-out infinite" }} />
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", background: "radial-gradient(circle at 15% 15%, rgba(255,255,255,.08) 0%, transparent 38%)", animation: "nkGlowBg2 7s ease-in-out infinite 1s" }} />
      {/* نخيل عائم خفيف في الخلفية للمسة هوية */}
      <div style={{ position: "fixed", bottom: "6%", left: "6%", fontSize: 90, opacity: .06, animation: "nkFloat 8s ease-in-out infinite", pointerEvents: "none" }}>🌴</div>
      <div style={{ position: "fixed", top: "10%", right: "8%", fontSize: 60, opacity: .05, animation: "nkFloat 9s ease-in-out infinite 1.5s", pointerEvents: "none" }}>🌴</div>

      <div style={{ background: "#fff", borderRadius: 22, padding: "2.2rem 2rem", width: 440, maxWidth: "95vw", boxShadow: "0 24px 70px rgba(0,0,0,.45)", animation: "nkPopIn .45s cubic-bezier(.2,.8,.2,1)", position: "relative", overflow: "hidden" }}>
        {/* خط ذهبي علوي متلألئ */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg, transparent, #c9a84c, transparent)", backgroundSize: "200% 100%", animation: "nkShimmer 3s linear infinite" }} />

        <div style={{ textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
            <div style={{ position: "relative" }}>
              {phase === "success" && <div style={{ position: "absolute", inset: -4, borderRadius: 18, animation: "nkRing 1s ease-out infinite" }} />}
              {settings.logo ? <img src={settings.logo} alt="" style={{ width: 66, height: 66, borderRadius: 16, objectFit: "cover" }} /> : <Crest size={66} />}
            </div>
          </div>
          <div style={{ fontSize: 21, fontWeight: 900, color: C.grn2 }}>{settings.clubName || "نادي النخيل"}</div>
          <div style={{ fontSize: 12, color: C.mt, marginBottom: 22, transition: "opacity .2s ease" }}>
            {phase === "success" ? "تم التحقق بنجاح ✓" : selected ? `مرحباً ${selected.name}` : "اختر المستخدم لتسجيل الدخول"}
          </div>
        </div>

        {!selected ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {activeUsers.map((u, i) => (
              <div key={u.id} onClick={() => pick(u)} className="nk-login-card" style={{ cursor: "pointer", border: `1px solid ${C.bc}`, borderRadius: 14, padding: "1rem .8rem", textAlign: "center", background: C.crm, animation: `nkCardIn .38s cubic-bezier(.2,.8,.2,1) both`, animationDelay: `${i * 60}ms` }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", margin: "0 auto 8px", background: u.role === "مدير" ? C.gold + "22" : C.grl + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>{roleIcon(u.role)}</div>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>{u.name}</div>
                <div style={{ fontSize: 11, color: C.mt, marginTop: 2 }}>{u.role}{u.shift !== "—" ? ` · ${u.shift}` : ""}</div>
              </div>
            ))}
            {activeUsers.length === 0 && <div style={{ gridColumn: "1 / -1", textAlign: "center", color: C.mt, fontSize: 12.5, padding: "1.5rem" }}>لا يوجد مستخدمون نشطون</div>}
          </div>
        ) : (
          <div style={{ animation: "nkSlideIn .3s cubic-bezier(.2,.8,.2,1)" }} className={shake ? "nk-shake" : ""}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, background: C.crm, borderRadius: 12, padding: ".7rem .85rem", marginBottom: 14 }}>
              <div style={{ width: 42, height: 42, borderRadius: "50%", background: phase === "success" ? "#1a8c3e22" : selected.role === "مدير" ? C.gold + "22" : C.grl + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 21, transition: "background .3s ease" }}>
                {phase === "success" ? <span style={{ display: "inline-block", animation: "nkCheckPop .4s ease" }}>✅</span> : roleIcon(selected.role)}
              </div>
              <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 700 }}>{selected.name}</div><div style={{ fontSize: 11, color: C.mt }}>{selected.role}</div></div>
              {phase === "idle" && <button onClick={back} className="nk-back-btn" style={{ background: "none", border: "none", color: C.mt, cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>تغيير</button>}
            </div>

            {phase !== "success" && <>
              <label style={{ fontSize: 11, color: C.mt, fontWeight: 600 }}>رمز الدخول</label>
              <div style={{ position: "relative", marginTop: 4, marginBottom: 16 }}>
                <input className="nk-pwd-input" type={showPwd ? "text" : "password"} autoFocus autoComplete="new-password" disabled={phase === "checking"} value={pwd} onChange={(e) => { setPwd(e.target.value); setErr(""); }} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="••••••••"
                  style={{ width: "100%", fontSize: 14, letterSpacing: showPwd ? 0 : 2, border: `0.5px solid ${C.bc}`, borderRadius: 10, padding: ".6rem 2.4rem .6rem .8rem", background: C.crm, fontFamily: "inherit", outline: "none", transition: "border-color .15s ease, box-shadow .15s ease", opacity: phase === "checking" ? .6 : 1 }} />
                <button onClick={() => setShowPwd(s => !s)} tabIndex={-1} title={showPwd ? "إخفاء" : "إظهار"} className="nk-eye-btn" style={{ position: "absolute", top: "50%", right: 8, transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 15, color: C.mt, padding: 4 }}>{showPwd ? "🙈" : "👁"}</button>
              </div>
              {err && <div style={{ color: C.red, fontSize: 12, marginBottom: 12, display: "flex", alignItems: "center", gap: 5 }}><span>⚠</span>{err}</div>}
              <button onClick={submit} disabled={phase === "checking"} className="nk-btn-primary" style={{ width: "100%", padding: ".72rem", borderRadius: 12, background: "linear-gradient(135deg,#c9a84c,#b8923c)", color: "#fff", border: "none", fontSize: 14.5, fontWeight: 700, cursor: phase === "checking" ? "default" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                {phase === "checking" ? <><span style={{ width: 15, height: 15, border: "2px solid rgba(255,255,255,.4)", borderTopColor: "#fff", borderRadius: "50%", animation: "nkSpin .6s linear infinite" }} />جارٍ التحقق...</> : "دخول →"}
              </button>
            </>}
          </div>
        )}

        <div style={{ fontSize: 10.5, color: C.mt, marginTop: 18, textAlign: "center", lineHeight: 1.7 }}>
          نظام إدارة متكامل — {new Date().getFullYear()}<br />
          <span style={{ fontSize: 10 }}>أدخل رمز الدخول الخاص بك — يديره المدير من قسم المستخدمين</span>
        </div>
      </div>
    </div>
  );
}
