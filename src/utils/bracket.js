/* ---------- الدوريات والمسابقات: أدوات القرعة والتقدّم ---------- */
export const nextPow2 = (n) => { let p = 2; while (p < n) p *= 2; return p; };
export const shuffleArr = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; } return a; };
export const ROUND_LABELS = {
  1: ["النهائي"],
  2: ["نصف النهائي", "النهائي"],
  3: ["ربع النهائي", "نصف النهائي", "النهائي"],
  4: ["دور الـ16", "ربع النهائي", "نصف النهائي", "النهائي"],
};
export const roundLabels = (n) => ROUND_LABELS[n] || Array.from({ length: n }, (_, i) => `الدور ${i + 1}`);

// بناء القرعة الأولى: تقسيم عشوائي + تمرير تلقائي (Bye) عند عدم اكتمال العدد
export function buildBracket(participants, size) {
  const shuffled = shuffleArr(participants);
  const totalRounds = Math.log2(size);
  const rounds = [];
  const r0count = size / 2;
  const r0 = [];
  for (let i = 0; i < r0count; i++) {
    const p1 = shuffled[i * 2] || null;
    const p2 = shuffled[i * 2 + 1] || null;
    let winner = null, status = "pending";
    if (p1 && !p2) { winner = p1.id; status = "bye"; }
    else if (!p1 && p2) { winner = p2.id; status = "bye"; }
    r0.push({ id: `r0m${i}`, p1: p1 ? p1.id : null, p2: p2 ? p2.id : null, score1: null, score2: null, winner, status });
  }
  rounds.push(r0);
  for (let r = 1; r < totalRounds; r++) {
    const count = size / Math.pow(2, r + 1);
    const round = [];
    for (let i = 0; i < count; i++) round.push({ id: `r${r}m${i}`, p1: null, p2: null, score1: null, score2: null, winner: null, status: "pending" });
    rounds.push(round);
  }
  // مرّر الفائزين التلقائيين (bye) للدور التالي
  for (let r = 0; r < rounds.length - 1; r++) {
    rounds[r].forEach((m, i) => {
      if (m.winner) {
        const next = rounds[r + 1][Math.floor(i / 2)];
        if (i % 2 === 0) next.p1 = m.winner; else next.p2 = m.winner;
      }
    });
  }
  return rounds;
}

// تسجيل فائز مباراة وتمريره تلقائياً للدور التالي؛ يعيد { rounds, champion, runnerUp }
export function setMatchWinner(rounds, roundIdx, matchIdx, winnerId, s1, s2) {
  const cloned = rounds.map(r => r.map(m => ({ ...m })));
  const match = cloned[roundIdx][matchIdx];
  match.winner = winnerId; match.status = "done";
  match.score1 = s1 === "" || s1 == null ? null : Number(s1);
  match.score2 = s2 === "" || s2 == null ? null : Number(s2);
  if (roundIdx + 1 < cloned.length) {
    const next = cloned[roundIdx + 1][Math.floor(matchIdx / 2)];
    if (matchIdx % 2 === 0) next.p1 = winnerId; else next.p2 = winnerId;
  }
  let champion = null, runnerUp = null;
  const last = cloned[cloned.length - 1];
  if (last.length === 1 && last[0].winner) {
    champion = last[0].winner;
    runnerUp = last[0].p1 === champion ? last[0].p2 : last[0].p1;
  }
  return { rounds: cloned, champion, runnerUp };
}
