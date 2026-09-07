import { C, fmt } from "../constants/theme.js";
import { PageTop, Btn, KCard, Card, Badge } from "../components/ui.jsx";
import { arDate, overdueDays } from "../utils/format.js";

/* ============================ ALERTS (overdue payments) ============================ */
export default function Alerts({ ctx }) {
  const { invoices, customers, showToast, settings } = ctx;
  const cur = settings?.currency || "د.ل";

  // group overdue deferred invoices by customer
  const overdue = invoices.filter(iv => overdueDays(iv) > 0);
  const byCustomer = {};
  overdue.forEach(iv => {
    if (!byCustomer[iv.customer]) byCustomer[iv.customer] = { name: iv.customer, invoices: [], total: 0, maxLate: 0 };
    byCustomer[iv.customer].invoices.push(iv);
    byCustomer[iv.customer].total += iv.total;
    byCustomer[iv.customer].maxLate = Math.max(byCustomer[iv.customer].maxLate, overdueDays(iv));
  });
  const groups = Object.values(byCustomer).sort((a, b) => b.maxLate - a.maxLate);

  const severity = (days) => {
    if (days > 30) return { label: "متأخر جداً", tone: "r", color: "#c0392b" };
    if (days > 14) return { label: "متأخر", tone: "a", color: "#e07b1a" };
    return { label: "قريب التأخير", tone: "a", color: "#c9a84c" };
  };

  const totalOverdue = overdue.reduce((s, iv) => s + iv.total, 0);

  const sendReminder = (group) => {
    const cust = customers.find(c => c.name === group.name);
    if (!cust || !cust.wa) { showToast("لا يوجد رقم واتساب مسجّل لهذا الزبون"); return; }
    const lines = group.invoices.map((iv, i) => `${i + 1}. #${iv.id} — ${fmt(iv.total)} ${cur} — متأخرة ${overdueDays(iv)} يوم`);
    const msg = [
      `🌴 *${settings?.clubName || "نادي النخيل"}* — تذكير بالسداد`,
      `عزيزنا ${group.name}،`,
      "",
      "نودّ تذكيركم بوجود مستحقات متأخرة:",
      ...lines,
      "",
      `*إجمالي المتأخر: ${fmt(group.total)} ${cur}*`,
      "",
      "نرجو التكرم بالسداد في أقرب وقت. شكراً لتعاملكم معنا 🌴",
    ].join("\n");
    window.open(`https://wa.me/${cust.wa}?text=${encodeURIComponent(msg)}`, "_blank");
    showToast(`تم فتح واتساب لتذكير ${group.name}`);
  };

  const remindAll = () => {
    if (!groups.length) return;
    showToast(`سيتم فتح ${groups.length} محادثة واتساب — أكّد كل رسالة`);
    groups.forEach((g, idx) => setTimeout(() => sendReminder(g), idx * 600));
  };

  return (
    <>
      <PageTop title="تنبيهات السداد" action={groups.length > 0 && <Btn gold onClick={remindAll}>📱 تذكير الجميع</Btn>} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 11, marginBottom: "1.1rem" }}>
        <KCard label="فواتير متأخرة" value={overdue.length} sub="بحاجة متابعة" bar={C.red} />
        <KCard label="زبائن متأخرون" value={groups.length} sub="عليهم مستحقات" bar={C.gold} />
        <KCard label="إجمالي المتأخر" value={fmt(totalOverdue)} sub={cur} bar="#e07b1a" />
      </div>

      {groups.length === 0 ? (
        <Card>
          <div style={{ textAlign: "center", padding: "2.5rem 1rem", color: C.mt }}>
            <div style={{ fontSize: 46, marginBottom: 10 }}>✅</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.grn2 }}>لا توجد مستحقات متأخرة</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>كل الحسابات الآجلة ضمن مواعيد السداد.</div>
          </div>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          {groups.map(g => {
            const sev = severity(g.maxLate);
            return (
              <Card key={g.name} className="nk-card-hover" style={{ borderRight: `4px solid ${sev.color}` }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: sev.color + "22", color: sev.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700 }}>{g.name.slice(0, 1)}</div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{g.name}</div>
                      <div style={{ fontSize: 11, color: C.mt }}>{g.invoices.length} فاتورة متأخرة · أقصى تأخير {g.maxLate} يوم</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ textAlign: "left" }}>
                      <div style={{ fontSize: 18, fontWeight: 700, color: sev.color }}>{fmt(g.total)} {cur}</div>
                      <Badge tone={sev.tone}>{sev.label}</Badge>
                    </div>
                    <button onClick={() => sendReminder(g)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: ".5rem .9rem", borderRadius: 9, background: "#25D366", color: "#fff", border: "none", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>📱 تذكير</button>
                  </div>
                </div>
                <div style={{ background: C.crm, borderRadius: 9, padding: ".5rem .7rem" }}>
                  {g.invoices.map(iv => (
                    <div key={iv.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, padding: ".3rem 0", borderBottom: `0.5px solid ${C.bc}` }}>
                      <span>#{iv.id} — {iv.details}</span>
                      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ color: C.mt, fontSize: 11 }}>استحقاق {arDate(iv.dueDate || iv.date)}</span>
                        <Badge tone={severity(overdueDays(iv)).tone}>متأخرة {overdueDays(iv)} يوم</Badge>
                        <span style={{ fontWeight: 600, color: C.grn2, minWidth: 60, textAlign: "left" }}>{fmt(iv.total)} {cur}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
