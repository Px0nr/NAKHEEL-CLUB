import { describe, it, expect } from "vitest";
import { computeReturn, applyReturnToInvoice } from "./invoiceReturn.js";

const products = [{ id: 1, buy: 4 }, { id: 2, buy: 10 }];
const inv = {
  id: "INV-1", customerId: null, pay: "كاش", status: "مدفوعة", total: 100, cost: 40,
  items: [
    { pid: 1, name: "قهوة", qty: 5, pieces: 5, lineTotal: 50 },
    { pid: 2, name: "علبة عصير", qty: 2, pieces: 24, lineTotal: 50 },
  ],
};

describe("computeReturn — الحساب", () => {
  it("يرجّع جزءاً من سطر ويحسب المبلغ بالتناسب", () => {
    const p = computeReturn(inv, { 0: 2 }, products);
    expect(p.refund).toBe(20);            // 2 من 5 بقيمة 50
    expect(p.costBack).toBe(8);           // 2 قطعة × 4
    expect(p.stock).toEqual({ 1: 2 });
    expect(p.nextTotal).toBe(80);
    expect(p.nextCost).toBe(32);
    expect(p.fullyReturned).toBe(false);
  });

  it("يعيد القطع الحقيقية لا وحدات البيع عند إرجاع علبة", () => {
    const p = computeReturn(inv, { 1: 1 }, products);
    expect(p.stock).toEqual({ 2: 12 });   // علبة واحدة = 12 قطعة
    expect(p.costBack).toBe(120);         // 12 قطعة × 10
    expect(p.refund).toBe(25);
  });

  it("يُبقي السطر بكميته المتبقية ويحدّث pieces معه", () => {
    const p = computeReturn(inv, { 0: 2 }, products);
    expect(p.nextItems[0]).toMatchObject({ qty: 3, pieces: 3, lineTotal: 30 });
  });

  it("يحذف السطر تماماً عند إرجاع كامل كميته", () => {
    const p = computeReturn(inv, { 0: 5 }, products);
    expect(p.nextItems).toHaveLength(1);
    expect(p.nextItems[0].name).toBe("علبة عصير");
  });

  it("يعلّم الفاتورة كمرتجَعة بالكامل حين تُرجَع كل الأسطر", () => {
    const p = computeReturn(inv, { 0: 5, 1: 2 }, products);
    expect(p.refund).toBe(100);
    expect(p.nextTotal).toBe(0);
    expect(p.fullyReturned).toBe(true);
  });

  it("يقصّ الكمية المطلوبة عند سقف كمية السطر", () => {
    expect(computeReturn(inv, { 0: 99 }, products).refund).toBe(50);
  });

  it("يتجاهل الكميات الصفرية والسالبة وغير الرقمية", () => {
    expect(computeReturn(inv, { 0: 0, 1: -3 }, products).refund).toBe(0);
    expect(computeReturn(inv, { 0: "س" }, products).refund).toBe(0);
  });

  it("يتراجع إلى qty في الفواتير القديمة بلا حقل pieces", () => {
    const legacy = { ...inv, items: [{ pid: 1, name: "قهوة", qty: 4, lineTotal: 40 }] };
    expect(computeReturn(legacy, { 0: 2 }, products).stock).toEqual({ 1: 2 });
  });
});

describe("computeReturn — حساب الزبون", () => {
  it("لا يمسّ زبوناً في بيع نقدي بلا حساب", () => {
    expect(computeReturn(inv, { 0: 1 }, products).customer).toBeNull();
  });

  it("يخصم الدَين وإجمالي المشتريات لفاتورة آجلة غير مسدَّدة", () => {
    const d = { ...inv, customerId: 7, pay: "آجل", status: "معلقة" };
    const c = computeReturn(d, { 0: 2 }, products).customer;
    expect(c).toMatchObject({ id: 7, debtDelta: -20, totalDelta: -20 });
  });

  it("لا يخصم الدَين مرتين لفاتورة آجلة سُدِّدت، لكنه يخصم المشتريات", () => {
    const d = { ...inv, customerId: 7, pay: "آجل", status: "مدفوعة" };
    const c = computeReturn(d, { 0: 2 }, products).customer;
    expect(c.debtDelta).toBe(0);
    expect(c.totalDelta).toBe(-20);
  });

  it("يسحب نقاط الولاء بنسبة المبلغ المرتجَع", () => {
    const d = { ...inv, customerId: 3, loyaltyEarned: 10 };
    const p = computeReturn(d, { 0: 2 }, products); // 20 من 100 = 20%
    expect(p.pointsBack).toBe(2);
    expect(p.customer.pointsDelta).toBe(-2);
  });
});

describe("applyReturnToInvoice", () => {
  it("يخفّض الفاتورة ويسجّل الإرجاع في سجلّها", () => {
    const plan = computeReturn(inv, { 0: 2 }, products);
    const next = applyReturnToInvoice(inv, plan, { by: "أحمد", date: "2026-09-09" });
    expect(next.total).toBe(80);
    expect(next.cost).toBe(32);
    expect(next.status).toBe("مدفوعة");
    expect(next.returns).toHaveLength(1);
    expect(next.returns[0]).toMatchObject({ by: "أحمد", amount: 20 });
  });

  it("يجعل الفاتورة «ملغاة» عند إرجاعها بالكامل حتى لا يُعكس أثرها مرتين لاحقاً", () => {
    const plan = computeReturn(inv, { 0: 5, 1: 2 }, products);
    expect(applyReturnToInvoice(inv, plan, { by: "أ", date: "2026-09-09" }).status).toBe("ملغاة");
  });

  it("يراكم أكثر من إرجاع على نفس الفاتورة ويحسب النقاط على ما تبقّى", () => {
    const d = { ...inv, customerId: 3, loyaltyEarned: 10 };
    const first = applyReturnToInvoice(d, computeReturn(d, { 0: 2 }, products), { by: "أ", date: "2026-09-09" });
    expect(first.loyaltyEarned).toBe(8);
    const second = applyReturnToInvoice(first, computeReturn(first, { 0: 3 }, products), { by: "أ", date: "2026-09-09" });
    expect(second.total).toBe(50);
    expect(second.returns).toHaveLength(2);
  });
});
