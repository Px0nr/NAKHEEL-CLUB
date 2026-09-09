/* =========================================================================
   حفظ سلة نقطة البيع الجارية على الجهاز — كانت حالة React مؤقتة فقط، فأي
   تحديث للصفحة أو انقطاع كهرباء لحظي يمسح كل الأصناف أمام الزبون.

   لماذا localStorage مباشرةً لا usePersistentState؟
   لأن الأخيرة تُزامن المفتاح بين الأجهزة عبر Supabase Realtime: سلة الكاشير
   الأول كانت ستظهر على شاشة الكاشير الثاني وتطمس سلته — أسوأ من فقدانها.
   السلة الجارية تخصّ الجهاز وحده. (الفواتير المعلَّقة تبقى مشتركة عمداً:
   تُعلَّق على صندوق وتُستأنف من آخر.)
   ========================================================================= */

const KEY = "nakheel_pos_cart";
// سلة أقدم من نوبة عمل كاملة ليست عملاً معلَّقاً بل بقايا — تُهمَل بدل استعادة
// أسعار وكميات قديمة على زبون جديد
export const CART_MAX_AGE_MS = 12 * 60 * 60 * 1000;

/* مطابقة السلة المستعادة مع الواقع الحالي — دالة نقية ليسهل اختبارها.
   بين الحفظ والاستعادة قد يكون صنف حُذف، أو أُلغي تسعيره، أو باعه صندوق آخر. */
export function reconcileCart(saved, products) {
  const cart = {}, dropped = [], clamped = [];
  const usedPieces = {}; // pid -> قطع حجزتها أسطر سابقة (قطعة/علبة لنفس المنتج)

  Object.values(saved || {}).forEach(it => {
    const p = products.find(x => x.id === it.pid);
    if (!p || !p.sell) { dropped.push(it.name); return; }

    let qty = it.qty;
    if (p.stock !== null) {
      const left = p.stock - (usedPieces[p.id] || 0);
      const maxQty = Math.max(0, Math.floor(left / it.perPieces));
      if (maxQty <= 0) { dropped.push(it.name); return; }
      if (qty > maxQty) { qty = maxQty; clamped.push(it.name); }
      usedPieces[p.id] = (usedPieces[p.id] || 0) + qty * it.perPieces;
    }
    cart[it.key] = { ...it, qty };
  });

  return { cart, dropped, clamped };
}

export function saveCart(cart) {
  try {
    if (!cart || Object.keys(cart).length === 0) { localStorage.removeItem(KEY); return; }
    localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), cart }));
  } catch { /* وضع خاص أو حصة ممتلئة — الحفظ تحسين لا شرط لعمل نقطة البيع */ }
}

export function clearCart() {
  try { localStorage.removeItem(KEY); } catch { /* تجاهَل */ }
}

/* يعيد { cart, dropped, clamped } دائماً — سلة فارغة إن لم يوجد شيء صالح */
export function loadCart(products, now = Date.now()) {
  const empty = { cart: {}, dropped: [], clamped: [] };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.cart || typeof parsed.at !== "number") { clearCart(); return empty; }
    if (now - parsed.at > CART_MAX_AGE_MS) { clearCart(); return empty; }
    return reconcileCart(parsed.cart, products || []);
  } catch { return empty; }
}
