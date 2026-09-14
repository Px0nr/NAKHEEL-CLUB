import { useState, useRef } from "react";
import { C } from "../constants/theme.js";
import { Card, CardHead, Btn } from "../components/ui.jsx";
import { DB, backupCounts } from "../db/db.js";

/* ============================ BACKUP MANAGER ============================ */
export default function BackupManager({ ctx }) {
  const { showToast, confirm, settings } = ctx;
  const [, tick] = useState(0);
  const fileRef = useRef(null);
  // النسخة كملف هي وحدها ما يُحتسب في حالة الحماية — اللقطة الداخلية تعيش في
  // نفس التخزين الذي يزول مع الجهاز، فعرضها كـ"آخر نسخة" كان يطمئن بلا مبرّر
  const lastFile = DB.lastFileBackupAt();
  const autoBk = DB.getAutoBackup();

  const daysSince = lastFile ? Math.floor((Date.now() - new Date(lastFile)) / 86400000) : null;
  const overdue = daysSince === null || daysSince >= (settings.backupFreq || 7);

  const downloadBackup = () => {
    const name = DB.downloadBackupFile();
    tick(x => x + 1);
    showToast(name ? `تم تنزيل ${name}` : "تعذّر تنزيل النسخة");
  };

  const saveInternal = () => {
    DB.saveAutoBackup(); tick(x => x + 1);
    showToast("تم حفظ نسخة احتياطية داخلية");
  };

  const restoreInternal = async () => {
    if (!autoBk) return;
    if (!(await confirm("سيتم استبدال كل البيانات الحالية بالنسخة الداخلية المحفوظة. متابعة؟", { danger: true }))) return;
    try { await DB.importData(autoBk); showToast("تمت الاستعادة — سيُعاد التحميل"); setTimeout(() => window.location.reload(), 900); }
    catch { showToast("تعذّرت الاستعادة"); }
  };

  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const backup = JSON.parse(reader.result);
        if (!backup.__nakheel_backup) { showToast("هذا الملف ليس نسخة احتياطية صالحة"); return; }
        const cnt = backupCounts(backup.data || {}).join("، ") || "لا عناصر";
        if (!(await confirm(`استعادة نسخة بتاريخ ${new Date(backup.exportedAt).toLocaleString("ar-LY")}؟\nتحتوي: ${cnt}\n\nسيتم استبدال كل البيانات الحالية.`, { danger: true }))) return;
        await DB.importData(backup);
        showToast("تمت الاستعادة بنجاح — سيُعاد التحميل");
        setTimeout(() => window.location.reload(), 900);
      } catch { showToast("تعذّرت قراءة الملف — تأكد أنه نسخة صحيحة"); }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const setFreq = (v) => ctx.setSettings(s => ({ ...s, backupFreq: v }));

  return (
    <Card className="nk-card-hover">
      <CardHead title="🛡 النسخ الاحتياطي الذكي" sub="احمِ بيانات النادي من الفقدان" />

      {/* حالة آخر نسخة */}
      <div style={{ background: overdue ? "#fdeaea" : "#e8f8ee", border: `1px solid ${overdue ? "rgba(192,57,43,.3)" : "rgba(26,140,62,.3)"}`, borderRadius: 12, padding: ".85rem 1rem", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 26 }}>{overdue ? "⚠️" : "✅"}</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: overdue ? "#922" : "#1a5c2e" }}>
              {lastFile ? `آخر نسخة كملف: ${daysSince === 0 ? "اليوم" : daysSince === 1 ? "أمس" : `منذ ${daysSince} يوم`}` : "لا توجد نسخة محفوظة كملف"}
            </div>
            <div style={{ fontSize: 11, color: C.mt }}>{lastFile ? new Date(lastFile).toLocaleString("ar-LY") : "اللقطات الداخلية لا تحمي من عطب الجهاز — نزّل ملفاً"}</div>
          </div>
        </div>
        {overdue && <Btn gold sm onClick={downloadBackup}>أنشئ نسخة الآن</Btn>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 12 }}>
        {/* تنزيل / رفع ملف */}
        <div style={{ border: `0.5px solid ${C.bc}`, borderRadius: 12, padding: "1rem" }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 4 }}>📁 نسخة كملف (موصى بها)</div>
          <div style={{ fontSize: 11, color: C.mt, marginBottom: 10, lineHeight: 1.7 }}>نزّل ملف <code style={{ background: C.crm, padding: "1px 5px", borderRadius: 4 }}>.json</code> واحتفظ به في مكان آمن (سحابة/فلاش). يمكنك استعادته على أي جهاز.</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            <Btn gold onClick={downloadBackup} style={{ justifyContent: "center" }}>⬇ تنزيل نسخة احتياطية</Btn>
            <input ref={fileRef} type="file" accept="application/json,.json" onChange={onFile} style={{ display: "none" }} />
            <Btn onClick={() => fileRef.current?.click()} style={{ justifyContent: "center" }}>⬆ استعادة من ملف</Btn>
          </div>
        </div>

        {/* نسخة داخلية سريعة */}
        <div style={{ border: `0.5px solid ${C.bc}`, borderRadius: 12, padding: "1rem" }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 4 }}>⚡ لقطة داخلية سريعة</div>
          <div style={{ fontSize: 11, color: C.mt, marginBottom: 10, lineHeight: 1.7 }}>
            للتراجع عن خطأ قبل تعديل كبير. <b style={{ color: C.gdd }}>لا تحمي من عطب الجهاز أو مسح بيانات المتصفح</b> — تُحفظ في نفس مكان البيانات. {autoBk ? `آخر لقطة: ${new Date(autoBk.exportedAt).toLocaleString("ar-LY")}` : "لا توجد لقطة بعد."}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            <Btn onClick={saveInternal} style={{ justifyContent: "center" }}>📸 حفظ لقطة الآن</Btn>
            <Btn onClick={restoreInternal} disabled={!autoBk} style={{ justifyContent: "center", opacity: autoBk ? 1 : .5 }}>↩ استرجاع آخر لقطة</Btn>
          </div>
        </div>

        {/* التذكير المجدول */}
        <div style={{ border: `0.5px solid ${C.bc}`, borderRadius: 12, padding: "1rem" }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 4 }}>⏰ تذكير النسخ التلقائي</div>
          <div style={{ fontSize: 11, color: C.mt, marginBottom: 10, lineHeight: 1.7 }}>كل متى يذكّرك النظام بإنشاء نسخة احتياطية؟</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
            {[{ v: 1, l: "يومياً" }, { v: 7, l: "أسبوعياً" }, { v: 30, l: "شهرياً" }].map(o => (
              <div key={o.v} onClick={() => setFreq(o.v)} style={{ border: `1.5px solid ${(settings.backupFreq || 7) === o.v ? C.gold : C.bc}`, borderRadius: 8, padding: ".5rem .3rem", textAlign: "center", cursor: "pointer", fontSize: 11.5, fontWeight: 600, background: (settings.backupFreq || 7) === o.v ? C.gold + "14" : C.crm }}>{o.l}</div>
            ))}
          </div>
          <div style={{ fontSize: 10.5, color: C.mt, marginTop: 8, lineHeight: 1.6 }}>يظهر تنبيه أعلى الصفحة عند حلول موعد النسخ التالي.</div>
        </div>
      </div>

      <div style={{ marginTop: 12, fontSize: 11, color: C.mt, background: C.crm, borderRadius: 8, padding: ".6rem .8rem", lineHeight: 1.8 }}>
        💡 يُنزّل النظام نسخة كملف تلقائياً عند كل إغلاق يومي للخزينة.
        {DB.mode !== "supabase" && (
          <> لكن الملف يبقى على نفس الجهاز: انقله دورياً إلى فلاشة أو حساب سحابي، فسرقة الجهاز أو تلفه تأخذ الملفات معها.
          {" "}<b style={{ color: C.gdd }}>تفعيل Supabase هو الحل الوحيد الذي يجعل النسخة خارج الجهاز فعلاً</b> — الخطوات في البطاقة المجاورة.</>
        )}
      </div>
    </Card>
  );
}
