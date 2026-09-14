/* =========================================================================
   موارد النادي (Assets) — تُخزَّن الآن بكميات جزئية لكل حالة (maintQty/
   damagedQty/lostQty/retiredQty) بدل حالة واحدة (status) لكامل الكمية، كي
   يمكن تسجيل قطعة واحدة تالفة من أصل عدة قطع دون التأثير على البقية.
   موارد قديمة أُنشئت قبل هذا التغيير لا تزال مخزَّنة بشكل status — تُحوَّل
   هنا عند القراءة فقط (بلا حاجة لهجرة بيانات فعلية).
   ========================================================================= */
export const normalizeAsset = (a) => {
  if (a.maintQty !== undefined || a.damagedQty !== undefined || a.lostQty !== undefined) {
    return { maintQty: 0, damagedQty: 0, lostQty: 0, retiredQty: 0, ...a };
  }
  const qty = a.qty || 1;
  return {
    ...a,
    maintQty: a.status === "maintenance" ? qty : 0,
    damagedQty: a.status === "damaged" ? qty : 0,
    lostQty: a.status === "lost" ? qty : 0,
    retiredQty: 0,
  };
};

export const activeQtyOf = (a) => Math.max(0, (a.qty || 0) - (a.maintQty || 0) - (a.damagedQty || 0) - (a.lostQty || 0) - (a.retiredQty || 0));

// تاريخ آخر إرسال فعلي للصيانة — من سجل الأحداث للموارد الجديدة، أو maintStart القديم للموارد المُهاجَرة
export const lastMaintenanceStart = (a) => {
  const sent = (a.history || []).filter(h => h.event && h.event.includes("إرسال") && h.event.includes("للصيانة"));
  if (sent.length > 0) return sent[sent.length - 1].date;
  return a.maintStart || null;
};
