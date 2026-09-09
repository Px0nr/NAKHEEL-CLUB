/* =========================================================================
   تفكيك طريقة دفع الفاتورة — الفاتورة العادية جزء واحد، والمقسَّمة عدة أجزاء.

   ضروري للخزينة ودفتر رأس المال: كلاهما كان يوزّع كامل قيمة الفاتورة على
   طريقة واحدة (i.pay). بلا هذا التفكيك، فاتورة نصفها كاش ونصفها بطاقة كانت
   ستُحسب كلها في درج النقد فيظهر عجز وهمي عند الإغلاق.
   ========================================================================= */

export const PAY_METHODS = ["كاش", "بطاقة", "تحويل"];

export function payBreakdown(inv) {
  if (Array.isArray(inv?.payParts) && inv.payParts.length) return inv.payParts;
  return [{ method: inv?.pay, amount: inv?.total || 0 }];
}

/* بناء أجزاء الدفع المقسَّم والتحقق منها قبل إتمام البيع.
   يعيد { parts, label, error } — error نصّ يُعرض للكاشير إن كان الإدخال غير صالح. */
export function buildSplit({ total, firstMethod, firstAmount, secondMethod }) {
  const a = Math.round((parseFloat(firstAmount) || 0) * 100) / 100;
  if (firstMethod === secondMethod) return { error: "اختر طريقتين مختلفتين" };
  if (a <= 0) return { error: "أدخل مبلغ الجزء الأول" };
  if (a >= total) return { error: "مبلغ الجزء الأول يجب أن يكون أقل من الإجمالي" };
  const rest = Math.round((total - a) * 100) / 100;
  return {
    parts: [{ method: firstMethod, amount: a }, { method: secondMethod, amount: rest }],
    label: `${firstMethod} + ${secondMethod}`,
  };
}
