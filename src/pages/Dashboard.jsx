import { useMemo } from "react";
import { C, T, fmt } from "../constants/theme.js";
import { PageTop, Badge, Btn, KCard, Card, CardHead, Table } from "../components/ui.jsx";
import { MiniBars, Donut } from "../components/charts.jsx";

/* ============================ DASHBOARD ============================ */
export default function Dashboard({ ctx, go }) {
  const { totals, invoices, products, overdueAlerts, completedBookings, cats, settings } = ctx;
  const cur = settings?.currency || "د.ل";
  const low = products.filter(p => p.stock !== null && p.min && p.stock < p.min);

  // آخر 7 أيام — إيراد فعلي من الفواتير المدفوعة
  const last7 = useMemo(() => {
    const days = [], labels = [];
    const dayName = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const iso = d.toISOString().split("T")[0];
      const rev = invoices.filter(v => v.date === iso && v.status === "مدفوعة").reduce((s, v) => s + v.total, 0);
      days.push(rev); labels.push(i === 0 ? "اليوم" : dayName[d.getDay()]);
    }
    return { days, labels, max: Math.max(1000, ...days) };
  }, [invoices]);

  const todayISOv = new Date().toISOString().split("T")[0];
  const todayRev = invoices.filter(v => v.date === todayISOv && v.status === "مدفوعة").reduce((s, v) => s + v.total, 0);
  const todayCount = invoices.filter(v => v.date === todayISOv).length;

  // توزيع المبيعات حسب القسم (من مصدر الفاتورة والتفاصيل)
  const dist = useMemo(() => {
    let games = 0, cafe = 0, other = 0;
    invoices.filter(v => v.status === "مدفوعة").forEach(v => {
      if (v.source === "حجز") games += v.total;
      else if (v.details && (v.details.includes("قهوة") || v.details.includes("عصير") || v.details.includes("Red") || v.details.includes("ساندويش"))) cafe += v.total;
      else if (v.details && (v.details.includes("PS5") || v.details.includes("Xbox") || v.details.includes("كنترول"))) games += v.total;
      else other += v.total;
    });
    const tot = games + cafe + other || 1;
    return { games, cafe, other, gPct: Math.round(games / tot * 100), cPct: Math.round(cafe / tot * 100) };
  }, [invoices]);

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
          <div style={{ fontSize: T.font.numLg, fontWeight: 900, color: "#fff" }}>{fmt(todayRev)} <span style={{ fontSize: T.font.sm, fontWeight: 600, color: C.gld }}>{cur}</span></div>
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
          <CardHead title="الإيراد اليومي — آخر 7 أيام" sub={cur} />
          <MiniBars data={last7.days} max={last7.max} color={C.grl} />
          <div style={{ display: "flex", justifyContent: "space-around", fontSize: 9.5, color: C.mt, marginTop: 4 }}>{last7.labels.map((m, i) => <span key={i}>{m}</span>)}</div>
        </Card>
        <Card className="nk-card-hover">
          <CardHead title="توزيع المبيعات" sub="حسب النشاط" />
          {dist.games + dist.cafe + dist.other === 0 ? (
            <div style={{ textAlign: "center", color: C.mt, fontSize: 12, padding: "1.5rem 0" }}>لا مبيعات بعد لعرض التوزيع</div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }}>
              <Donut segments={[{ v: dist.gPct, c: C.grl }, { v: Math.max(0, 100 - dist.gPct), c: C.gold }]} />
              <div style={{ fontSize: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: C.grl }} />ألعاب {dist.gPct}%</div>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: C.gold }} />كافيه/أخرى {100 - dist.gPct}%</div>
              </div>
            </div>
          )}
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(310px,1fr))", gap: 11 }}>
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
      </div>
    </>
  );
}
