// استخراج مدة الحجز بالدقائق من نص تفاصيل الفاتورة (للتقارير — لا يوجد حقل مدة مباشر على الفواتير القديمة)
export function parseBookingMinutes(details) {
  if (!details) return 0;
  const tail = details.split(" — ").pop().trim();
  if (tail.includes("ربع")) return 15;
  if (tail.includes("نصف")) return 30;
  if (tail === "ساعة") return 60;
  const m1 = tail.match(/(\d+)\s*س\s*(\d+)?\s*د?/);
  if (m1) return parseInt(m1[1]) * 60 + (parseInt(m1[2]) || 0);
  const m2 = tail.match(/(\d+)\s*د/);
  if (m2) return parseInt(m2[1]);
  return 0;
}
