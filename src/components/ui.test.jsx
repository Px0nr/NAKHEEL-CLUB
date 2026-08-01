// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { Modal } from "./ui.jsx";
import { setAppAnimations } from "../utils/motionPrefs.js";

/* =========================================================================
   سلوك النافذة — حركة الخروج تؤجّل الإزالة، وهذا يعني أن خطأ في التوقيت
   يترك النافذة مفتوحة للأبد. المؤقّت لا يعتمد على animationend لأن الحدث
   لا يُطلَق أصلاً عند تعطيل الحركة؛ هذه الاختبارات تثبّت الحالتين معاً.
   ========================================================================= */

beforeEach(() => {
  setAppAnimations(true);
  if (!window.matchMedia) window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("Modal", () => {
  it("يعرض العنوان والمحتوى مع سمات الوصول", () => {
    render(<Modal title="عنوان الاختبار" onClose={() => {}}><p>محتوى</p></Modal>);
    const dlg = screen.getByRole("dialog");
    expect(dlg.getAttribute("aria-modal")).toBe("true");
    expect(screen.getByText("عنوان الاختبار")).toBeTruthy();
    expect(screen.getByText("محتوى")).toBeTruthy();
  });

  it("زرّ الإغلاق يستدعي onClose بعد انتهاء حركة الخروج", () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(<Modal title="ت" onClose={onClose}><p>م</p></Modal>);

    fireEvent.click(screen.getByLabelText("إغلاق"));
    // لا يُزال فوراً — الحركة جارية
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog").className).toBe("nk-modal-out");

    act(() => { vi.advanceTimersByTime(200); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("مفتاح Escape يغلق النافذة", () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(<Modal title="ت" onClose={onClose}><p>م</p></Modal>);
    fireEvent.keyDown(document, { key: "Escape" });
    act(() => { vi.advanceTimersByTime(200); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("الضغط على الخلفية يغلق، والضغط داخل النافذة لا يغلق", () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(<Modal title="ت" onClose={onClose}><p>محتوى داخلي</p></Modal>);

    fireEvent.click(screen.getByText("محتوى داخلي"));
    act(() => { vi.advanceTimersByTime(300); });
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("dialog").parentElement);
    act(() => { vi.advanceTimersByTime(300); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("يُغلق فوراً بلا تأخير حين تكون الحركة معطّلة", () => {
    vi.useFakeTimers();
    setAppAnimations(false); // لا حركة ⇒ لا animationend ⇒ يجب ألا ننتظر
    const onClose = vi.fn();
    render(<Modal title="ت" onClose={onClose}><p>م</p></Modal>);
    fireEvent.click(screen.getByLabelText("إغلاق"));
    expect(onClose).toHaveBeenCalledTimes(1); // بلا تقديم أي مؤقّت
  });

  it("النقر المتكرّر على الإغلاق لا يستدعي onClose أكثر من مرة", () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(<Modal title="ت" onClose={onClose}><p>م</p></Modal>);
    const btn = screen.getByLabelText("إغلاق");
    fireEvent.click(btn); fireEvent.click(btn); fireEvent.click(btn);
    act(() => { vi.advanceTimersByTime(400); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
