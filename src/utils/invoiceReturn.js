/* =========================================================================
   إرجاع جزئي من فاتورة — إعادة صنف أو بعض كمياته دون إلغاء الفاتورة كلها.
   كان الإلغاء الكلي هو الخيار الوحيد، وهو لا يناسب أكثر حالات الإرجاع شيوعاً
   (خمسة أصناف يُرجَع منها واحد).

   المبدأ: الفاتورة نفسها تُخفَّض (كمياتها وإجماليها وتكلفتها) ويُسجَّل الإرجاع
   في سجلّها. بهذا تبقى كل التقارير صحيحة تلقائياً لأنها تجمع إجماليات الفواتير،
   بلا حاجة لأن يطرح كل تقرير المرتجعات بنفسه.
   ========================================================================= */

const round2 = (n) => Math.round(n * 100) / 100;

/* حساب أثر الإرجاع — دالة نقية.
   returnQtys: { [فهرس السطر في inv.items]: الكمية المُرجَعة } */
export function computeReturn(inv, returnQtys, products = []) {
  const items = inv?.items || [];
  const lines = [];
  const stock = {};
  let refund = 0, costBack = 0;

  const nextItems = items.map((it, idx) => {
    const asked = Math.floor(Number(returnQtys?.[idx]) || 0);
    const qty = Math.max(0, Math.min(asked, it.qty || 0));
    if (qty <= 0) return it;

    // المبلغ بالتناسب مع إجمالي السطر: يحترم أي خصم كان مطبَّقاً عليه
    const amount = round2((it.lineTotal || 0) * (qty / it.qty));
    // القطع الفعلية — pieces قد تغيب في الفواتير القديمة فنتراجع إلى qty
    const perLinePieces = it.pieces != null ? it.pieces / it.qty : 1;
    const pieces = Math.round(qty * perLinePieces);

    if (it.pid != null) {
      stock[it.pid] = (stock[it.pid] || 0) + pieces;
      const prod = products.find(p => p.id === it.pid);
      costBack = round2(costBack + (prod?.buy || 0) * pieces);
    }
    refund = round2(refund + amount);
    lines.push({ pid: it.pid, name: it.name, qty, pieces, amount });

    const remain = it.qty - qty;
    return {
      ...it,
      qty: remain,
      pieces: it.pieces != null ? Math.round(remain * perLinePieces) : undefined,
      lineTotal: round2((it.lineTotal || 0) - amount),
    };
  }).filter(it => it.qty > 0);

  const nextTotal = Math.max(0, round2((inv?.total || 0) - refund));
  const nextCost = Math.max(0, round2((inv?.cost || 0) - costBack));
  const fullyReturned = nextItems.length === 0 || nextTotal === 0;

  // النقاط تُسحب بنسبة المبلغ المرتجَع من قيمة الفاتورة قبل هذا الإرجاع، ويُخفَّض
  // رصيد loyaltyEarned المخزَّن كي يحسب أي إرجاع لاحق على ما تبقّى فقط
  const earned = inv?.loyaltyEarned || 0;
  const pointsBack = (earned > 0 && inv?.total > 0) ? Math.round(earned * (refund / inv.total)) : 0;

  let customer = null;
  if (inv?.customerId != null) {
    const deferred = inv.pay === "آجل";
    customer = {
      id: inv.customerId,
      // الدَين يُخصم عند السداد، فلا يُخصم ثانيةً لفاتورة آجلة مسدَّدة
      debtDelta: deferred && inv.status === "معلقة" ? -refund : 0,
      totalDelta: deferred ? -refund : 0,
      pointsDelta: -pointsBack,
    };
  }

  return { lines, refund, costBack, stock, customer, nextItems, nextTotal, nextCost, fullyReturned, pointsBack };
}

/* الفاتورة بعد تطبيق الإرجاع — تحمل سجلّ المرتجعات لتظهر في التفاصيل والتدقيق */
export function applyReturnToInvoice(inv, plan, { by, date }) {
  return {
    ...inv,
    items: plan.nextItems,
    total: plan.nextTotal,
    cost: plan.nextCost,
    loyaltyEarned: Math.max(0, (inv.loyaltyEarned || 0) - plan.pointsBack),
    // فاتورة رُجِّعت بالكامل تُعامَل كملغاة: أثرها عُكس هنا، وحارس applyReversal
    // يمنع عكسها مرة أخرى لو أُلغيت أو حُذفت لاحقاً
    status: plan.fullyReturned ? "ملغاة" : inv.status,
    returns: [...(inv.returns || []), { date, by, amount: plan.refund, lines: plan.lines }],
  };
}
