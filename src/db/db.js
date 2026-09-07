import { useState, useEffect } from "react";

/* =========================================================================
   طبقة قاعدة البيانات — Supabase (سحابية) ← التخزين المحلي ← الذاكرة
   لتفعيل الحفظ السحابي والمزامنة بين الأجهزة:
   1) أنشئ مشروعاً مجانياً على supabase.com
   2) نفّذ ملف supabase-schema.sql في SQL Editor
   3) انسخ ملف .env.example إلى .env.local وضع فيه القيم (من Settings → API)
   4) أعد تشغيل خادم التطوير (npm run dev) بعد إنشاء/تعديل .env.local
   ========================================================================= */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://maqxygjevtikpnacpsxz.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1hcXh5Z2pldnRpa3BuYWNwc3h6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3NzgzMTcsImV4cCI6MjEwNDM1NDMxN30.a9eMGbHsEvLeuGQn7WOUhRKdoFt9KI-7I7dMAxv9e8I";

// المفتاح الذي تُخزَّن تحته النسخة الاحتياطية الداخلية — منفصل عن مخزن البيانات
// عمداً: كانت تُحفظ داخل cache نفسها، فيكتب كل flush نسخةً مضاعفة من كل البيانات
const BACKUP_KEY = "nakheel_backup";

// امتلاء الحصة يظهر باسم/رمز مختلف بين المتصفحات — الأسماء والأرقام أدناه تغطيها
const isQuotaError = (e) => !!e && (
  e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
  e.code === 22 || e.code === 1014
);

