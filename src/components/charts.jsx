import { C, fmt } from "../constants/theme.js";

export function MiniBars({ data, max, color }) {
  return (
    <svg viewBox="0 0 300 120" style={{ width: "100%", height: 120 }}>
      {data.map((d, i) => {
        const h = (d / max) * 90;
        const x = 20 + i * 46;
        return <g key={i}>
          <rect x={x} y={100 - h} width={28} height={h} rx={4} fill={color} className="nk-bar-grow" style={{ transformOrigin: `${x + 14}px 100px`, animationDelay: `${i * 55}ms` }} />
        </g>;
      })}
      <line x1="10" y1="100" x2="290" y2="100" stroke={C.bc} strokeWidth="1" />
    </svg>
  );
}
export function Donut({ segments, size = 150 }) {
  const total = segments.reduce((s, x) => s + x.v, 0);
  let acc = 0; const r = 52, cx = size / 2, cy = size / 2, sw = 22;
  const circumference = 2 * Math.PI * r;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} style={{ width: size, height: size }}>
      {segments.map((seg, i) => {
        const frac = seg.v / total;
        const start = acc * 2 * Math.PI - Math.PI / 2;
        acc += frac;
        const end = acc * 2 * Math.PI - Math.PI / 2;
        const large = frac > 0.5 ? 1 : 0;
        const x1 = cx + r * Math.cos(start), y1 = cy + r * Math.sin(start);
        const x2 = cx + r * Math.cos(end), y2 = cy + r * Math.sin(end);
        const len = Math.max(0.01, frac * circumference);
        return <path key={i} d={`M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`} fill="none" stroke={seg.c} strokeWidth={sw}
          className="nk-donut-seg" style={{ strokeDasharray: len, "--nk-len": len + "px", animationDelay: `${i * 140}ms` }} />;
      })}
    </svg>
  );
}

export function CompareBarChart({ data, labelA, labelB, colorA, colorB, cur }) {
  const max = Math.max(1, ...data.map(d => Math.max(d.a, d.b)));
  const H = 190, barW = 22, gap = 10, groupGap = 34;
  const W = data.length * (barW * 2 + gap + groupGap) + 20;
  return (
    <div style={{ overflowX: "auto" }}>
      <svg viewBox={`0 0 ${Math.max(W, 320)} ${H + 46}`} style={{ width: "100%", minWidth: 320, height: H + 46 }}>
        {[0, 0.25, 0.5, 0.75, 1].map((f, i) => (
          <line key={i} x1={10} x2={W - 10} y1={H - f * (H - 30) + 6} y2={H - f * (H - 30) + 6} stroke={C.bc} strokeWidth="1" />
        ))}
        {data.map((d, i) => {
          const gx = 20 + i * (barW * 2 + gap + groupGap);
          const ha = (d.a / max) * (H - 30), hb = (d.b / max) * (H - 30);
          return (
            <g key={i}>
              <rect x={gx} y={H - ha + 6} width={barW} height={Math.max(ha, 1)} rx={4} fill={colorA} className="nk-bar-grow" style={{ transformOrigin: `${gx + barW / 2}px ${H + 6}px`, animationDelay: `${i * 70}ms` }} />
              <rect x={gx + barW + gap} y={H - hb + 6} width={barW} height={Math.max(hb, 1)} rx={4} fill={colorB} className="nk-bar-grow" style={{ transformOrigin: `${gx + barW + gap + barW / 2}px ${H + 6}px`, animationDelay: `${i * 70 + 40}ms` }} />
              <text x={gx + barW + gap / 2} y={H + 26} textAnchor="middle" fontSize="11" fill={C.mt} fontFamily="Tajawal,sans-serif">{d.label}</text>
            </g>
          );
        })}
      </svg>
      <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 6 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: C.k2 }}><i style={{ width: 10, height: 10, borderRadius: 3, background: colorA, display: "inline-block" }} />{labelA}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: C.k2 }}><i style={{ width: 10, height: 10, borderRadius: 3, background: colorB, display: "inline-block" }} />{labelB}</span>
      </div>
    </div>
  );
}

// خط اتجاه مزدوج (الشهر الحالي مقابل الماضي) — مساحة مملوءة للحالي وخط متقطع للماضي
export function TrendChart({ curSeries, prevSeries, colorA, colorB }) {
  const W = 640, H = 190, pad = 8;
  const allVals = [...curSeries, ...prevSeries].filter(v => v != null);
  const max = Math.max(1, ...allVals);
  const n = Math.max(curSeries.length, prevSeries.length);
  const x = (i) => pad + (i / (n - 1)) * (W - pad * 2);
  const y = (v) => H - pad - (v / max) * (H - pad * 2 - 10);

  const pathFor = (series, close) => {
    const pts = series.map((v, i) => (v == null ? null : [x(i), y(v)])).filter(Boolean);
    if (pts.length === 0) return "";
    let d = `M ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) d += ` L ${pts[i][0]} ${pts[i][1]}`;
    if (close && pts.length) d += ` L ${pts[pts.length - 1][0]} ${H - pad} L ${pts[0][0]} ${H - pad} Z`;
    return d;
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: H }}>
      {[0.25, 0.5, 0.75, 1].map((f, i) => <line key={i} x1={pad} x2={W - pad} y1={pad + f * (H - pad * 2 - 10)} y2={pad + f * (H - pad * 2 - 10)} stroke={C.bc} strokeWidth="1" />)}
      <path d={pathFor(curSeries, true)} fill={colorA + "22"} stroke="none" />
      <path d={pathFor(prevSeries, false)} fill="none" stroke={colorB} strokeWidth="2" strokeDasharray="5 4" opacity=".85" />
      <path d={pathFor(curSeries, false)} fill="none" stroke={colorA} strokeWidth="2.5" className="nk-trend-draw" style={{ strokeDasharray: 2000, "--nk-tlen": "2000px" }} />
    </svg>
  );
}

// أعمدة أفقية مرتّبة (تصنيف)
export function RankBarChart({ data, color, cur }) {
  const max = Math.max(1, ...data.map(d => d.value));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {data.map((d, i) => (
        <div key={i}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
            <span style={{ fontWeight: 600 }}>{i === 0 ? "🥇 " : i === 1 ? "🥈 " : i === 2 ? "🥉 " : ""}{d.label}</span>
            <span style={{ color: C.mt }}>{fmt(d.value)} {cur}</span>
          </div>
          <div style={{ height: 8, borderRadius: 4, background: C.crm, overflow: "hidden" }}>
            <div className="nk-bar-grow-x" style={{ width: (d.value / max * 100) + "%", height: "100%", background: color, transformOrigin: "right", animationDelay: `${i * 80}ms` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
