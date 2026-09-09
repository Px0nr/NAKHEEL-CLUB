/* =========================================================================
   تصدير الجداول إلى CSV و Excel — مصدر واحد تستخدمه صفحة التقارير وسجل
   الفواتير (وأي جدول لاحق) بدل نسخ نفس المنطق في كل صفحة.

   كل تصدير يأخذ أوراقاً (sheets) بالشكل: { name, thead, tbody }
   ========================================================================= */

const csvEscape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

// اسم ملف صالح على ويندوز أيضاً — المحارف \ / : * ? " < > | ممنوعة فيه
const safeFileName = (s) => String(s || "تصدير").replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, "-");

function triggerDownload(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = fileName;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* يبني نص CSV من الأوراق — مُصدَّرة منفصلةً ليسهل اختبارها بلا DOM.
   يُفصل بين الأوراق بسطر فارغ وعنوان الورقة. */
export function buildCsv(sheets) {
  return sheets.map((s, i) => {
    const head = (i > 0 && s.name ? csvEscape(s.name) + "\n" : "");
    const rows = [s.thead, ...s.tbody].map(r => r.map(csvEscape).join(",")).join("\n");
    return head + rows;
  }).join("\n\n") + "\n";
}

export function downloadCsv(sheets, baseName) {
  // BOM في المقدّمة كي يفتح Excel العربية بترميز صحيح بدل رموز مشوّشة
  triggerDownload(new Blob(["﻿" + buildCsv(sheets)], { type: "text/csv;charset=utf-8;" }), `${safeFileName(baseName)}.csv`);
}

export async function downloadExcel(sheets, baseName) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  sheets.forEach(({ name, thead, tbody }) => {
    // اسم ورقة Excel محدود بـ31 محرفاً ولا يقبل المحارف الممنوعة أعلاه
    const ws = wb.addWorksheet(safeFileName(name).slice(0, 31), { views: [{ rightToLeft: true }] });
    ws.addRow(thead);
    ws.getRow(1).font = { bold: true, color: { argb: "FFF0D080" } };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1A5C2E" } };
    tbody.forEach(r => ws.addRow(r));
    ws.columns.forEach((col, i) => {
      const maxLen = Math.max(String(thead[i] ?? "").length || 10, ...tbody.map(r => String(r[i] ?? "").length));
      col.width = Math.min(40, Math.max(10, maxLen + 2));
    });
  });
  const buf = await wb.xlsx.writeBuffer();
  triggerDownload(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${safeFileName(baseName)}.xlsx`);
}
