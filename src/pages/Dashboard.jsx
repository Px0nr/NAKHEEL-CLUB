import { useMemo } from "react";
import { C, T, fmt } from "../constants/theme.js";
import { PageTop, Badge, Btn, KCard, Card, CardHead, Table } from "../components/ui.jsx";
import { MiniBars, Donut, RankBarChart } from "../components/charts.jsx";
import { categoryTotals, toSegments, pctDelta, profitOnDate, topItemsOnDate } from "../utils/analytics.js";
import { todayISO, daysBetween, arDate } from "../utils/format.js";

const EXPIRY_WARNING_DAYS = 14;

/* ============================ DASHBOARD ============================ */
export default function Dashboard({ ctx, go }) {
  const { totals, invoices, products, completedBookings, cats, settings, expenses, waste } = ctx;
  const cur = settings?.currency || "د.ل";
  const low = products.filter(p => p.stock !== null && p.min && p.stock < p.min);
  // منتجات تنتهي صلاحيتها قريباً (خلال 14 يوماً) أو انتهت فعلاً بالفعل — لا تظهر إن نفد المخزون أصلاً (لا قيمة عملية)
  const expiring = useMemo(() => {
    const today = todayISO();
    return products
      .filter(p => p.hasExp && p.exp && p.stock > 0)
      .map(p => ({ ...p, daysLeft: daysBetween(today, p.exp) }))
      .filter(p => p.daysLeft <= EXPIRY_WARNING_DAYS)
      .sort((a, b) => a.daysLeft - b.daysLeft);
  }, [products]);

  // آخر 7 أيام — إيراد فعلي من الفواتير المدفوعة. التواريخ تُبنى بتوقيت UTC لتطابق todayISO()
  // المستخدَمة عند إنشاء كل فاتورة (بناء التاريخ محلياً ثم تحويله لسلسلة UTC يزيح اليوم في أي منطقة زمنية غير +00:00)
  const last7 = useMemo(() => {
    const days = [], prevWeekDays = [], profit = [], labels = [];
    const dayName = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
    const now = new Date();
    const revOn = (iso) => invoices.filter(v => v.date === iso && v.status === "مدفوعة").reduce((s, v) => s + v.total, 0);
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
      const dPrev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i - 7));
      const iso = d.toISOString().split("T")[0];
      days.push(revOn(iso));
      prevWeekDays.push(revOn(dPrev.toISOString().split("T")[0]));
      profit.push(profitOnDate(iso, { invoices, expenses, waste }));
      labels.push(i === 0 ? "اليوم" : dayName[d.getUTCDay()]);
    }
    return { days, prevWeekDays, profit, labels, max: Math.max(1000, ...days, ...prevWeekDays) };
  }, [invoices, expenses, waste]);

  const todayISOv = new Date().toISOString().split("T")[0];
  const todayRev = invoices.filter(v => v.date === todayISOv && v.status === "مدفوعة").reduce((s, v) => s + v.total, 0);
  const todayCount = invoices.filter(v => v.date === todayISOv).length;
  // مقارنة إيراد اليوم بالأمس — last7.days[5] هو أمس دائماً (المصفوفة تنتهي باليوم عند الفهرس 6)
  const yesterdayRev = last7.days[5] ?? 0;
  const todayDelta = pctDelta(todayRev, yesterdayRev);

  // أفضل 5 أصناف بالإيراد اليوم — لا تشمل الحجوزات/التأجير الاصطناعية
  const topSellersToday = useMemo(() => topItemsOnDate(todayISOv, invoices, 5), [invoices, todayISOv]);

  // توزيع المبيعات حسب القسم — عبر الطبقة المركزية: يعتمد أقسام الأصناف الفعلية (items[].cat)
  // مع تراجع لمصدر الفاتورة للبيانات القديمة، بدل المطابقة النصية الهشّة السابقة
  const distSegments = useMemo(() => toSegments(categoryTotals(invoices.filter(v => v.status === "مدفوعة")), cats, settings?.dark), [invoices, cats, settings?.dark]);
  const distTotal = distSegments.reduce((s, seg) => s + seg.value, 0);

  // ألوان اللهجة (tone) لبطاقات المهام — نفس القاموس المستخدم في جرس التنبيهات، مركزي هنا لتفادي التكرار
  const TASK_TONE = {
    r:    { bg: "linear-gradient(135deg,#fdeaea,#fff)", border: "rgba(192,57,43,.3)", ink: "#922", btn: "danger" },
    a:    { bg: "linear-gradient(135deg,#fff6e6,#fff)", border: `${C.gold}66`, ink: C.gdd, btn: "gold" },
    gold: { bg: "linear-gradient(135deg,#fff6e6,#fff)", border: `${C.gold}66`, ink: C.gdd, btn: "gold" },
    b:    { bg: "linear-gradient(135deg,#eaf1fd,#fff)", border: "rgba(26,62,140,.25)", ink: C.blue, btn: "primary" },
  };
  const tasks = ctx.notifications || [];

  return (
    <>
      <PageTop title="لوحة التحكم" action={<Badge tone="gold">{new Date().toLocaleDateString("ar-LY")}</Badge>} />

      {/* مهام اليوم — لوحة موحّدة تجيب "ماذا أفعل الآن؟" بدل عرض أرقام فقط.
          كل بند مصدره ctx.notifications (نفس مصدر جرس التنبيهات) مع زر إجراء مباشر لكل بند. */}
      {tasks.length > 0 && (
        <div style={{ marginBottom: "1.1rem" }}>
          <div style={{ fontSize: T.font.sm, fontWeight: 700, color: C.mt, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
            ⚠️ يتطلب انتباهك اليوم ({tasks.length})
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {tasks.map(n => {
              const tn = TASK_TONE[n.tone] || TASK_TONE.b;
              return (
                <div key={n.id} onClick={() => go(n.page)} className="nk-card-hover"
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, background: tn.bg, border: `1px solid ${tn.border}`, borderRadius: 12, padding: ".7rem 1rem", cursor: "pointer" }}>
                  <div style={{ fontSize: T.font.sm, color: tn.ink, display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 18 }}>{n.icon}</span>
                    <span>{n.text}</span>
                  </div>
                  <Btn sm {...(tn.btn === "danger" ? { danger: true } : tn.btn === "gold" ? { gold: true } : {})}>متابعة →</Btn>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* شريط اليوم */}
      <div style={{ background: `linear-gradient(120deg, ${C.grn} 0%, ${C.grn2} 100%)`, borderRadius: 14, padding: "1rem 1.2rem", marginBottom: "1.1rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 11.5, color: C.gld, opacity: .85 }}>إيرادات اليوم</div>
          <div style={{ fontSize: T.font.numLg, fontWeight: 900, color: "#fff", display: "flex", alignItems: "baseline", gap: 8 }}>
            {fmt(todayRev)} <span style={{ fontSize: T.font.sm, fontWeight: 600, color: C.gld }}>{cur}</span>
            {yesterdayRev > 0 && (
              <span title="مقارنة بالأمس" style={{ fontSize: 12, fontWeight: 700, color: todayDelta >= 0 ? "#8ee6a8" : "#ff9b9b", background: "rgba(255,255,255,.12)", borderRadius: 8, padding: "1px 8px" }}>
                {todayDelta >= 0 ? "▲" : "▼"} {Math.abs(todayDelta)}%
              </span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 22 }}>
          <div style={{ textAlign: "center" }}><div style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>{todayCount}</div><div style={{ fontSize: 10.5, color: C.gld, opacity: .85 }}>فواتير اليوم</div></div>
          <div style={{ textAlign: "center" }}><div style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>{completedBookings.length}</div><div style={{ fontSize: 10.5, color: C.gld, opacity: .85 }}>حجوزات</div></div>
          <div style={{ textAlign: "center" }}><div style={{ fontSize: 20, fontWeight: 800, color: low.length ? "#ffb4b4" : "#fff" }}>{low.length}</div><div style={{ fontSize: 10.5, color: C.gld, opacity: .85 }}>نواقص</div></div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 11, marginBottom: "1.1rem" }}>
        <KCard label="إجمالي الإيرادات" value={fmt(totals.revenue)} sub={cur} bar="#1a8c3e" />
        <KCard label="تكلفة البضاعة المباعة" value={fmt(totals.cogs)} sub={cur} bar="#c77" />
        <KCard label="إجمالي المصاريف" value={fmt(totals.expTotal)} sub={cur} bar={C.red} />
        <KCard label="صافي الربح" value={fmt(totals.profit)} sub={`${totals.revenue ? ((totals.profit / totals.revenue) * 100).toFixed(1) : 0}% هامش`} bar={C.gold} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: ctx.scr?.isTab ? "1fr" : "3fr 2fr", gap: 11, marginBottom: "1.1rem" }}>
        <Card className="nk-card-hover">
          <CardHead title="الإيراد اليومي — آخر 7 أيام" sub={`${cur} — الخط المتقطع: نفس اليوم الأسبوع الماضي`} />
          <MiniBars data={last7.days} prevData={last7.prevWeekDays} max={last7.max} color={C.grl} labels={last7.labels} cur={cur} profitData={last7.profit} />
          <div style={{ display: "flex", justifyContent: "space-around", fontSize: 9.5, color: C.mt, marginTop: 4 }}>{last7.labels.map((m, i) => <span key={i}>{m}</span>)}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, color: C.mt, marginTop: 8 }}>
            <span style={{ width: 14, height: 2, background: C.gold, display: "inline-block", borderRadius: 1 }} />
            صافي الربح اليومي — نقطة حمراء تعني يوم خسارة
          </div>
        </Card>
        <Card className="nk-card-hover">
          <CardHead title="توزيع المبيعات" sub="حسب القسم/النشاط" />
          {distTotal === 0 ? (
            <div style={{ textAlign: "center", color: C.mt, fontSize: 12, padding: "1.5rem 0" }}>لا مبيعات بعد لعرض التوزيع</div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, flexWrap: "wrap" }}>
              <Donut segments={distSegments} cur={cur} />
              <div style={{ fontSize: 12 }}>
                {distSegments.map(s => (
                  <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: s.color, flexShrink: 0 }} />{s.label} {s.pct}%
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(310px,1fr))", gap: 11 }}>
        <Card className="nk-card-hover">
          <CardHead title="🏆 الأكثر مبيعاً اليوم" sub="بالإيراد — أعلى 5 أصناف" right={<Btn sm onClick={() => go("sales")}>المبيعات</Btn>} />
          {topSellersToday.length === 0 ? (
            <div style={{ color: C.mt, fontSize: 12, padding: "1rem 0", textAlign: "center" }}>لا مبيعات أصناف اليوم بعد</div>
          ) : (
            <RankBarChart data={topSellersToday.map(t => ({ label: t.name, value: t.revenue }))} color={C.grl} cur={cur} />
          )}
        </Card>
        <Card className="nk-card-hover">
          <CardHead title="أحدث الفواتير" right={<Btn sm onClick={() => go("sales")}>عرض الكل</Btn>} />
          {invoices.length === 0 ? <div style={{ color: C.mt, fontSize: 12, padding: "1rem 0", textAlign: "center" }}>لا فواتير بعد</div> :
            <Table cols={[{ h: "رقم", w: "28%" }, { h: "الزبون", w: "30%" }, { h: "المبلغ", w: "22%" }, { h: "الحالة", w: "20%" }]}
              rows={invoices.slice(0, 5).map(i => ["#" + i.id, i.customer, fmt(i.total) + " " + cur, <Badge tone={i.status === "مدفوعة" ? "g" : i.status === "ملغاة" ? "r" : "a"}>{i.status}</Badge>])} />}
        </Card>
        <Card className="nk-card-hover">
          <CardHead title="تنبيهات المخزون" sub={`${low.length} منتج تحت الحد الأدنى`} right={low.length > 0 && <Btn sm onClick={() => go("inventory")}>الطلب</Btn>} />
          {low.length === 0 && <div style={{ color: C.mt, fontSize: 12, padding: "1rem 0", textAlign: "center" }}>كل المنتجات ضمن المستوى الآمن ✓</div>}
          {low.slice(0, 6).map(p => {
            const pct = Math.min(100, Math.round((p.stock / (p.min * 2)) * 100));
            return <div key={p.id} style={{ marginBottom: ".7rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 2 }}><span>{p.name}</span><span style={{ color: C.red, fontWeight: 600 }}>{p.stock} متبقي</span></div>
              <div style={{ height: 6, borderRadius: 3, background: "#eee", overflow: "hidden" }}><div style={{ width: pct + "%", height: "100%", background: pct < 30 ? "#e34948" : C.gold }} /></div>
            </div>;
          })}
        </Card>
        {expiring.length > 0 && (
          <Card className="nk-card-hover">
            <CardHead title="⏳ صلاحية على وشك الانتهاء" sub={`${expiring.length} منتج خلال ${EXPIRY_WARNING_DAYS} يوماً`} right={<Btn sm onClick={() => go("products")}>إدارة المنتجات</Btn>} />
            {expiring.slice(0, 6).map(p => (
              <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: ".4rem 0", borderBottom: `0.5px solid ${C.bc}` }}>
                <div style={{ fontSize: 12 }}>{p.name}</div>
                <Badge tone={p.daysLeft < 0 ? "r" : p.daysLeft <= 3 ? "r" : "a"}>{p.daysLeft < 0 ? `منتهية منذ ${Math.abs(p.daysLeft)}ي` : p.daysLeft === 0 ? "تنتهي اليوم" : `${p.daysLeft} يوم — ${arDate(p.exp)}`}</Badge>
              </div>
            ))}
          </Card>
        )}
      </div>
    </>
  );
}
