import { useState, useRef } from "react";
import { C, fmt } from "../constants/theme.js";
import { useMotion, gsap, EASE, D } from "../utils/motion.js";
import AnimatedNumber from "./AnimatedNumber.jsx";

/* =========================================================================
   طبقة تلميح مشتركة لكل الرسوم — تلميح واحد لكل عنصر عند المرور أو التركيز
   بلوحة المفاتيح (لإتاحة نفس التفاصيل لمستخدمي لوحة المفاتيح وقارئات الشاشة)،
   بلا حجب أي قيمة (التسميات المباشرة والقيم المئوية تبقى ظاهرة دون الحاجة للتلميح.
   ========================================================================= */
function useChartTip() {
  const boxRef = useRef(null);
  const [tip, setTip] = useState(null); // { x, y, content }
  const showAtPoint = (clientX, clientY, content) => {
    const rect = boxRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTip({ x: clientX - rect.left, y: clientY - rect.top, content });
  };
  const showAtRect = (targetRect, content) => {
    const rect = boxRef.current?.getBoundingClientRect();
    if (!rect || !targetRect) return;
    setTip({ x: targetRect.left - rect.left + targetRect.width / 2, y: targetRect.top - rect.top, content });
  };
  const hide = () => setTip(null);
  return { boxRef, tip, showAtPoint, showAtRect, hide };
}

function ChartTip({ tip }) {
  if (!tip) return null;
  return (
    <div role="tooltip" style={{
      position: "absolute", left: tip.x, top: tip.y, transform: "translate(-50%, calc(-100% - 10px))",
      background: "rgba(20,20,18,.94)", color: "#fff", borderRadius: 8, padding: "5px 10px",
      fontSize: 11.5, lineHeight: 1.7, whiteSpace: "nowrap", pointerEvents: "none", zIndex: 30,
      boxShadow: "0 8px 22px rgba(0,0,0,.3)",
    }}>{tip.content}</div>
  );
}

/* =========================================================================
   مبدأ الحركة في هذه الرسوم: React يرسم دائماً الحالة النهائية الصحيحة، وGSAP
   ينقل العنصر بصرياً من قيمته السابقة إلى الجديدة. لذلك نحتفظ بالأبعاد
   المعروضة سابقاً في ref — بلا هذا كانت الأعمدة تقفز فجأة عند تغيير النطاق
   الزمني أو نوع التقرير، لأن حركات CSS @keyframes تعمل عند التركيب مرة واحدة
   فقط ولا تُعاد عند تغيّر البيانات.
   ========================================================================= */

export { default as AnimatedNumber } from "./AnimatedNumber.jsx";

/* ---------- أعمدة صغيرة (اتجاه يومي) — مع خط مرجعي متقطع اختياري لمقارنة الأسبوع الماضي ---------- */
// نصف السعة البصرية لخط الربح حول خط الأساس (y=100) — يبقيه ضمن نفس viewBox
// الحالي (0 0 300 120) بلا حاجة لتوسيعه: يتأرجح بين y=85 (أعلى ربح) وy=115 (أعلى خسارة)
const PROFIT_SWING = 15;

