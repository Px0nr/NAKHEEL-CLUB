export const PDF_HOOK = { show: null };
// تُستدعى من أي مكوّن — تعرض المستند داخل التطبيق (بدون نوافذ منبثقة)
export function openPdfDoc(settings, cfg) {
  if (PDF_HOOK.show) PDF_HOOK.show({ settings: settings || {}, cfg });
}
