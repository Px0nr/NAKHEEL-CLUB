// عدّاد تسلسلي دائم لأرقام الفواتير/التوريدات — لا يعتمد على عدد السجلات الحالية
// (الاعتماد على .length كان يُنتج أرقاماً مكرَّرة بعد أي حذف لفاتورة سابقة)
export function nextCounter(counters, setCounters, key) {
  const next = (counters[key] || 0) + 1;
  setCounters(c => ({ ...c, [key]: next }));
  return next;
}
