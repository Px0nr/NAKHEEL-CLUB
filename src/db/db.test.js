import { describe, it, expect, vi, beforeEach } from "vitest";
import { DB } from "./db.js";

describe("DB realtime subscriber mechanism", () => {
  beforeEach(() => {
    DB.subscribers = {};
    DB.cache = {};
  });

  it("notifies a subscribed callback when a remote change arrives", () => {
    const cb = vi.fn();
    DB.onRemoteChange("products", cb);
    DB._applyRemote("products", [{ id: 1, name: "test" }]);
    expect(cb).toHaveBeenCalledWith([{ id: 1, name: "test" }]);
  });

  it("updates the in-memory cache so later reads see the remote value", () => {
    DB._applyRemote("settings", { theme: "dark" });
    expect(DB.cache.settings).toEqual({ theme: "dark" });
  });

  it("does not notify subscribers of a different key", () => {
    const cb = vi.fn();
    DB.onRemoteChange("products", cb);
    DB._applyRemote("customers", []);
    expect(cb).not.toHaveBeenCalled();
  });

  it("notifies every subscriber registered for the same key", () => {
    const cb1 = vi.fn(); const cb2 = vi.fn();
    DB.onRemoteChange("invoices", cb1);
    DB.onRemoteChange("invoices", cb2);
    DB._applyRemote("invoices", [1, 2, 3]);
    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenCalledTimes(1);
  });

  it("stops notifying once unsubscribed", () => {
    const cb = vi.fn();
    const unsubscribe = DB.onRemoteChange("products", cb);
    unsubscribe();
    DB._applyRemote("products", []);
    expect(cb).not.toHaveBeenCalled();
  });

  it("does not let a throwing subscriber break other subscribers", () => {
    const good = vi.fn();
    DB.onRemoteChange("products", () => { throw new Error("boom"); });
    DB.onRemoteChange("products", good);
    expect(() => DB._applyRemote("products", [])).not.toThrow();
    expect(good).toHaveBeenCalled();
  });
});

/* localStorage وهمي بحصة محدودة — يحاكي امتلاء المساحة الذي يقع فعلياً
   عندما تُخزَّن صور المنتجات base64 داخل مخزن البيانات */
function installFakeStorage({ limitChars = Infinity } = {}) {
  const store = new Map();
  const fake = {
    get length() { return store.size; },
    key: (i) => [...store.keys()][i] ?? null,
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
    setItem: (k, v) => {
      let total = String(v).length;
      for (const [ek, ev] of store) if (ek !== k) total += ev.length;
      if (total > limitChars) {
        const err = new Error("exceeded the quota");
        err.name = "QuotaExceededError";
        throw err;
      }
      store.set(k, String(v));
    },
  };
  globalThis.localStorage = fake;
  return fake;
}

describe("DB write-failure reporting", () => {
  beforeEach(() => {
    DB.cache = {};
    DB.mode = "local";
    DB.lastWriteError = null;
    DB.onWriteError = null;
  });

  it("يبلّغ الواجهة عند فشل الكتابة بدل ابتلاع الخطأ", async () => {
    installFakeStorage({ limitChars: 10 });
    const onErr = vi.fn();
    DB.onWriteError = onErr;
    DB.cache.invoices = new Array(500).fill({ id: 1, total: 100 });

    await DB.flush("invoices");

    expect(onErr).toHaveBeenCalledTimes(1);
    const info = onErr.mock.calls[0][0];
    expect(info.quota).toBe(true);       // يُميّز امتلاء الحصة عن أي خطأ آخر
    expect(info.key).toBe("invoices");
    expect(DB.lastWriteError).toEqual(info);
  });

  it("يرفع الإنذار تلقائياً عند نجاح كتابة لاحقة", async () => {
    installFakeStorage({ limitChars: 10 });
    const onErr = vi.fn();
    DB.onWriteError = onErr;
    DB.cache.big = "x".repeat(100);
    await DB.flush("big");
    expect(DB.lastWriteError).not.toBeNull();

    installFakeStorage({});               // مساحة متاحة من جديد
    DB.cache = { small: "ok" };
    await DB.flush("small");

    expect(DB.lastWriteError).toBeNull();
    expect(onErr).toHaveBeenLastCalledWith(null); // الواجهة تُخطَر بزوال العطل
  });

  it("لا يسقط الحفظ إن رمى معالج الخطأ نفسه استثناءً", async () => {
    installFakeStorage({ limitChars: 5 });
    DB.onWriteError = () => { throw new Error("معالج سيّئ"); };
    DB.cache.x = "y".repeat(50);
    await expect(DB.flush("x")).resolves.toBeUndefined();
  });
});

