/* غرامة تأخير إرجاع جهاز مؤجَّر — كان الإرجاع يُحرِّر الجهاز بلا أي رسم مهما
   طال التأخير، رغم أن الشاشة نفسها تعرض العدّاد سالباً بوضوح للموظف. الغرامة
   = يوم كامل أو جزء منه بسعر اليوم الإضافي — دالة نقية ليسهل اختبارها. */
export function computeLateFee(endAtIso, returnedAtIso, dailyRate) {
  const lateMs = new Date(returnedAtIso).getTime() - new Date(endAtIso).getTime();
  if (lateMs <= 0) return { lateDays: 0, lateFee: 0 };
  const lateDays = Math.ceil(lateMs / 86400000);
  return { lateDays, lateFee: Math.round(lateDays * dailyRate * 100) / 100 };
}
