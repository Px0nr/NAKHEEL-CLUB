// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import App from "./App.jsx";
import { DB } from "./db/db.js";

/* =========================================================================
   اختبار إقلاع: يتحقّق أن التطبيق يُركّب فعلاً ويعرض شيئاً.

   هذا ما كان ينقص: خطأ منطقة ميتة زمنية (استعمال const قبل تعريفه) ترك
   التطبيق شاشة بيضاء، ومرّ من البناء ومن lint ومن 120 اختبار وحدة — لأن
   أياً منها لا يُركّب المكوّن. أي خطأ رندر في الشجرة العليا يُسقط هذا
   الاختبار فوراً.
   ========================================================================= */

// إعادة ضبط طبقة البيانات لحالة نظيفة قبل كل اختبار
function resetDB(seed = {}) {
  localStorage.clear();
  DB.ready = false;
  DB.mode = "local";
  DB.cache = {};
  DB.client = null;
  DB.timers = {};
  DB.lastWriteError = null;
  DB.onWriteError = null;
  DB.onBackupChange = null;
  if (Object.keys(seed).length) localStorage.setItem("nakheel_db", JSON.stringify(seed));
}

beforeEach(() => {
  resetDB();
  // مواعيد الحركة تعتمد matchMedia — غير مُنفَّذة في jsdom
  if (!window.matchMedia) {
    window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  }
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("إقلاع التطبيق", () => {
  it("يُركّب بلا انهيار ويعرض محتوى", async () => {
    const { container } = render(<App />);
    // شاشة الإقلاع أولاً، ثم شجرة التطبيق بعد تهيئة قاعدة البيانات
    await waitFor(() => expect(container.textContent.length).toBeGreaterThan(0));
    expect(container.querySelector("#root, div")).toBeTruthy();
  });

  it("يعرض شاشة الإعداد الأولي حين لا يوجد مستخدمون", async () => {
    resetDB(); // قاعدة فارغة تماماً
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText(/الإعداد الأولي/)).toBeTruthy();
    }, { timeout: 3000 });
  });

  it("يعرض شاشة الدخول حين يوجد مستخدم مسجَّل", async () => {
    resetDB({
      __initialized: true,
      users: [{ id: "U1", name: "مدير الاختبار", username: "admin", role: "مدير", pin: "hash", perms: {} }],
    });
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText(/اختر المستخدم لتسجيل الدخول|مرحباً/)).toBeTruthy();
    }, { timeout: 3000 });
  });

  it("لا يُسجّل أي خطأ في الطرفية أثناء الإقلاع", async () => {
    const errors = [];
    vi.spyOn(console, "error").mockImplementation((...a) => errors.push(a.join(" ")));
    resetDB({
      __initialized: true,
      users: [{ id: "U1", name: "مدير الاختبار", username: "admin", role: "مدير", pin: "hash", perms: {} }],
    });
    render(<App />);
    await waitFor(() => expect(screen.getByText(/اختر المستخدم|مرحباً/)).toBeTruthy(), { timeout: 3000 });
    expect(errors).toEqual([]);
  });
});
