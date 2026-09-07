// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import POS from "./POS.jsx";

/* =========================================================================
   تدفّق البيع — الوظيفة التجارية الأساسية للنظام.

   اختبارات الوحدة تغطّي الحساب النقي، لكنها لا تمسك انقطاع السلك بين
   الحساب والواجهة: زرّ لا يستدعي شيئاً، ref غير موصول، حالة لا تصل للسلة.
   هذه الاختبارات تُركّب المكوّن وتضغط أزراره فعلياً.
   ========================================================================= */

const PRODUCTS = [
  { id: 1, name: "مشروب طاقة", cat: "cafe", bc: "NKH001", unit: "علبة", packSize: 24, sell: 2.5, sellPack: 55, buy: 1.2, stock: 100, min: 10, status: "active" },
  { id: 2, name: "قهوة تركية", cat: "cafe", bc: "NKH002", unit: "كوب", packSize: 1, sell: 3, sellPack: 3, buy: 1, stock: 50, min: 10, status: "active" },
];

function makeCtx(overrides = {}) {
  const state = { invoices: [], products: [...PRODUCTS], parkedSales: [], customers: [], toasts: [] };
  return {
    state,
    ctx: {
      products: state.products,
      setProducts: (fn) => { state.products = typeof fn === "function" ? fn(state.products) : fn; },
      invoices: state.invoices,
      setInvoices: (fn) => { state.invoices = typeof fn === "function" ? fn(state.invoices) : fn; },
      coupons: [], customers: state.customers, setCustomers: () => {},
      employees: [], promotions: [],
      user: { id: "U1", name: "مدير الاختبار", role: "مدير", perms: {} },
      showToast: (m) => state.toasts.push(m),
      settings: { currency: "د.ل", posMode: "grid", animations: false },
      parkedSales: state.parkedSales, setParkedSales: (fn) => { state.parkedSales = typeof fn === "function" ? fn(state.parkedSales) : fn; },
      cats: { cafe: "كافيه", games: "ألعاب فيديو" },
      nextCounter: () => 1001,
      scr: { w: 1280, isTab: false },
      ...overrides,
    },
  };
}

beforeEach(() => {
  localStorage.clear();
  if (!window.matchMedia) window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const renderPOS = (over) => {
  const { state, ctx } = makeCtx(over);
  render(<POS ctx={ctx} can={() => true} />);
  return { state, ctx };
};

describe("نقطة البيع — تدفّق البيع", () => {
  it("تُركّب وتعرض المنتجات المتاحة", () => {
    renderPOS();
    expect(screen.getAllByText("مشروب طاقة").length).toBeGreaterThan(0);
    expect(screen.getAllByText("قهوة تركية").length).toBeGreaterThan(0);
  });

  it("السلة فارغة في البداية", () => {
    renderPOS();
    expect(screen.getByText(/لا توجد منتجات بعد/)).toBeTruthy();
  });

  it("الضغط على منتج يضيفه للسلة ويحسب الإجمالي", async () => {
    const { container } = { container: document.body };
    renderPOS();
    fireEvent.click(screen.getAllByText("مشروب طاقة")[0]);
    await waitFor(() => expect(container.querySelectorAll(".nk-cart-row").length).toBe(1));
    // 2.5 د.ل للقطعة الواحدة
    expect(screen.getByText("الإجمالي")).toBeTruthy();
    expect(container.textContent).toContain("2.5");
  });

  it("الضغط مرتين على نفس المنتج يزيد الكمية بدل إنشاء صف ثانٍ", async () => {
    renderPOS();
    fireEvent.click(screen.getAllByText("مشروب طاقة")[0]);
    await waitFor(() => expect(document.querySelectorAll(".nk-cart-row").length).toBe(1));
    fireEvent.click(screen.getAllByText("مشروب طاقة")[0]);
    await waitFor(() => {
      const rows = document.querySelectorAll(".nk-cart-row");
      expect(rows.length).toBe(1);
      expect(rows[0].querySelector("input[type=number]").value).toBe("2");
    });
  });

  it("زرّا الكمية يرفعان ويخفضان، والصف يختفي عند الصفر", async () => {
    renderPOS();
    fireEvent.click(screen.getAllByText("قهوة تركية")[0]);
    await waitFor(() => expect(document.querySelectorAll(".nk-cart-row").length).toBe(1));

    fireEvent.click(screen.getByLabelText("زيادة الكمية"));
    await waitFor(() => expect(document.querySelector(".nk-cart-row input[type=number]").value).toBe("2"));

    fireEvent.click(screen.getByLabelText("إنقاص الكمية"));
    await waitFor(() => expect(document.querySelector(".nk-cart-row input[type=number]").value).toBe("1"));

    fireEvent.click(screen.getByLabelText("إنقاص الكمية"));
    await waitFor(() => expect(document.querySelectorAll(".nk-cart-row").length).toBe(0));
  });

  it("إتمام البيع يُنشئ فاتورة مدفوعة بالإجمالي الصحيح ويُفرغ السلة", async () => {
    const { state } = renderPOS();
    fireEvent.click(screen.getAllByText("مشروب طاقة")[0]); // 2.5
    await waitFor(() => expect(document.querySelectorAll(".nk-cart-row").length).toBe(1));
    fireEvent.click(screen.getAllByText("قهوة تركية")[0]); // 3.0
    await waitFor(() => expect(document.querySelectorAll(".nk-cart-row").length).toBe(2));

    fireEvent.click(screen.getByText(/إتمام البيع/));

    await waitFor(() => expect(state.invoices.length).toBe(1));
    const inv = state.invoices[0];
    expect(inv.total).toBe(5.5);
    expect(inv.status).toBe("مدفوعة");
    expect(inv.items).toHaveLength(2);
    expect(inv.by).toBe("مدير الاختبار");
    await waitFor(() => expect(document.querySelectorAll(".nk-cart-row").length).toBe(0));
  });

  it("إتمام البيع يخصم الكميات من المخزون", async () => {
    const { state } = renderPOS();
    const before = state.products.find(p => p.id === 1).stock;
    fireEvent.click(screen.getAllByText("مشروب طاقة")[0]);
    await waitFor(() => expect(document.querySelectorAll(".nk-cart-row").length).toBe(1));
    fireEvent.click(screen.getByText(/إتمام البيع/));
    await waitFor(() => {
      expect(state.products.find(p => p.id === 1).stock).toBe(before - 1);
    });
  });

  it("لا يُنشئ فاتورة لسلة فارغة", () => {
    const { state } = renderPOS();
    const btn = screen.queryByText(/إتمام البيع/);
    if (btn) fireEvent.click(btn);
    expect(state.invoices).toHaveLength(0);
  });
});