export const DB = {
  mode: "memory",   // supabase | local | memory
  ready: false,
  cache: {},
  client: null,
  timers: {},
  error: null,
  onWriteError: null, // (info|null) => void — تضبطها App.jsx لعرض إنذار فشل الحفظ
  lastWriteError: null,
  // (isoDate) => void — تضبطها App.jsx: تواريخ النسخ تعيش في cache لا في حالة
  // React، فبلا إخطار يبقى تنبيه "لا توجد نسخة" ظاهراً بعد التنزيل مباشرةً
  onBackupChange: null,
  subscribers: {}, // key -> Set(callback) — لإشعار مكوّنات usePersistentState بتغييرات الأجهزة الأخرى فوراً

  onRemoteChange(key, cb) {
    (this.subscribers[key] || (this.subscribers[key] = new Set())).add(cb);
    return () => this.subscribers[key]?.delete(cb);
  },

  // يُستدعى عند وصول تغيير من جهاز آخر عبر Supabase Realtime — يحدّث الذاكرة المحلية ويُشعر أي مكوّن مُشترك بهذا المفتاح
  _applyRemote(k, v) {
    this.cache[k] = v;
    (this.subscribers[k] || []).forEach(cb => { try { cb(v); } catch { /* ignore */ } });
  },

  async init() {
    if (this.ready) return;
    // 1) المحاولة السحابية (Supabase)
    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
      try {
        const mod = await import(/* @vite-ignore */ "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
        this.client = mod.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        const { data, error } = await this.client.from("nk_store").select("k,v");
        if (error) throw error;
        (data || []).forEach(r => { this.cache[r.k] = r.v; });
        // مزامنة فورية: أي تعديل يحفظه جهاز آخر يصل هنا لحظياً بدل انتظار إعادة تحميل الصفحة —
        // هذا يمنع أكثر سيناريو شائع لمسح التعديلات: جهاز ثانٍ مفتوح وخامل ثم يحفظ نسخته القديمة فوق تعديل جهاز أول
        this.client
          .channel("nk_store_changes")
          .on("postgres_changes", { event: "*", schema: "public", table: "nk_store" }, (payload) => {
            const row = payload.new;
            if (row && row.k) this._applyRemote(row.k, row.v);
          })
          .subscribe();
        this.mode = "supabase"; this.ready = true; return;
      } catch (e) {
        this.error = "تعذّر الاتصال بـ Supabase — تم التحويل للتخزين المحلي";
        console.warn("Supabase:", e);
      }
    }
    // 2) التخزين المحلي للمتصفح
    try {
      localStorage.setItem("nk_test", "1"); localStorage.removeItem("nk_test");
      const raw = localStorage.getItem("nakheel_db");
      if (raw) this.cache = JSON.parse(raw);
      this.mode = "local"; this.ready = true; return;
    } catch { /* بيئة تمنع localStorage */ }
    // 3) الذاكرة المؤقتة (تُفقد عند التحديث)
    this.mode = "memory"; this.ready = true;
  },

  // إزالة أي جلسة قديمة محفوظة (من نسخة سابقة كانت تحفظ الجلسة)
  clearStaleSession() {
    if (this.cache.session_user !== undefined) {
      delete this.cache.session_user;
      if (this.mode === "local") { try { localStorage.setItem("nakheel_db", JSON.stringify(this.cache)); } catch { /* localStorage may be unavailable — ignore */ } }
      if (this.mode === "supabase" && this.client) { this.client.from("nk_store").delete().eq("k", "session_user").then(() => {}, () => {}); }
    }
  },

  get(k, fallback) { return this.cache[k] !== undefined ? this.cache[k] : fallback; },

  // هل سبق تهيئة قاعدة البيانات؟ (بعد التصفير تصبح مهيّأة لكن فارغة)
  isInitialized() { return this.cache.__initialized === true; },
  markInitialized() { if (this.cache.__initialized !== true) { this.cache.__initialized = true; this.flush("__initialized"); } },

  set(k, v) {
    this.cache[k] = v;
    clearTimeout(this.timers[k]);
    this.timers[k] = setTimeout(() => this.flush(k), 300); // حفظ مؤجَّل لتجميع التعديلات (مخفَّض من 450ms لتقليل نافذة فقدان البيانات)
  },

  // حفظ فوري لعملية حرجة (فاتورة، توريد، منتج جديد...) — يتجاوز التأجيل لضمان عدم فقدانها عند تحديث الصفحة مباشرة بعدها
  setNow(k, v) {
    this.cache[k] = v;
    clearTimeout(this.timers[k]);
    return this.flush(k);
  },

  // يُستدعى عند مغادرة الصفحة أو إخفائها: يحفظ فوراً أي تعديلات معلَّقة لم يحن وقت حفظها بعد
  flushAllPending() {
    Object.keys(this.timers).forEach(k => {
      if (this.timers[k]) { clearTimeout(this.timers[k]); this.timers[k] = null; this.flush(k); }
    });
  },

  async flush(k) {
    try {
      if (this.mode === "supabase" && this.client) {
        await this.client.from("nk_store").upsert({ k, v: this.cache[k], updated_at: new Date().toISOString() });
      } else if (this.mode === "local") {
        localStorage.setItem("nakheel_db", JSON.stringify(this.cache));
      }
      if (this.lastWriteError) { this.lastWriteError = null; this.onWriteError?.(null); } // نجحت كتابة بعد فشل — ارفع الإنذار
    } catch (e) {
      /* فشل الحفظ ليس تفصيلاً يُسجَّل في الطرفية: المستخدم يظنّ عمله محفوظاً ويواصل
         البيع بينما لا شيء يُكتب. يُبلَّغ للواجهة لتعرضه إنذاراً ظاهراً ودائماً. */
      const info = {
        key: k, quota: isQuotaError(e), mode: this.mode,
        at: new Date().toISOString(), message: e?.message || String(e),
      };
      this.lastWriteError = info;
      console.error("DB flush failed:", info);
      try { this.onWriteError?.(info); } catch { /* لا يُسقط الحفظَ فشلُ معالج الخطأ نفسه */ }
    }
  },

  /* تقدير المساحة المستخدَمة في وضع التخزين المحلي — localStorage يخزّن UTF-16
     فالحجم بالبايت ضعف عدد المحارف. الحدّ 5MB تقريبي (يختلف بين المتصفحات)
     لكنه كافٍ لإظهار الاقتراب من الامتلاء قبل وقوعه. */
  usage() {
    if (this.mode !== "local" || typeof localStorage === "undefined") return null;
    try {
      let bytes = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        bytes += (key.length + (localStorage.getItem(key) || "").length) * 2;
      }
      const limit = 5 * 1024 * 1024;
      return { bytes, limit, pct: Math.min(100, Math.round((bytes / limit) * 100)) };
    } catch { return null; }
  },

  // تصفير كامل: يمسح البيانات ويعلّم القاعدة بأنها "مهيّأة فارغة" حتى لا تعود البيانات التجريبية
  async reset() {
    try {
      if (this.mode === "supabase" && this.client) {
        await this.client.from("nk_store").delete().neq("k", "");
        // اكتب علامة التهيئة مباشرة كي يبدأ النظام فارغاً بعد التحديث
        await this.client.from("nk_store").upsert({ k: "__initialized", v: true, updated_at: new Date().toISOString() });
      }
      if (this.mode === "local") {
        localStorage.setItem("nakheel_db", JSON.stringify({ __initialized: true }));
      }
    } catch (e) { console.warn("reset:", e); }
    this.cache = { __initialized: true };
    window.location.reload();
  },

  /* ---------- النسخ الاحتياطي ---------- */
  // تصدير كل البيانات ككائن واحد (مع بيانات وصفية)
  exportData() {
    const data = {};
    Object.keys(this.cache).forEach(k => { if (!k.startsWith("__") && k !== "session_user") data[k] = this.cache[k]; });
    return {
      __nakheel_backup: true,
      version: 1,
      exportedAt: new Date().toISOString(),
      mode: this.mode,
      data,
    };
  },

  // استيراد نسخة احتياطية (يستبدل كل البيانات)
  async importData(backup) {
    if (!backup || !backup.__nakheel_backup || !backup.data) throw new Error("ملف غير صالح");
    const data = backup.data;
    // اكتب كل المفاتيح
    Object.keys(data).forEach(k => { this.cache[k] = data[k]; });
    this.cache.__initialized = true;
    // احفظ في المخزن
    if (this.mode === "supabase" && this.client) {
      const rows = Object.keys(this.cache).map(k => ({ k, v: this.cache[k], updated_at: new Date().toISOString() }));
      await this.client.from("nk_store").upsert(rows);
    } else if (this.mode === "local") {
      localStorage.setItem("nakheel_db", JSON.stringify(this.cache));
    }
    return true;
  },

  /* ---------- النسخة الاحتياطية الداخلية ----------
     تُحفظ تحت مفتاح localStorage منفصل لا داخل cache. الفرق ليس تنظيمياً:
     flush() يكتب الـcache كاملةً في كل مرة، فوجود نسخة كاملة بداخلها كان
     يضاعف حجم كل عملية حفظ — كل فاتورة تُكتب مرتين فعلياً. */
  saveAutoBackup() {
    const snap = this.exportData();
    this.cache.__lastBackup = snap.exportedAt;
    try {
      if (typeof localStorage !== "undefined") localStorage.setItem(BACKUP_KEY, JSON.stringify(snap));
    } catch (e) {
      const info = { key: BACKUP_KEY, quota: isQuotaError(e), mode: this.mode, at: new Date().toISOString(), message: e?.message || String(e) };
      this.lastWriteError = info;
      console.error("Auto-backup failed:", info);
      try { this.onWriteError?.(info); } catch { /* تجاهل */ }
      return null;
    }
    this.flush("__lastBackup");
    return snap.exportedAt;
  },
  getAutoBackup() {
    try {
      const raw = typeof localStorage !== "undefined" ? localStorage.getItem(BACKUP_KEY) : null;
      if (raw) return JSON.parse(raw);
    } catch { /* نسخة تالفة — تُعامل كغير موجودة */ }
    return this.cache.__autobackup || null; // تراجع للنسخة القديمة قبل الفصل
  },
  lastBackupAt() { return this.cache.__lastBackup || null; },

  /* ---------- النسخة كملف (الحماية الحقيقية) ----------
     تُتابَع بتاريخ منفصل عن اللقطة الداخلية عمداً. كان الاثنان يشتركان في
     __lastBackup، فكانت لقطة داخلية — أو أي إغلاق يومي — تُصفّر تنبيه "تأخّرت
     نسختك الاحتياطية" وتُظهر النظام محمياً. وهي لا تحمي من شيء في الواقع:
     تعيش في نفس التخزين الذي يزول بمسح بيانات المتصفح أو بعطب الجهاز.
     الملف وحده يخرج من ذلك التخزين، فهو وحده ما يُحتسب في التنبيه. */
  lastFileBackupAt() { return this.cache.__lastFileBackup || null; },

  // تُنزّل نسخة كاملة كملف .json وتسجّل التاريخ. تُعيد اسم الملف أو null عند التعذّر.
  downloadBackupFile() {
    if (typeof document === "undefined") return null;
    const snap = this.exportData();
    const name = `nakheel-backup-${new Date().toISOString().slice(0, 10)}.json`;
    try {
      const url = URL.createObjectURL(new Blob([JSON.stringify(snap, null, 2)], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { console.error("Backup download failed:", e); return null; }
    this.cache.__lastFileBackup = snap.exportedAt;
    this.flush("__lastFileBackup");
    try { this.onBackupChange?.(snap.exportedAt); } catch { /* لا يُسقط التنزيلَ فشلُ المُخطِر */ }
    return name;
  },

  /* ترحيل النسخ القديمة: تُنقل النسخة من داخل cache إلى مفتاحها المنفصل مرة
     واحدة، فيتقلّص حجم مخزن البيانات فوراً للمستخدمين الحاليين. */
  migrateAutoBackup() {
    if (!this.cache.__autobackup) return false;
    try {
      if (typeof localStorage !== "undefined" && !localStorage.getItem(BACKUP_KEY)) {
        localStorage.setItem(BACKUP_KEY, JSON.stringify(this.cache.__autobackup));
      }
    } catch { /* تعذّر النقل — نحذفها من cache على أي حال لتحرير المساحة */ }
    delete this.cache.__autobackup;
    this.flush("__autobackup");
    return true;
  },
};

// عدّ العناصر داخل نسخة احتياطية (للعرض)
export function backupCounts(data) {
  const keys = { products: "منتج", customers: "زبون", suppliers: "مورد", invoices: "فاتورة", purchases: "توريد", expenses: "مصروف", promotions: "عرض", coupons: "كوبون" };
  const out = [];
  Object.keys(keys).forEach(k => { const arr = data[k]; if (Array.isArray(arr) && arr.length) out.push(`${arr.length} ${keys[k]}`); });
  return out;
}

// بديل useState يحفظ تلقائياً في قاعدة البيانات
// alwaysSeed=true للإعدادات والمستخدمين (تبقى قيمها الافتراضية بعد التصفير كي يظل النظام صالحاً)
export function usePersistentState(key, seed, alwaysSeed = false) {
  const [val, setVal] = useState(() => {
    const saved = DB.get(key, undefined);
    if (saved !== undefined) {
      // دمج الكائنات (كالإعدادات): الحقول الجديدة تأخذ قيمها الافتراضية والمحفوظة تبقى
      if (saved && seed && typeof saved === "object" && typeof seed === "object" && !Array.isArray(saved) && !Array.isArray(seed)) {
        return { ...seed, ...saved };
      }
      return saved;
    }
    // لا توجد قيمة محفوظة لهذا المفتاح:
    // - config (alwaysSeed) → استخدم الافتراضي دائماً
    // - data: إذا كانت القاعدة مهيّأة (بعد تصفير/استخدام) → فارغ، وإلا → بيانات تجريبية أول مرة
    if (alwaysSeed) return seed;
    if (DB.isInitialized()) {
      return Array.isArray(seed) ? [] : (seed && typeof seed === "object" ? {} : (typeof seed === "number" ? 0 : null));
    }
    return seed;
  });
  const set = (v) => setVal(prev => {
    const next = typeof v === "function" ? v(prev) : v;
    DB.set(key, next);
    return next;
  });
  // استقبال تعديلات جهاز آخر فوراً (Supabase Realtime) — تحديث الحالة مباشرة بلا إعادة كتابة إلى القاعدة (تجنّباً لحلقة لا نهائية)
  useEffect(() => DB.onRemoteChange(key, setVal), [key]);
  return [val, set];
}
