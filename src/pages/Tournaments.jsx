import { useState } from "react";
import { C } from "../constants/theme.js";
import { PageTop, Btn, Card, CardHead, Badge, Modal, Field, Inp, Sel } from "../components/ui.jsx";
import { openPdfDoc } from "../components/pdfHook.js";
import { todayISO, arDate } from "../utils/format.js";
import { buildBracket, roundLabels, setMatchWinner } from "../utils/bracket.js";

/* ============================ TOURNAMENTS (الدوريات والمسابقات) ============================ */
export default function Tournaments({ ctx }) {
  const { tournaments, setTournaments, showToast } = ctx;
  const [selected, setSelected] = useState(null);
  const [modal, setModal] = useState(false);
  const GAME_TYPES = ["تنس طاولة", "بلايستيشن — FIFA", "بلايستيشن — مصارعة", "بلياردو", "أخرى"];
  const [f, setF] = useState({ name: "", game: "تنس طاولة", size: "8", startDate: todayISO(), prize: "" });
  const [pf, setPf] = useState({ name: "", phone: "" });

  const t = tournaments.find(x => x.id === selected);
  const pName = (id) => t?.participants.find(p => p.id === id)?.name || (id ? "؟" : "—");

  const createTournament = () => {
    if (!f.name.trim()) { showToast("أدخل اسم الدوري"); return; }
    const nt = { id: "TN-" + Date.now(), name: f.name.trim(), game: f.game, size: parseInt(f.size), startDate: f.startDate, prize: f.prize.trim(), status: "تسجيل", participants: [], rounds: null, champion: null, runnerUp: null, createdAt: todayISO() };
    setTournaments(ts => [nt, ...ts]);
    showToast("تم إنشاء الدوري — ابدأ بتسجيل المشتركين");
    setModal(false); setF({ name: "", game: "تنس طاولة", size: "8", startDate: todayISO(), prize: "" });
    setSelected(nt.id);
  };

  const addParticipant = () => {
    if (!pf.name.trim()) { showToast("أدخل اسم المشترك"); return; }
    if (t.participants.length >= t.size) { showToast(`الحد الأقصى ${t.size} مشتركين لهذا الدوري`); return; }
    const p = { id: "pt" + Date.now(), name: pf.name.trim(), phone: pf.phone.trim() };
    setTournaments(ts => ts.map(x => x.id === t.id ? { ...x, participants: [...x.participants, p] } : x));
    setPf({ name: "", phone: "" });
  };
  const removeParticipant = (pid) => setTournaments(ts => ts.map(x => x.id === t.id ? { ...x, participants: x.participants.filter(p => p.id !== pid) } : x));

  const startDraw = () => {
    if (t.participants.length < 2) { showToast("يلزم مشتركان على الأقل لبدء القرعة"); return; }
    const rounds = buildBracket(t.participants, t.size);
    setTournaments(ts => ts.map(x => x.id === t.id ? { ...x, rounds, status: "جارٍ" } : x));
    showToast("🎲 تمّت القرعة — الدور الأول جاهز!");
  };

  const [scoreInputs, setScoreInputs] = useState({}); // matchKey -> {s1,s2}
  const decideWinner = (roundIdx, matchIdx, winnerId) => {
    const key = `${roundIdx}-${matchIdx}`;
    const sc = scoreInputs[key] || {};
    const { rounds, champion, runnerUp } = setMatchWinner(t.rounds, roundIdx, matchIdx, winnerId, sc.s1, sc.s2);
    setTournaments(ts => ts.map(x => x.id === t.id ? { ...x, rounds, champion, runnerUp, status: champion ? "منتهية" : "جارٍ" } : x));
    if (champion) showToast(`🏆 انتهى الدوري — البطل: ${pName(champion)}`);
  };

  const deleteTournament = (id) => {
    const removed = tournaments.find(x => x.id === id);
    if (!removed) return;
    setTournaments(ts => ts.filter(x => x.id !== id));
    if (selected === id) setSelected(null);
    showToast(`حُذف الدوري «${removed.name}»`, { onUndo: () => setTournaments(ts => [...ts, removed]) });
  };

  // طباعة سجل المشتركين (متاحة بعد انتهاء التسجيل)
  const printParticipants = () => {
    openPdfDoc(ctx.settings, {
      title: `سجل مشتركي الدوري — ${t.name}`,
      recipientLabel: "الدوري", recipientName: t.name,
      docNo: t.id,
      columns: ["#", "الاسم", "الهاتف"],
      rows: t.participants.map((p, i) => [i + 1, p.name, p.phone || "—"]),
      totals: [["إجمالي المشتركين", t.participants.length + " مشترك"]],
      note: `نوع اللعبة: ${t.game} — حجم القرعة: ${t.size} — تاريخ البدء: ${arDate(t.startDate)}`,
    });
  };

  // طباعة قائمة الدوري إلى المباريات (جدول كل الأدوار والنتائج)
  const printMatches = () => {
    const lbls = roundLabels(t.rounds.length);
    const rows = [];
    t.rounds.forEach((round, ri) => {
      round.forEach((m, mi) => {
        const score = (m.score1 != null && m.score2 != null) ? `${m.score1} - ${m.score2}` : "—";
        const winner = m.winner ? pName(m.winner) : "لم تُلعب بعد";
        rows.push([lbls[ri], `مباراة ${mi + 1}`, pName(m.p1), score, pName(m.p2), winner]);
      });
    });
    openPdfDoc(ctx.settings, {
      title: `قائمة مباريات الدوري — ${t.name}`,
      recipientLabel: "الدوري", recipientName: t.name,
      docNo: t.id,
      columns: ["الدور", "المباراة", "اللاعب الأول", "النتيجة", "اللاعب الثاني", "الفائز"],
      rows,
      totals: [["إجمالي المشتركين", t.participants.length + " مشترك"], ["الحالة", t.status], ...(t.champion ? [["🏆 البطل", pName(t.champion)]] : [])],
      note: `نوع اللعبة: ${t.game}${t.prize ? " — الجائزة: " + t.prize : ""} — تاريخ البدء: ${arDate(t.startDate)}`,
    });
  };

  const STATUS_TONE = { "تسجيل": "gold", "جارٍ": "b", "منتهية": "g" };

  /* ---------- قائمة الدوريات ---------- */
  if (!t) {
    return (
      <>
        <PageTop title="🏆 الدوريات والمسابقات" action={<Btn gold onClick={() => setModal(true)}>+ إنشاء دوري جديد</Btn>} />
        {tournaments.length === 0 ? (
          <Card><div style={{ textAlign: "center", color: C.mt, padding: "2rem" }}>لا دوريات بعد — أنشئ أول دوري لناديك (تنس طاولة، بلايستيشن FIFA...).</div></Card>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 12 }}>
            {tournaments.map(tt => (
              <Card key={tt.id} className="nk-card-hover" style={{ cursor: "pointer" }}>
                <div onClick={() => setSelected(tt.id)}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: C.grn2 }}>{tt.name}</div>
                    <Badge tone={STATUS_TONE[tt.status]}>{tt.status}</Badge>
                  </div>
                  <div style={{ fontSize: 12, color: C.mt, marginBottom: 6 }}>{tt.game} · {tt.size} مقاعد</div>
                  <div style={{ fontSize: 12, color: C.k2, marginBottom: 6 }}>👥 {tt.participants.length} مشترك مسجَّل</div>
                  {tt.status === "منتهية" && tt.champion && (
                    <div style={{ background: "linear-gradient(135deg,#fff7eb,#fff)", border: `1px solid ${C.gold}66`, borderRadius: 8, padding: ".4rem .6rem", fontSize: 12, fontWeight: 700, color: C.gdd, marginTop: 6 }}>🏆 البطل: {tt.participants.find(p => p.id === tt.champion)?.name || "—"}</div>
                  )}
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                  <button onClick={() => deleteTournament(tt.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.mt, fontSize: 12.5 }}>🗑 حذف</button>
                </div>
              </Card>
            ))}
          </div>
        )}
        {modal && (
          <Modal title="إنشاء دوري / مسابقة جديدة" onClose={() => setModal(false)} width={460}>
            <Field label="اسم الدوري *" full><Inp value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="مثال: دوري فيفا الشتوي" /></Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label="نوع اللعبة"><Sel value={f.game} onChange={e => setF({ ...f, game: e.target.value })}>{GAME_TYPES.map(g => <option key={g}>{g}</option>)}</Sel></Field>
              <Field label="حجم القرعة"><Sel value={f.size} onChange={e => setF({ ...f, size: e.target.value })}><option value="4">4 مشتركين</option><option value="8">8 مشتركين</option><option value="16">16 مشتركاً</option></Sel></Field>
              <Field label="تاريخ البدء"><Inp type="date" value={f.startDate} onChange={e => setF({ ...f, startDate: e.target.value })} /></Field>
              <Field label="الجائزة (اختياري)"><Inp value={f.prize} onChange={e => setF({ ...f, prize: e.target.value })} placeholder="مثال: كأس + 100 د.ل" /></Field>
            </div>
            <div style={{ fontSize: 11, color: C.mt, margin: "4px 0 12px", lineHeight: 1.7 }}>بعد الإنشاء، سجّل المشتركين ثم اضغط «إجراء القرعة» لبدء الدوري تلقائياً بأدوار عشوائية (ربع نهائي/نصف نهائي/نهائي حسب العدد).</div>
            <div style={{ display: "flex", gap: 8 }}><Btn gold onClick={createTournament} style={{ flex: 1, justifyContent: "center" }}>✓ إنشاء</Btn><Btn onClick={() => setModal(false)}>إلغاء</Btn></div>
          </Modal>
        )}
      </>
    );
  }

  /* ---------- تفاصيل دوري محدد ---------- */
  const labels = t.rounds ? roundLabels(t.rounds.length) : [];
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "1rem", flexWrap: "wrap" }}>
        <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: C.mt, display: "flex", alignItems: "center", gap: 4 }}>→ رجوع للدوريات</button>
      </div>
      <PageTop title={t.name} action={
        <div style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap" }}>
          {t.status !== "تسجيل" && <>
            <Btn sm onClick={printParticipants}>🖨 سجل المشتركين</Btn>
            <Btn sm onClick={printMatches}>🖨 قائمة المباريات</Btn>
          </>}
          <Badge tone={STATUS_TONE[t.status]}>{t.status}</Badge>
        </div>
      } />
      <div style={{ fontSize: 12.5, color: C.mt, marginBottom: 14 }}>{t.game} · بدأ {arDate(t.startDate)} · {t.size} مقاعد{t.prize ? ` · 🎁 ${t.prize}` : ""}</div>

      {t.status === "منتهية" && t.champion && (
        <div style={{ background: "linear-gradient(135deg,#fff7eb,#fffdf5)", border: `1.5px solid ${C.gold}`, borderRadius: 16, padding: "1.4rem", textAlign: "center", marginBottom: "1.2rem" }}>
          <div style={{ fontSize: 42 }}>🏆</div>
          <div style={{ fontSize: 12, color: C.mt, marginTop: 4 }}>بطل الدوري</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: C.grn2, marginTop: 2 }}>{pName(t.champion)}</div>
          {t.runnerUp && <div style={{ fontSize: 12.5, color: C.mt, marginTop: 8 }}>🥈 الوصيف: <b>{pName(t.runnerUp)}</b></div>}
        </div>
      )}

      {t.status === "تسجيل" && (
        <div style={{ display: "grid", gridTemplateColumns: ctx.scr?.isTab ? "1fr" : "1fr 1.3fr", gap: 12 }}>
          <Card>
            <CardHead title="تسجيل مشترك جديد" sub={`${t.participants.length} / ${t.size}`} />
            <Field label="اسم المشترك"><Inp value={pf.name} onChange={e => setPf({ ...pf, name: e.target.value })} onKeyDown={e => e.key === "Enter" && addParticipant()} placeholder="الاسم الكامل" /></Field>
            <Field label="رقم الهاتف (اختياري)"><Inp value={pf.phone} onChange={e => setPf({ ...pf, phone: e.target.value })} placeholder="0913-000-000" /></Field>
            <Btn gold onClick={addParticipant} style={{ width: "100%", justifyContent: "center", marginBottom: 10 }}>+ إضافة للقائمة</Btn>
            <Btn onClick={startDraw} style={{ width: "100%", justifyContent: "center", background: "linear-gradient(135deg,#1a8c3e,#146830)", color: "#fff", border: "none" }}>🎲 إجراء القرعة وبدء الدوري</Btn>
          </Card>
          <Card>
            <CardHead title="المشتركون المسجَّلون" sub={`${t.participants.length} مشترك`} />
            {t.participants.length === 0 ? <div style={{ textAlign: "center", color: C.mt, fontSize: 12.5, padding: "1.5rem" }}>لا مشتركون بعد.</div> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {t.participants.map((p, i) => (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: C.crm, borderRadius: 8, padding: ".5rem .75rem" }}>
                    <span style={{ fontSize: 12.5 }}>{i + 1}. {p.name} {p.phone && <span style={{ color: C.mt, fontSize: 11 }}>— {p.phone}</span>}</span>
                    <button onClick={() => removeParticipant(p.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.red, fontSize: 12 }}>حذف</button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {t.rounds && (t.status === "جارٍ" || t.status === "منتهية") && (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {t.rounds.map((round, ri) => (
            <div key={ri}>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.grn2, marginBottom: 9, display: "flex", alignItems: "center", gap: 7 }}>
                <span>{ri === t.rounds.length - 1 ? "🏆" : ri === t.rounds.length - 2 ? "🥈" : "⚔️"}</span>{labels[ri]}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 10 }}>
                {round.map((m, mi) => {
                  const key = `${ri}-${mi}`;
                  const p1Name = pName(m.p1), p2Name = pName(m.p2);
                  const ready = m.p1 && m.p2 && m.status === "pending";
                  const sc = scoreInputs[key] || {};
                  return (
                    <div key={m.id} style={{ border: `1px solid ${m.status === "done" || m.status === "bye" ? "rgba(26,140,62,.3)" : C.bc}`, borderRadius: 12, padding: ".7rem .85rem", background: m.status === "done" || m.status === "bye" ? "#f4faf5" : C.cd }}>
                      {[["p1", m.p1, p1Name], ["p2", m.p2, p2Name]].map(([side, pid, nm]) => (
                        <div key={side} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 0", opacity: pid ? 1 : .5 }}>
                          <span style={{ fontSize: 12.5, fontWeight: m.winner === pid ? 800 : 500, color: m.winner === pid ? C.grn2 : C.k2 }}>{m.winner === pid && "✓ "}{nm}</span>
                          {ready ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                              <input type="number" placeholder="-" value={side === "p1" ? (sc.s1 ?? "") : (sc.s2 ?? "")} onChange={e => setScoreInputs(s => ({ ...s, [key]: { ...sc, [side === "p1" ? "s1" : "s2"]: e.target.value } }))} style={{ width: 34, fontSize: 11, textAlign: "center", border: `0.5px solid ${C.bc}`, borderRadius: 5, padding: "2px" }} />
                              <button onClick={() => decideWinner(ri, mi, pid)} style={{ fontSize: 10.5, fontWeight: 700, background: C.grl, color: "#fff", border: "none", borderRadius: 6, padding: "3px 7px", cursor: "pointer" }}>فوز</button>
                            </div>
                          ) : m.status !== "pending" && m.winner === pid ? <span style={{ fontSize: 10.5, color: "#1a8c3e" }}>{m.status === "bye" ? "تأهّل تلقائياً" : "فائز"}</span> : null}
                        </div>
                      ))}
                      {(!m.p1 || !m.p2) && m.status === "pending" && <div style={{ fontSize: 10.5, color: C.mt, textAlign: "center", marginTop: 4 }}>بانتظار نتيجة الدور السابق...</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 16 }}><button onClick={() => deleteTournament(t.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.red, fontSize: 12 }}>🗑 حذف هذا الدوري</button></div>
    </>
  );
}
