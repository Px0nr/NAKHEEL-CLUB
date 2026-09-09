/* =========================================================================
   عكس أثر فاتورة على المخزون وحساب الزبون — مصدر واحد يستخدمه مساران:
     1) «التراجع عن آخر بيع» في نقطة البيع (POS)
     2) «إلغاء» أو «حذف» فاتورة من سجل المبيعات (Sales)

   كان المسار الثاني يغيّر كلمة الحالة فقط: البضاعة تبقى مخصومة من المخزون
   والدَين يبقى على الزبون رغم إلغاء البيعة. المنطق الصحيح كان مكتوباً في
   نقطة البيع وحدها، فاستُخرج هنا ليعمل الاثنان بنفس القواعد بالضبط.
   ========================================================================= */

/* خطة العكس — دالة نقية (بلا آثار جانبية) ليسهل اختبارها:
   { stock: {pid: قطع تُعاد}, customer: {...} | null, approximate: bool } */
export function computeReversal(inv) {
  const stock = {};
  let approximate = false;

  (inv.items || []).forEach(it => {
    if (it.pid == null) return;
    // pieces = العدد الفعلي من القطع المخصومة وقت البيع. الفواتير المُنشأة قبل
    // إضافة هذا الحقل لا تحمله: بيع "علبة" واحدة قد يكون 24 قطعة، وqty يقول 1.
    // نعيد qty ونرفع approximate بدل عكسٍ صامت بأرقام خاطئة.
    if (it.pieces == null) approximate = true;
    stock[it.pid] = (stock[it.pid] || 0) + (it.pieces != null ? it.pieces : it.qty);
  });

  let customer = null;
  if (inv.customerId != null) {
    const deferred = inv.pay === "آجل";
    customer = {
      id: inv.customerId,
      // الدَين يُخصم أصلاً عند السداد (CustomerDetail)، فلا يُخصم مرةً ثانية
      // هنا إن كانت الفاتورة الآجلة قد سُدِّدت فعلاً
      debtDelta: deferred && inv.status === "معلقة" ? -inv.total : 0,
      // إجمالي مشتريات الزبون وعدّاد فواتيره يزيدان عند البيع الآجل وحده
      totalDelta: deferred ? -inv.total : 0,
      invoicesDelta: deferred ? -1 : 0,
      // النقاط تُكتسب وتُستبدل في كل أنواع البيع المرتبطة بزبون
      pointsDelta: -(inv.loyaltyEarned || 0) + (inv.loyaltyRedeemed || 0),
    };
  }

  return { stock, customer, approximate };
}

/* تطبيق الخطة على الحالة عبر setState الممرَّرَين.
   يعيد الخطة المنفَّذة مع skipped=true إن لم يُطبَّق شيء. */
export function applyReversal(inv, { setProducts, setCustomers }) {
  // فاتورة ملغاة سبق أن عُكس أثرها لحظة الإلغاء — حذفها لاحقاً يجب ألا يعكسها مرتين
  if (!inv || inv.status === "ملغاة") return { stock: {}, customer: null, approximate: false, skipped: true };

  const plan = computeReversal(inv);

  if (Object.keys(plan.stock).length && setProducts) {
    setProducts(ps => ps.map(p => {
      const pieces = plan.stock[p.id];
      // المنتجات الخدمية (stock === null) لا مخزون لها يُعاد
      return pieces && p.stock !== null ? { ...p, stock: p.stock + pieces } : p;
    }));
  }

  if (plan.customer && setCustomers) {
    const adj = plan.customer;
    setCustomers(cs => cs.map(c => c.id === adj.id ? {
      ...c,
      debt: Math.max(0, (c.debt || 0) + adj.debtDelta),
      total: Math.max(0, (c.total || 0) + adj.totalDelta),
      invoices: Math.max(0, (c.invoices || 0) + adj.invoicesDelta),
      points: Math.max(0, (c.points || 0) + adj.pointsDelta),
    } : c));
  }

  return { ...plan, skipped: false };
}
