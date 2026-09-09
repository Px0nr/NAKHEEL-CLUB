// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { reconcileCart, saveCart, loadCart, clearCart, CART_MAX_AGE_MS } from "./posCart.js";

const products = [
  { id: 1, name: "قهوة", sell: 5, stock: 10 },
  { id: 2, name: "علبة عصير", sell: 3, stock: 24 },
  { id: 3, name: "حجز طاولة", sell: 20, stock: null }, // خدمة بلا مخزون
  { id: 4, name: "صنف بلا سعر", sell: 0, stock: 5 },
];
const line = (over) => ({ key: "1:piece", pid: 1, name: "قهوة", perPieces: 1, qty: 2, unitPrice: 5, ...over });

describe("reconcileCart", () => {
  it("يُبقي السلة كما هي حين لا شيء تغيّر", () => {
    const saved = { "1:piece": line() };
    const res = reconcileCart(saved, products);
    expect(res.cart["1:piece"].qty).toBe(2);
    expect(res.dropped).toEqual([]);
    expect(res.clamped).toEqual([]);
  });

  it("يُسقط صنفاً حُذف من النظام بعد الحفظ", () => {
    const saved = { "9:piece": line({ key: "9:piece", pid: 9, name: "صنف محذوف" }) };
    const res = reconcileCart(saved, products);
    expect(res.cart).toEqual({});
    expect(res.dropped).toEqual(["صنف محذوف"]);
  });

  it("يُسقط صنفاً أُلغي تسعيره", () => {
    const saved = { "4:piece": line({ key: "4:piece", pid: 4, name: "صنف بلا سعر" }) };
    expect(reconcileCart(saved, products).dropped).toEqual(["صنف بلا سعر"]);
  });

  it("يقلّص الكمية إلى المتاح إن باع صندوق آخر جزءاً من المخزون", () => {
    const saved = { "1:piece": line({ qty: 50 }) };
    const res = reconcileCart(saved, products);
    expect(res.cart["1:piece"].qty).toBe(10); // كل المخزون المتبقي
    expect(res.clamped).toEqual(["قهوة"]);
  });

  it("يُسقط الصنف كلياً إن نفد مخزونه", () => {
    const res = reconcileCart({ "1:piece": line() }, [{ id: 1, name: "قهوة", sell: 5, stock: 0 }]);
    expect(res.cart).toEqual({});
    expect(res.dropped).toEqual(["قهوة"]);
  });

  it("يحسب سطرَي القطعة والعلبة لنفس المنتج معاً ضمن سقف المخزون", () => {
    const saved = {
      "2:pack": { key: "2:pack", pid: 2, name: "علبة عصير", perPieces: 12, qty: 2 }, // 24 قطعة = كل المخزون
      "2:piece": { key: "2:piece", pid: 2, name: "علبة عصير", perPieces: 1, qty: 3 },
    };
    const res = reconcileCart(saved, products);
    expect(res.cart["2:pack"].qty).toBe(2);
    expect(res.cart["2:piece"]).toBeUndefined(); // لم يبقَ شيء للسطر الثاني
    expect(res.dropped).toEqual(["علبة عصير"]);
  });

  it("لا يقيّد الخدمات (stock === null) بأي سقف", () => {
    const saved = { "3:piece": line({ key: "3:piece", pid: 3, name: "حجز طاولة", qty: 99 }) };
    expect(reconcileCart(saved, products).cart["3:piece"].qty).toBe(99);
  });

  it("يتحمّل سلة فارغة أو غير معرَّفة", () => {
    expect(reconcileCart(null, products).cart).toEqual({});
    expect(reconcileCart({}, products).cart).toEqual({});
  });
});

describe("التخزين على الجهاز", () => {
  beforeEach(() => clearCart());

  it("يحفظ السلة ويستعيدها", () => {
    saveCart({ "1:piece": line() });
    expect(loadCart(products).cart["1:piece"].qty).toBe(2);
  });

  it("يمسح المخزَّن حين تُفرَّغ السلة", () => {
    saveCart({ "1:piece": line() });
    saveCart({});
    expect(loadCart(products).cart).toEqual({});
  });

  it("يُهمل سلة أقدم من المدة المسموحة بدل استعادة بقايا نوبة سابقة", () => {
    saveCart({ "1:piece": line() });
    const later = Date.now() + CART_MAX_AGE_MS + 1000;
    expect(loadCart(products, later).cart).toEqual({});
  });

  it("يتحمّل محتوى تالفاً في التخزين بلا انهيار", () => {
    localStorage.setItem("nakheel_pos_cart", "{ليس JSON صالحاً");
    expect(loadCart(products).cart).toEqual({});
  });
});