export function MiniBars({ data, prevData, max, color, labels, cur, profitData }) {
  const { boxRef, tip, showAtRect, hide } = useChartTip();
  const [hoverI, setHoverI] = useState(null);
  const lastI = data.length - 1;
  const heights = data.map(d => Math.max((d / max) * 90, 1));
  const prevHeightsRef = useRef(null);
  const profitPathRef = useRef(null);

  // مقياس خط الربح مستقل عن مقياس الأعمدة (الإيراد لا يكون سالباً، والربح قد يكون)
  const profitMax = profitData ? Math.max(1, ...profitData.map(v => Math.abs(v))) : 1;
  const profitY = (v) => 100 - (v / profitMax) * PROFIT_SWING;
  const profitPoints = profitData ? profitData.map((v, i) => [20 + i * 46 + 14, profitY(v)]) : null;
  const profitPath = profitPoints ? profitPoints.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x} ${y}`).join(" ") : "";

  useMotion((m) => {
    const prev = prevHeightsRef.current;
    prevHeightsRef.current = heights;
    const bars = gsap.utils.toArray(".nk-mb-bar", boxRef.current);
    bars.forEach((el, i) => {
      if (!prev) {
        // أول ظهور: ينمو العمود من خط الأساس
        gsap.from(el, { scaleY: 0, transformOrigin: "50% 100%", duration: m.d(D.slow), delay: m.d(i * 0.055), ease: EASE, willChange: "transform", clearProps: "willChange" });
      } else {
        // تغيّر البيانات: ينتقل من ارتفاعه المعروض سابقاً إلى الجديد
        gsap.fromTo(el, { scaleY: (prev[i] ?? 0) / heights[i] },
          { scaleY: 1, transformOrigin: "50% 100%", duration: m.d(D.slow), ease: EASE, overwrite: "auto", willChange: "transform", clearProps: "willChange" });
      }
    });

    // خط الربح: يُكشَف بنفس أسلوب TrendChart (getTotalLength بدل رقم ثابت) — شكله
    // يتغيّر كاملاً مع تغيّر أي قيمة (لا مجرد ارتفاع)، فالكشف التدريجي أوضح من
    // محاولة تحريك رؤوس مضلَّع بين مجموعتي نقاط مختلفتين.
    const path = profitPathRef.current;
    if (path && profitPoints) {
      const points = gsap.utils.toArray(".nk-mb-profit-pt", boxRef.current);
      if (m.enabled) {
        const len = path.getTotalLength() || 1;
        gsap.fromTo(path, { strokeDasharray: len, strokeDashoffset: len },
          { strokeDashoffset: 0, duration: m.d(D.slow), ease: EASE, overwrite: "auto",
            onComplete: () => { path.style.strokeDasharray = "none"; } });
        gsap.from(points, { scale: 0, transformOrigin: "center", duration: m.d(0.25), delay: m.d(D.slow * 0.6), stagger: m.d(0.04), ease: "back.out(1.7)", overwrite: "auto" });
      } else {
        path.style.strokeDasharray = "none";
      }
    }
  }, { scope: boxRef, dependencies: [heights.join(","), profitData?.join(",")] });

  return (
    <div ref={boxRef} style={{ position: "relative" }}>
      <div style={{ position: "absolute", top: 0, right: 2, fontSize: 9.5, color: C.mt }}>{fmt(max)}</div>
      <svg viewBox="0 0 300 120" style={{ width: "100%", height: 120 }} role="img" aria-label={`رسم بياني: ${data.map((d, i) => `${labels?.[i] ?? i + 1}: ${fmt(d)}`).join("، ")}${profitData ? ` — الربح الصافي: ${profitData.map((p, i) => `${labels?.[i] ?? i + 1}: ${fmt(p)}`).join("، ")}` : ""}`}>
        {data.map((d, i) => {
          const h = heights[i];
          const x = 20 + i * 46;
          const isToday = i === lastI;
          const label = labels?.[i] ?? String(i + 1);
          const prevH = prevData?.[i] ? (prevData[i] / max) * 90 : null;
          const profitTxt = profitData ? ` — ${profitData[i] < 0 ? "خسارة" : "ربح"}: ${fmt(profitData[i])}${cur ? " " + cur : ""}` : "";
          const tipText = (prevData ? `${label} — ${fmt(d)}${cur ? " " + cur : ""} (الأسبوع الماضي: ${fmt(prevData[i] || 0)}${cur ? " " + cur : ""})` : `${label} — ${fmt(d)}${cur ? " " + cur : ""}`) + profitTxt;
          return (
            <g key={i}
              tabIndex={0} role="button" aria-label={tipText} style={{ cursor: "pointer" }}
              onMouseEnter={(e) => { setHoverI(i); showAtRect(e.currentTarget.getBoundingClientRect(), tipText); }}
              onMouseLeave={() => { setHoverI(null); hide(); }}
              onFocus={(e) => { setHoverI(i); showAtRect(e.currentTarget.getBoundingClientRect(), tipText); }}
              onBlur={() => { setHoverI(null); hide(); }}>
              {/* منطقة تحسّس كامل العمود شفافة تحت العمود المرئي — بلا هذه، عمود
                  قصير مع نقطة ربح مرتفعة/منخفضة عنه لا يستقبل تحويماً في مساحة النقطة
                  لأن تحسّس <g> محصور بمساحة عناصره المرسومة فعلياً لا العمود بكامله */}
              {profitData && <rect x={x - 4} y={0} width={36} height={120} fill="transparent" />}
              <rect className="nk-mb-bar" x={x} y={100 - h} width={28} height={h} rx={4}
                fill={color} opacity={hoverI === null || hoverI === i ? 1 : .55}
                stroke={isToday ? C.gold : "none"} strokeWidth={isToday ? 2 : 0} />
              {prevH !== null && prevH > 0 && (
                <line x1={x - 3} x2={x + 31} y1={100 - prevH} y2={100 - prevH} stroke={C.mt} strokeWidth="1.5" strokeDasharray="3 2" opacity=".8" />
              )}
            </g>
          );
        })}
        <line x1="10" y1="100" x2="290" y2="100" stroke={C.bc} strokeWidth="1" />
        {profitPoints && (
          <>
            <path ref={profitPathRef} d={profitPath} fill="none" stroke={C.gold} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            {profitPoints.map(([x, y], i) => (
              <circle key={i} className="nk-mb-profit-pt" cx={x} cy={y} r={hoverI === i ? 4.5 : 3.5}
                fill={profitData[i] < 0 ? C.red : C.gold} stroke={C.cd} strokeWidth="1.5" opacity={hoverI === null || hoverI === i ? 1 : .55} />
            ))}
          </>
        )}
      </svg>
      <ChartTip tip={tip} />
    </div>
  );
}

/* ---------- دونات (توزيع نسبي) ----------
   كل شريحة دائرة كاملة يُقتطع منها قوس عبر stroke-dasharray بدل مسار قوس
   محسوب بالمثلثات. الفارق جوهري لا تجميلي: الانتقال بين توزيعين يصبح تحريك
   رقمين (طول القوس وإزاحته) بدل تحويل مسار إلى مسار — وهذا الأخير يتطلّب
   MorphSVG ولا يمكن تحريكه بلا إضافة. كما يُغني هذا عن حساب large-arc-flag. */
export function Donut({ segments, size = 150, cur }) {
  const { boxRef, tip, showAtRect, hide } = useChartTip();
  const [hoverI, setHoverI] = useState(null);
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = 52, cx = size / 2, cy = size / 2, sw = 22;
  const circumference = 2 * Math.PI * r;

  // [طول القوس، إزاحة البداية] لكل شريحة بترتيب ظهورها
  const arcs = [];
  let acc = 0;
  segments.forEach(seg => {
    const len = (seg.value / total) * circumference;
    arcs.push([len, acc]);
    acc += len;
  });
  const prevArcsRef = useRef(null);

  useMotion((m) => {
    const prev = prevArcsRef.current;
    prevArcsRef.current = arcs;
    const paths = gsap.utils.toArray(".nk-donut-arc", boxRef.current);
    paths.forEach((el, i) => {
      const [toLen, toOff] = arcs[i];
      // نقطة الانطلاق: القوس المعروض سابقاً إن وُجد، وإلا صفر (يُرسم من العدم)
      const [fromLen, fromOff] = prev?.[i] ?? [0, toOff];
      const apply = (len, off) => {
        el.setAttribute("stroke-dasharray", `${len} ${circumference - len}`);
        el.setAttribute("stroke-dashoffset", String(-off));
      };
      if (!m.enabled) { apply(toLen, toOff); return; }
      const proxy = { len: fromLen, off: fromOff };
      gsap.to(proxy, {
        len: toLen, off: toOff, duration: m.d(D.slow), ease: EASE, overwrite: "auto",
        delay: prev ? 0 : m.d(i * 0.12), // تتابع لطيف عند أول ظهور فقط
        onUpdate: () => apply(proxy.len, proxy.off),
        onComplete: () => apply(toLen, toOff),
      });
      if (!prev) apply(0, toOff); // تجنّب وميض القوس الكامل قبل انطلاق الحركة
    });
  }, { scope: boxRef, dependencies: [arcs.map(a => a.join(":")).join(",")] });

  return (
    <div ref={boxRef} style={{ position: "relative", display: "inline-block" }}>
      <svg viewBox={`0 0 ${size} ${size}`} style={{ width: size, height: size }} role="img" aria-label={`توزيع: ${segments.map(s => `${s.label} ${s.pct}%`).join("، ")}`}>
        <g transform={`rotate(-90 ${cx} ${cy})`}>
          {segments.map((seg, i) => (
            /* dasharray/dashoffset لا تُمرَّر من React عمداً: GSAP يملك هندسة
               القوس وحده، فلا يُعيد رندر React (تغيّر التحويم مثلاً) كتابتها
               فوق حركة جارية. القيمة الثابتة هنا تبقى كما هي بين الرندرات. */
            <circle key={i} className="nk-donut-arc" cx={cx} cy={cy} r={r} fill="none"
              stroke={seg.color} strokeWidth={hoverI === i ? sw + 4 : sw}
              strokeDasharray="0 100000"
              opacity={hoverI === null || hoverI === i ? 1 : .55}
              style={{ cursor: "pointer", transition: "stroke-width .12s ease" }}
              tabIndex={0} role="button" aria-label={`${seg.label}: ${fmt(seg.value)}${cur ? " " + cur : ""} — ${seg.pct}%`}
              onMouseEnter={(e) => { setHoverI(i); showAtRect(e.currentTarget.getBoundingClientRect(), `${seg.label} — ${fmt(seg.value)}${cur ? " " + cur : ""} (${seg.pct}%)`); }}
              onMouseLeave={() => { setHoverI(null); hide(); }}
              onFocus={(e) => { setHoverI(i); showAtRect(e.currentTarget.getBoundingClientRect(), `${seg.label} — ${fmt(seg.value)}${cur ? " " + cur : ""} (${seg.pct}%)`); }}
              onBlur={() => { setHoverI(null); hide(); }}
            />
          ))}
        </g>
      </svg>
      <ChartTip tip={tip} />
    </div>
  );
}

export function CompareBarChart({ data, labelA, labelB, colorA, colorB, cur }) {
  const { boxRef, tip, showAtRect, hide } = useChartTip();
  const [hover, setHover] = useState(null); // { i, series }
  const max = Math.max(1, ...data.map(d => Math.max(d.a, d.b)));
  const H = 190, barW = 22, gap = 10, groupGap = 34;
  const W = data.length * (barW * 2 + gap + groupGap) + 20;
  const hA = data.map(d => Math.max((d.a / max) * (H - 30), 1));
  const hB = data.map(d => Math.max((d.b / max) * (H - 30), 1));
  const prevRef = useRef(null);

  useMotion((m) => {
    const prev = prevRef.current;
    prevRef.current = { hA, hB };
    const run = (sel, heights, prevHeights, offset) => {
      gsap.utils.toArray(sel, boxRef.current).forEach((el, i) => {
        if (!prevHeights) {
          gsap.from(el, { scaleY: 0, transformOrigin: "50% 100%", duration: m.d(D.slow), delay: m.d(i * 0.07 + offset), ease: EASE, willChange: "transform", clearProps: "willChange" });
        } else {
          gsap.fromTo(el, { scaleY: (prevHeights[i] ?? 0) / heights[i] },
            { scaleY: 1, transformOrigin: "50% 100%", duration: m.d(D.slow), ease: EASE, overwrite: "auto", willChange: "transform", clearProps: "willChange" });
        }
      });
    };
    run(".nk-cmp-a", hA, prev?.hA, 0);
    run(".nk-cmp-b", hB, prev?.hB, 0.04);
  }, { scope: boxRef, dependencies: [hA.join(",") + "|" + hB.join(",")] });

  return (
    <div ref={boxRef} style={{ position: "relative" }}>
      <div style={{ overflowX: "auto" }}>
        <svg viewBox={`0 0 ${Math.max(W, 320)} ${H + 46}`} style={{ width: "100%", minWidth: 320, height: H + 46 }} role="img" aria-label={`مقارنة ${labelA} و${labelB}: ${data.map(d => `${d.label} — ${fmt(d.a)} / ${fmt(d.b)}`).join("، ")}`}>
          {[0, 0.25, 0.5, 0.75, 1].map((f, i) => (
            <line key={i} x1={10} x2={W - 10} y1={H - f * (H - 30) + 6} y2={H - f * (H - 30) + 6} stroke={C.bc} strokeWidth="1" />
          ))}
          {data.map((d, i) => {
            const gx = 20 + i * (barW * 2 + gap + groupGap);
            const ha = hA[i], hb = hB[i];
            const dim = (s) => hover && !(hover.i === i && hover.series === s) ? .55 : 1;
            return (
              <g key={i}>
                <rect className="nk-cmp-a" x={gx} y={H - ha + 6} width={barW} height={ha} rx={4} fill={colorA} opacity={dim("a")}
                  style={{ cursor: "pointer" }}
                  tabIndex={0} role="button" aria-label={`${d.label} — ${labelA}: ${fmt(d.a)}${cur ? " " + cur : ""}`}
                  onMouseEnter={(e) => { setHover({ i, series: "a" }); showAtRect(e.currentTarget.getBoundingClientRect(), `${d.label} — ${labelA}: ${fmt(d.a)}${cur ? " " + cur : ""}`); }}
                  onMouseLeave={() => { setHover(null); hide(); }}
                  onFocus={(e) => { setHover({ i, series: "a" }); showAtRect(e.currentTarget.getBoundingClientRect(), `${d.label} — ${labelA}: ${fmt(d.a)}${cur ? " " + cur : ""}`); }}
                  onBlur={() => { setHover(null); hide(); }}
                />
                <rect className="nk-cmp-b" x={gx + barW + gap} y={H - hb + 6} width={barW} height={hb} rx={4} fill={colorB} opacity={dim("b")}
                  style={{ cursor: "pointer" }}
                  tabIndex={0} role="button" aria-label={`${d.label} — ${labelB}: ${fmt(d.b)}${cur ? " " + cur : ""}`}
                  onMouseEnter={(e) => { setHover({ i, series: "b" }); showAtRect(e.currentTarget.getBoundingClientRect(), `${d.label} — ${labelB}: ${fmt(d.b)}${cur ? " " + cur : ""}`); }}
                  onMouseLeave={() => { setHover(null); hide(); }}
                  onFocus={(e) => { setHover({ i, series: "b" }); showAtRect(e.currentTarget.getBoundingClientRect(), `${d.label} — ${labelB}: ${fmt(d.b)}${cur ? " " + cur : ""}`); }}
                  onBlur={() => { setHover(null); hide(); }}
                />
                <text x={gx + barW + gap / 2} y={H + 26} textAnchor="middle" fontSize="11" fill={C.mt} fontFamily="Tajawal,sans-serif">{d.label}</text>
              </g>
            );
          })}
        </svg>
      </div>
      <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 6 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: C.k2 }}><i style={{ width: 10, height: 10, borderRadius: 3, background: colorA, display: "inline-block" }} />{labelA}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: C.k2 }}><i style={{ width: 10, height: 10, borderRadius: 3, background: colorB, display: "inline-block" }} />{labelB}</span>
      </div>
      <ChartTip tip={tip} />
    </div>
  );
}

// خط اتجاه مزدوج (الشهر الحالي مقابل الماضي) — مساحة مملوءة للحالي وخط متقطع للماضي، مع خط تتبّع رأسي (crosshair)
export function TrendChart({ curSeries, prevSeries, colorA, colorB, cur }) {
  const { boxRef, tip, showAtPoint, hide } = useChartTip();
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

  const crossRef = useRef(null), dotARef = useRef(null), dotBRef = useRef(null);
  const curPathRef = useRef(null);
  const setters = useRef(null);
  const hoverIRef = useRef(null); // آخر فهرس نشط — الحارس الذي يمنع إعادة رندر لكل بكسل

  useMotion((m) => {
    // رسم خط الاتجاه: نقيس الطول الحقيقي بـ getTotalLength بدل الرقم الثابت 2000
    // الذي كان مستخدماً في CSS — كان يقصّر الرسم أو يطيله حسب طول المسار الفعلي.
    const path = curPathRef.current;
    if (path && m.enabled) {
      const len = path.getTotalLength();
      gsap.fromTo(path, { strokeDasharray: len, strokeDashoffset: len },
        { strokeDashoffset: 0, duration: m.d(1.0), ease: EASE, overwrite: "auto",
          onComplete: () => { path.style.strokeDasharray = "none"; } });
    } else if (path) {
      path.style.strokeDasharray = "none";
    }

    // خط التتبّع ونقاطه يتحرّكان بـ quickTo: تحريك مباشر للـ DOM بلا setState،
    // فينزلقان بين نقاط البيانات بدل القفز، وبلا إعادة رندر للمكوّن.
    // will-change دائم على هذه الثلاثة فقط — لا "كل عنصر تحسّباً": هي طبقة
    // التفاعل الوحيدة التي تتحرّك مع كل حركة فأرة طوال عمر الرسم المرئي.
    gsap.set([crossRef.current, dotARef.current, dotBRef.current], { willChange: "transform" });
    const dur = m.d(0.16);
    setters.current = {
      line: gsap.quickTo(crossRef.current, "x", { duration: dur, ease: "power3" }),
      ax: gsap.quickTo(dotARef.current, "x", { duration: dur, ease: "power3" }),
      ay: gsap.quickTo(dotARef.current, "y", { duration: dur, ease: "power3" }),
      bx: gsap.quickTo(dotBRef.current, "x", { duration: dur, ease: "power3" }),
      by: gsap.quickTo(dotBRef.current, "y", { duration: dur, ease: "power3" }),
    };
  }, { scope: boxRef, dependencies: [curSeries.join(","), prevSeries.join(",")] });

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * W;
    let i = Math.round(((relX - pad) / (W - pad * 2)) * (n - 1));
    i = Math.max(0, Math.min(n - 1, i));

    const s = setters.current;
    if (s) {
      gsap.set(crossRef.current, { autoAlpha: 1 });
      s.line(x(i));
      if (curSeries[i] != null) { s.ax(x(i)); s.ay(y(curSeries[i])); gsap.set(dotARef.current, { autoAlpha: 1 }); }
      else gsap.set(dotARef.current, { autoAlpha: 0 });
      if (prevSeries[i] != null) { s.bx(x(i)); s.by(y(prevSeries[i])); gsap.set(dotBRef.current, { autoAlpha: 1 }); }
      else gsap.set(dotBRef.current, { autoAlpha: 0 });
    }

    // التلميح يُحدَّث عند تغيّر نقطة البيانات فقط لا مع كل حركة فأرة — كان
    // يستدعي setState مرتين لكل بكسل، وهو السبب المباشر للتقطيع على اللوحي.
    if (hoverIRef.current === i) return;
    hoverIRef.current = i;
    const lines = [];
    if (curSeries[i] != null) lines.push(`هذا الشهر: ${fmt(curSeries[i])}${cur ? " " + cur : ""}`);
    if (prevSeries[i] != null) lines.push(`الشهر الماضي: ${fmt(prevSeries[i])}${cur ? " " + cur : ""}`);
    // موضع التلميح يُثبَّت على نقطة البيانات لا على المؤشر: أدقّ دلالةً، ويجعل
    // التحديث مرتبطاً بالفهرس وحده
    showAtPoint(rect.left + (x(i) / W) * rect.width, rect.top + pad, `يوم ${i + 1}\n${lines.join("\n")}`.split("\n").map((l, k) => <div key={k}>{l}</div>));
  };

  const onLeave = () => {
    hoverIRef.current = null;
    gsap.set([crossRef.current, dotARef.current, dotBRef.current], { autoAlpha: 0 });
    hide();
  };

  return (
    <div ref={boxRef} style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: H, cursor: "crosshair" }}
        role="img" aria-label="اتجاه الإيراد اليومي: الشهر الحالي مقابل الشهر الماضي"
        onMouseMove={onMove} onMouseLeave={onLeave}>
        {[0.25, 0.5, 0.75, 1].map((f, i) => <line key={i} x1={pad} x2={W - pad} y1={pad + f * (H - pad * 2 - 10)} y2={pad + f * (H - pad * 2 - 10)} stroke={C.bc} strokeWidth="1" />)}
        {[0.25, 0.5, 0.75, 1].map((f, i) => <text key={i} x={W - pad - 2} y={pad + f * (H - pad * 2 - 10) - 3} textAnchor="end" fontSize="9" fill={C.mt}>{fmt(Math.round(max * (1 - f)))}</text>)}
        <path d={pathFor(curSeries, true)} fill={colorA + "22"} stroke="none" />
        <path d={pathFor(prevSeries, false)} fill="none" stroke={colorB} strokeWidth="2" strokeDasharray="5 4" opacity=".85" />
        <path ref={curPathRef} d={pathFor(curSeries, false)} fill="none" stroke={colorA} strokeWidth="2.5" />
        {/* عناصر التتبّع مرسومة دائماً ومخفية، ويحرّكها GSAP — لا تُنشأ وتُزال مع كل حركة */}
        {/* الخط داخل <g>: عنصر <line> الرأسي عرض إطاره صفر، وGSAP يشتقّ التحويل
            من getBBox فلا يُطبَّق عليه شيء. المجموعة لها إطار صالح فتتحوّل بثقة. */}
        <g ref={crossRef} style={{ visibility: "hidden", opacity: 0 }}>
          <line x1={0} x2={0} y1={pad} y2={H - pad} stroke={C.mt} strokeWidth="1" strokeDasharray="3 3" />
        </g>
        <circle ref={dotARef} cx={0} cy={0} r="4" fill={colorA} stroke={C.cd} strokeWidth="2" style={{ visibility: "hidden", opacity: 0 }} />
        <circle ref={dotBRef} cx={0} cy={0} r="4" fill={colorB} stroke={C.cd} strokeWidth="2" style={{ visibility: "hidden", opacity: 0 }} />
      </svg>
      <ChartTip tip={tip} />
    </div>
  );
}

// أعمدة أفقية مرتّبة (تصنيف)
export function RankBarChart({ data, color, cur }) {
  const { boxRef, tip, showAtRect, hide } = useChartTip();
  const [hoverI, setHoverI] = useState(null);
  const max = Math.max(1, ...data.map(d => d.value));
  const pcts = data.map(d => Math.max(0, (d.value / max) * 100));
  const prevRef = useRef(null);

  useMotion((m) => {
    const prev = prevRef.current;
    prevRef.current = pcts;
    gsap.utils.toArray(".nk-rank-fill", boxRef.current).forEach((el, i) => {
      const to = Math.max(pcts[i], 0.001); // تفادي القسمة على صفر لصنف بلا قيمة
      if (!prev) {
        gsap.from(el, { scaleX: 0, transformOrigin: "right center", duration: m.d(D.slow), delay: m.d(i * 0.08), ease: EASE, willChange: "transform", clearProps: "willChange" });
      } else {
        gsap.fromTo(el, { scaleX: Math.max(prev[i] ?? 0, 0) / to },
          { scaleX: 1, transformOrigin: "right center", duration: m.d(D.slow), ease: EASE, overwrite: "auto", willChange: "transform", clearProps: "willChange" });
      }
    });
  }, { scope: boxRef, dependencies: [pcts.join(",")] });

  return (
    <div ref={boxRef} style={{ display: "flex", flexDirection: "column", gap: 10, position: "relative" }}>
      {data.map((d, i) => (
        <div key={i}
          tabIndex={0} role="button" aria-label={`${d.label}: ${fmt(d.value)}${cur ? " " + cur : ""}`}
          onMouseEnter={(e) => { setHoverI(i); showAtRect(e.currentTarget.getBoundingClientRect(), `${d.label} — ${fmt(d.value)}${cur ? " " + cur : ""}`); }}
          onMouseLeave={() => { setHoverI(null); hide(); }}
          onFocus={(e) => { setHoverI(i); showAtRect(e.currentTarget.getBoundingClientRect(), `${d.label} — ${fmt(d.value)}${cur ? " " + cur : ""}`); }}
          onBlur={() => { setHoverI(null); hide(); }}
          style={{ cursor: "pointer", opacity: hoverI === null || hoverI === i ? 1 : .7 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
            <span style={{ fontWeight: 600 }}>{i === 0 ? "🥇 " : i === 1 ? "🥈 " : i === 2 ? "🥉 " : ""}{d.label}</span>
            <span style={{ color: C.mt }}><AnimatedNumber value={d.value} /> {cur}</span>
          </div>
          <div style={{ height: 8, borderRadius: 4, background: C.crm, overflow: "hidden" }}>
            <div className="nk-rank-fill" style={{ width: pcts[i] + "%", height: "100%", background: color }} />
          </div>
        </div>
      ))}
      <ChartTip tip={tip} />
    </div>
  );
}
