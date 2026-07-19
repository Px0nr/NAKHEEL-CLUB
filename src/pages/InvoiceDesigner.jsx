import { C } from "../constants/theme.js";
import { Card, CardHead, Field, Inp, inputStyle, Badge, Btn, Crest } from "../components/ui.jsx";

/* ---- Invoice live designer ---- */
export default function InvoiceDesigner({ ctx }) {
  const { settings, setSettings, showToast } = ctx;
  const set = (k, v) => setSettings(s => ({ ...s, [k]: v }));
  const isThermal = settings.printer === "xprinter";

  return (
    <div style={{ display: "grid", gridTemplateColumns: ctx.scr?.isTab ? "1fr" : "1fr 340px", gap: 12 }}>
      <Card className="nk-card-hover">
        <CardHead title="تخصيص شكل الفاتورة" sub="غيّر العناصر وشاهد المعاينة تتحدث فوراً على اليسار" />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: C.crm, borderRadius: 10, padding: ".6rem .85rem", marginBottom: 10 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600 }}>إظهار الشعار على الفاتورة</div>
          <div onClick={() => set("invoiceShowLogo", !settings.invoiceShowLogo)} style={{ width: 34, height: 18, borderRadius: 9, background: settings.invoiceShowLogo ? C.grl : "#ccc", position: "relative", cursor: "pointer" }}>
            <div style={{ position: "absolute", width: 14, height: 14, borderRadius: "50%", background: "#fff", top: 2, right: settings.invoiceShowLogo ? 2 : 18, transition: "right .2s" }} />
          </div>
        </div>
        <Field label="اسم العملة"><Inp value={settings.currency} onChange={e => set("currency", e.target.value)} placeholder="د.ل" /></Field>
        <Field label="تذييل الفاتورة"><textarea value={settings.invoiceFooter} onChange={e => set("invoiceFooter", e.target.value)} style={{ ...inputStyle, height: 52, resize: "none" }} /></Field>
        <div style={{ fontSize: 12, color: C.mt, marginTop: 6, marginBottom: 4 }}>نوع الطابعة الحالي:</div>
        <Badge tone="gold">{isThermal ? "إيصال حراري 80mm (Xprinter)" : "فاتورة A4 كاملة"}</Badge>
        <div style={{ fontSize: 11, color: C.mt, marginTop: 6 }}>يمكنك تغيير نوع الطابعة من تبويب «الطابعات».</div>
        <Btn gold onClick={() => showToast("تم حفظ تصميم الفاتورة")} style={{ marginTop: 12, width: "100%", justifyContent: "center" }}>✓ حفظ التصميم</Btn>
      </Card>

      {/* LIVE PREVIEW */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.mt, marginBottom: 8, textAlign: "center" }}>معاينة حيّة للفاتورة</div>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <div style={{ width: isThermal ? 240 : 320, background: "#fff", borderRadius: isThermal ? 6 : 8, boxShadow: "0 8px 30px rgba(0,0,0,.15)", padding: isThermal ? "14px 12px" : "20px 22px", fontFamily: isThermal ? "monospace" : "'Tajawal',sans-serif", color: "#1a1a18", transition: "width .3s" }}>
            {settings.invoiceShowLogo && (
              <div style={{ textAlign: "center", marginBottom: 8 }}>
                {settings.logo ? <img src={settings.logo} alt="" style={{ width: isThermal ? 40 : 54, height: isThermal ? 40 : 54, objectFit: "cover", borderRadius: 8 }} /> : <Crest size={isThermal ? 40 : 54} />}
              </div>
            )}
            <div style={{ textAlign: "center", fontSize: isThermal ? 13 : 16, fontWeight: 700, color: "#1a5c2e" }}>{settings.clubName}</div>
            <div style={{ textAlign: "center", fontSize: isThermal ? 9 : 10, color: "#7a7870", marginBottom: 3 }}>{settings.clubSub}</div>
            <div style={{ textAlign: "center", fontSize: isThermal ? 8.5 : 10, color: "#7a7870" }}>{settings.address} · {settings.phone}</div>
            <div style={{ borderTop: "1px dashed #ccc", margin: "8px 0" }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: isThermal ? 9 : 11, color: "#3d3c38" }}><span>فاتورة #INV-1048</span><span>{new Date().toLocaleDateString("ar-LY")}</span></div>
            <div style={{ borderTop: "1px dashed #ccc", margin: "8px 0" }} />
            {[["وقت PS5 × 2", "100"], ["قهوة تركية × 3", "24"], ["Red Bull × 1", "8"]].map((r, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: isThermal ? 9.5 : 11.5, marginBottom: 4 }}><span>{r[0]}</span><span>{r[1]} {settings.currency}</span></div>
            ))}
            <div style={{ borderTop: "1px dashed #ccc", margin: "8px 0" }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: isThermal ? 12 : 14, fontWeight: 700, color: "#1a5c2e" }}><span>الإجمالي</span><span>132 {settings.currency}</span></div>
            <div style={{ borderTop: "1px dashed #ccc", margin: "8px 0" }} />
            <div style={{ textAlign: "center", fontSize: isThermal ? 8.5 : 10.5, color: "#7a7870", marginTop: 4 }}>{settings.invoiceFooter}</div>
            {isThermal && <div style={{ textAlign: "center", marginTop: 8, letterSpacing: 2, fontSize: 18 }}>▮▏▮▎▏▮▍▏▮</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
