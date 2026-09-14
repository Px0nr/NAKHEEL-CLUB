/* =========================================================================
   حالة الكوبون الفعلية — كان الحقل status يبقى "نشط" إلى الأبد حتى بعد انتهاء
   تاريخ الصلاحية أو بلوغ حد الاستخدام، ونقطة البيع كانت تتحقق فقط من status
   فيمكن تطبيق كوبون منتهٍ أو تجاوز حده بلا أي مانع فعلي.
   ========================================================================= */
import { todayISO } from "./format.js";

// الحالة الحقيقية: معطّل يدوياً > منتهي الصلاحية > مكتمل (بلغ حد الاستخدام) > نشط
export function couponState(c, todayIso = todayISO()) {
  if (!c || c.status !== "نشط") return "معطّل";
  if (c.exp && c.exp < todayIso) return "منتهي";
  if ((c.used || 0) >= (c.limit || Infinity)) return "مكتمل";
  return "نشط";
}

export function couponActive(c, todayIso = todayISO()) {
  return couponState(c, todayIso) === "نشط";
}

export const COUPON_STATE_TONE = { "نشط": "g", "منتهي": "r", "مكتمل": "a", "معطّل": "r" };
