export const todayISO = () => new Date().toISOString().split("T")[0];
export const arDate = (iso) => (iso ? new Date(iso).toLocaleDateString("ar-LY") : "—");
export const daysBetween = (a, b) => Math.floor((new Date(b) - new Date(a)) / 86400000);
// منتج واحد بعدة باركودات (مثال: عصير بنكهات عنب/مانجا/برتقال — نفس السعر والمخزون، كل نكهة بباركودها الخاص)
export const productBarcodes = (p) => [p.bc, ...((p.barcodes) || [])].filter(Boolean);
export const matchesBarcode = (p, code) => productBarcodes(p).some(b => b === code);
export const matchesBarcodePartial = (p, q) => productBarcodes(p).some(b => b.includes(q));
// returns overdue days (>0 means late) for a deferred invoice, using dueDate or invoice date
export const overdueDays = (inv, ref = todayISO()) => {
  if (inv.pay !== "آجل" || inv.status !== "معلقة") return 0;
  const due = inv.dueDate || inv.date;
  const d = daysBetween(due, ref);
  return d > 0 ? d : 0;
};
export const toWa = (phone) => {
  let d = (phone || "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0")) d = "218" + d.slice(1);
  return d;
};