describe("DB auto-backup separation", () => {
  beforeEach(() => {
    DB.cache = {};
    DB.mode = "local";
    DB.lastWriteError = null;
    DB.onWriteError = null;
    installFakeStorage({});
  });

  it("يحفظ النسخة خارج مخزن البيانات فلا يتضاعف حجم كل عملية حفظ", () => {
    DB.cache.products = [{ id: 1, name: "منتج" }];
    DB.saveAutoBackup();

    // النسخة ليست داخل cache — وإلا لكتبها flush مع كل تغيير
    expect(DB.cache.__autobackup).toBeUndefined();
    expect(localStorage.getItem("nakheel_backup")).toBeTruthy();
    // ومخزن البيانات نفسه لا يحتوي على نصّ النسخة
    expect(localStorage.getItem("nakheel_db") || "").not.toContain("__nakheel_backup");
  });

  it("يسترجع النسخة المحفوظة بمحتواها", () => {
    DB.cache.products = [{ id: 7, name: "قهوة" }];
    DB.saveAutoBackup();
    const back = DB.getAutoBackup();
    expect(back.__nakheel_backup).toBe(true);
    expect(back.data.products).toEqual([{ id: 7, name: "قهوة" }]);
  });

  it("ينقل النسخ القديمة المخزّنة داخل cache مرة واحدة", () => {
    DB.cache.__autobackup = { __nakheel_backup: true, version: 1, data: { products: [{ id: 3 }] } };
    expect(DB.migrateAutoBackup()).toBe(true);
    expect(DB.cache.__autobackup).toBeUndefined();     // حُرّرت المساحة
    expect(DB.getAutoBackup().data.products).toEqual([{ id: 3 }]); // ولم تُفقد النسخة
    expect(DB.migrateAutoBackup()).toBe(false);        // لا تتكرّر
  });

  it("يبلّغ عن فشل حفظ النسخة بدل الصمت", () => {
    installFakeStorage({ limitChars: 20 });
    const onErr = vi.fn();
    DB.onWriteError = onErr;
    DB.cache.products = new Array(200).fill({ id: 1, name: "منتج طويل الاسم" });
    expect(DB.saveAutoBackup()).toBeNull();
    expect(onErr).toHaveBeenCalled();
    expect(onErr.mock.calls[0][0].quota).toBe(true);
  });
});

describe("DB file-backup tracking", () => {
  beforeEach(() => {
    DB.cache = {};
    DB.mode = "local";
    DB.lastWriteError = null;
    DB.onWriteError = null;
    installFakeStorage({});
  });

  it("اللقطة الداخلية لا تُسجَّل كنسخة ملف", () => {
    DB.cache.products = [{ id: 1 }];
    DB.saveAutoBackup();
    // كان الاثنان يشتركان في تاريخ واحد، فتُطفئ اللقطة تنبيه النسخ بلا حماية فعلية
    expect(DB.lastBackupAt()).toBeTruthy();
    expect(DB.lastFileBackupAt()).toBeNull();
  });

  it("التنزيل كملف يسجّل تاريخه المنفصل", () => {
    // بيئة الاختبار node بلا DOM — أدنى ما يحتاجه التنزيل من واجهات المتصفح
    const clicked = [];
    globalThis.document = {
      createElement: () => ({ click() { clicked.push(this.download); }, set href(v) { this._h = v; } }),
      body: { appendChild() {}, removeChild() {} },
    };
    globalThis.URL = { createObjectURL: () => "blob:x", revokeObjectURL() {} };
    globalThis.Blob = class { constructor(parts) { this.parts = parts; } };
    try {
      DB.cache.products = [{ id: 1 }];
      expect(DB.lastFileBackupAt()).toBeNull();
      const name = DB.downloadBackupFile();
      expect(name).toMatch(/^nakheel-backup-\d{4}-\d{2}-\d{2}\.json$/);
      expect(DB.lastFileBackupAt()).toBeTruthy();
    } finally {
      delete globalThis.document; delete globalThis.URL; delete globalThis.Blob;
    }
  });

  it("يعيد null بلا DOM بدل أن ينهار", () => {
    expect(globalThis.document).toBeUndefined(); // بيئة node
    expect(DB.downloadBackupFile()).toBeNull();
  });
});

describe("DB.usage", () => {
  beforeEach(() => { DB.mode = "local"; installFakeStorage({}); });

  it("يقيس المساحة المستخدَمة ويحسب النسبة", () => {
    localStorage.setItem("nakheel_db", "x".repeat(1024));
    const u = DB.usage();
    expect(u.bytes).toBeGreaterThan(2000); // UTF-16: بايتان لكل محرف
    expect(u.pct).toBeGreaterThanOrEqual(0);
    expect(u.pct).toBeLessThanOrEqual(100);
  });

  it("يعيد null خارج وضع التخزين المحلي", () => {
    DB.mode = "supabase";
    expect(DB.usage()).toBeNull();
  });
});
