import { describe, it, expect, vi } from "vitest";
import { computeReversal, applyReversal } from "./invoiceReversal.js";

const cashInvoice = {
  id: "INV-1", customerId: null, pay: "كاش", status: "مدفوعة", total: 50,
  items: [{ pid: 1, qty: 2, pieces: 2, lineTotal: 50 }],
};

describe("computeReversal — المخزون", () => {
  it("يعيد عدد القطع الفعلي لا عدد وحدات البيع (بيع بالعلبة)", () => {
    const inv = { ...cashInvoice, items: [{ pid: 1, qty: 2, pieces: 48 }] };
    expect(computeReversal(inv).stock).toEqual({ 1: 48 });
    expect(computeReversal(inv).approximate).toBe(false);
  });

  it("يجمع أسطر نفس المنتج (قطعة + علبة في فاتورة واحدة)", () => {
    const inv = { ...cashInvoice, items: [{ pid: 1, qty: 3, pieces: 3 }, { pid: 1, qty: 1, pieces: 24 }] };
    expect(computeReversal(inv).stock).toEqual({ 1: 27 });
  });

  it("يتراجع إلى qty ويرفع approximate للفواتير القديمة بلا حقل pieces", () => {
    const inv = { ...cashInvoice, items: [{ pid: 1, qty: 2 }] };
    const plan = computeReversal(inv);
    expect(plan.stock).toEqual({ 1: 2 });
    expect(plan.approximate).toBe(true);
  });

  it("يتجاهل الأسطر بلا pid (حجوزات وخدمات)", () => {
    const inv = { ...cashInvoice, items: [{ name: "حجز طاولة", qty: 1 }] };
    expect(computeReversal(inv).stock).toEqual({});
  });

  it("يتحمّل فاتورة بلا items إطلاقاً", () => {
    expect(computeReversal({ id: "INV-9", total: 10 }).stock).toEqual({});
  });
});

describe("computeReversal — حساب الزبون", () => {
  it("لا يمسّ أي زبون في بيع نقدي بلا حساب", () => {
    expect(computeReversal(cashInvoice).customer).toBeNull();
  });

  it("يخصم الدَين وإجمالي المشتريات وعدّاد الفواتير لفاتورة آجلة غير مسدَّدة", () => {
    const inv = { ...cashInvoice, customerId: 7, pay: "آجل", status: "معلقة", total: 120 };
    expect(computeReversal(inv).customer).toEqual({
      id: 7, debtDelta: -120, totalDelta: -120, invoicesDelta: -1, pointsDelta: 0,
    });
  });

  it("لا يخصم الدَين مرتين إن كانت الفاتورة الآجلة قد سُدِّدت فعلاً", () => {
    const inv = { ...cashInvoice, customerId: 7, pay: "آجل", status: "مدفوعة", paidVia: "كاش", total: 120 };
    const c = computeReversal(inv).customer;
    expect(c.debtDelta).toBe(0);          // خُصم عند السداد
    expect(c.totalDelta).toBe(-120);      // لكن المشتريات والعدّاد يُعكسان
    expect(c.invoicesDelta).toBe(-1);
  });

  it("يعكس نقاط الولاء المكتسبة والمستبدَلة في بيع نقدي لزبون مسجَّل", () => {
    const inv = { ...cashInvoice, customerId: 3, loyaltyEarned: 12, loyaltyRedeemed: 100 };
    const c = computeReversal(inv).customer;
    expect(c.pointsDelta).toBe(88);       // ‎-12 مكتسبة + 100 مستبدَلة تعود
    expect(c.debtDelta).toBe(0);
    expect(c.totalDelta).toBe(0);         // البيع النقدي لا يزيد الإجمالي أصلاً
  });
});

describe("applyReversal", () => {
  it("يعيد المخزون للمنتج المعني فقط ولا يمسّ الخدمات (stock === null)", () => {
    let products = [{ id: 1, stock: 5 }, { id: 2, stock: null }, { id: 3, stock: 9 }];
    const setProducts = vi.fn(fn => { products = fn(products); });
    const inv = { ...cashInvoice, items: [{ pid: 1, qty: 1, pieces: 6 }, { pid: 2, qty: 1, pieces: 4 }] };

    applyReversal(inv, { setProducts, setCustomers: vi.fn() });

    expect(products).toEqual([{ id: 1, stock: 11 }, { id: 2, stock: null }, { id: 3, stock: 9 }]);
  });

  it("لا يعكس فاتورة ملغاة مرتين (الإلغاء عكسها، فالحذف لا يعيد الكرّة)", () => {
    const setProducts = vi.fn(), setCustomers = vi.fn();
    const res = applyReversal({ ...cashInvoice, status: "ملغاة" }, { setProducts, setCustomers });

    expect(res.skipped).toBe(true);
    expect(setProducts).not.toHaveBeenCalled();
    expect(setCustomers).not.toHaveBeenCalled();
  });

  it("لا يترك دَيناً أو نقاطاً بالسالب مهما كانت البيانات", () => {
    let customers = [{ id: 7, debt: 30, total: 30, invoices: 0, points: 5 }];
    const setCustomers = vi.fn(fn => { customers = fn(customers); });
    const inv = { id: "INV-2", customerId: 7, pay: "آجل", status: "معلقة", total: 500, loyaltyEarned: 99, items: [] };

    applyReversal(inv, { setProducts: vi.fn(), setCustomers });

    expect(customers[0]).toMatchObject({ debt: 0, total: 0, invoices: 0, points: 0 });
  });
});
