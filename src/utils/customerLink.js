/* =========================================================================
   ربط بيع بزبون مسجَّل — مشترك بين الحجز والتأجير (والبطولات لاحقاً)، فلا
   يُعاد كتابة نفس حساب الدَين/النقاط في كل صفحة بمنطق مختلف قليلاً.

   لم تكن هذه الصفحات تربط أي عملية بزبون مسجَّل إطلاقاً — الاسم نصّ حرّ فقط،
   فلا ولاء ولا بيع آجل على الحجوزات والتأجير رغم أن نقطة البيع تدعمهما كاملاً،
   ولا يظهر إنفاق الزبون على الصالة في صفحته أو في تقرير الزبائن.
   ========================================================================= */

// نقاط الولاء المكتسبة على مبلغ — نفس صيغة POS (Math.floor(total / pointsPerCurrency))
export function pointsEarnedFor(total, settings) {
  if (!settings?.loyaltyOn) return 0;
  return Math.floor(total / (settings.pointsPerCurrency || 10));
}

/* أثر عملية على سجل الزبون — deferred=true (آجل) تزيد الدَين أيضاً.
   عكس POS الحالي عمداً: هنا total/invoices يزيدان في كل الحالات (آجلة أو
   فورية) لأن غرض هذين الحقلين في صفحة الزبون هو «إجمالي المشتريات» الفعلي،
   لا تاريخ الدَين فقط — الحجز والتأجير عمليتان حقيقيتان بقيمة حقيقية. */
export function customerSaleDelta({ total, deferred, settings }) {
  return {
    totalDelta: total,
    invoicesDelta: 1,
    debtDelta: deferred ? total : 0,
    pointsDelta: pointsEarnedFor(total, settings),
  };
}

export function applyCustomerSale(setCustomers, customerId, delta, extra = {}) {
  setCustomers(cs => cs.map(c => c.id === customerId ? {
    ...c,
    total: (c.total || 0) + delta.totalDelta,
    invoices: (c.invoices || 0) + delta.invoicesDelta,
    debt: (c.debt || 0) + delta.debtDelta,
    points: (c.points || 0) + delta.pointsDelta,
    last: extra.date || c.last,
  } : c));
}
