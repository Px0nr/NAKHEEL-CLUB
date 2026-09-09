/* =========================================================================
   حجز مسبق لطاولة/ملعب بموعد مستقبلي — كان النظام يدعم فقط بدء حجز من اللحظة
   الحالية، فحجوزات هاتفية أو شفهية («الطاولة 3 محجوزة الساعة 8») لا مكان لها
   إلا الورق. الحجز المسبق يعيش في قائمة reservations منفصلة عن bookings
   (الحجوزات النشطة فعلياً) حتى يبدأ فعلياً — عندها يتحوّل إلى حجز نشط عادي.
   ========================================================================= */

// تداخل فترتين زمنيتين (نصف مفتوح: نهاية إحداهما = بداية الأخرى ليس تداخلاً)
export const overlaps = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && bStart < aEnd;

// نطاق حجز نشط (bookings[id]) بالمللي ثانية — الحجز المفتوح (بلا مدة محددة) يُعامَل
// كأنه يشغل الطاولة حتى نهاية اليوم لأغراض فحص التعارض، إذ لا نهاية معروفة له
export function activeBookingRange(b) {
  const start = b.startTime;
  if (b.durationMin == null) {
    const end = new Date(start); end.setHours(23, 59, 59, 999);
    return { start, end: end.getTime() };
  }
  return { start, end: start + b.durationMin * 60000 };
}

export function reservationRange(r) {
  const start = new Date(r.startAt).getTime();
  return { start, end: start + r.durationMin * 60000 };
}

/* أول تعارض لموعد [start,end] على طاولة بعينها — يفحص الحجوزات النشطة الآن
   والحجوزات المستقبلية معاً. excludeReservationId يستثني حجزاً نفسه عند تعديله. */
export function findConflict(tableId, start, end, { bookings = {}, reservations = [] }, excludeReservationId = null) {
  for (const b of Object.values(bookings)) {
    if (b.tableId !== tableId) continue;
    const r = activeBookingRange(b);
    if (overlaps(start, end, r.start, r.end)) return { kind: "active", customer: b.customer, ...r };
  }
  for (const res of reservations) {
    if (res.tableId !== tableId || res.id === excludeReservationId || res.status !== "محجوز") continue;
    const r = reservationRange(res);
    if (overlaps(start, end, r.start, r.end)) return { kind: "reservation", customer: res.customerName, ...r };
  }
  return null;
}

// حجوزات طاولة بعينها ضمن يوم مُعطى، مرتَّبة زمنياً — أساس العرض الزمني اليومي
export function reservationsForTableOnDay(tableId, reservations, dayISO) {
  return reservations
    .filter(r => r.tableId === tableId && r.status === "محجوز" && r.startAt.slice(0, 10) === dayISO)
    .sort((a, b) => a.startAt.localeCompare(b.startAt));
}

// أقرب حجز قادم اليوم لطاولة معيَّنة — يُعرض كتحذير على بطاقة الطاولة المتاحة
// حتى لا يُحجز موظف الاستقبال طاولةً لزبون طارئ ستتعارض بعد نصف ساعة
export function nextReservationToday(tableId, reservations, nowIso = new Date().toISOString()) {
  const day = nowIso.slice(0, 10);
  const now = new Date(nowIso).getTime();
  return reservationsForTableOnDay(tableId, reservations, day).find(r => new Date(r.startAt).getTime() >= now) || null;
}

// حجز فات وقته بأكثر من هذه المهلة بلا تسجيل وصول — يُعرض كـ«متأخر» ليقرّر
// الموظف تسجيله عدم حضور بدل بقائه صامتاً في القائمة إلى الأبد
export const RESERVATION_GRACE_MS = 20 * 60000;
export function isOverdue(res, now = Date.now()) {
  return res.status === "محجوز" && now - new Date(res.startAt).getTime() > RESERVATION_GRACE_MS;
}
