import React, { useState, useMemo, useEffect, useRef } from "react";

/* =========================================================================
   نادي النخيل — النظام المحاسبي المتكامل (نسخة عرض كاملة)
   كل البيانات تُحفظ داخل الجلسة (React state) وتختفي عند تحديث الصفحة.
   ========================================================================= */

import { C, T, THEMES, fmt, resolveTheme, applyTheme } from "./constants/theme.js";
import {
  SEED_PRODUCTS, SEED_CUSTOMERS, SEED_SUPPLIERS, SEED_INVOICES, SEED_PURCHASES,
  SEED_EXPENSES, SEED_EMPLOYEES, SEED_COUPONS, SEED_PROMOS, PERIOD_NAME, PERIOD_ICON,
  SEED_USERS, CATS, TYPE_ICON, TYPE_NAME, TYPE_DEFAULT_RATE, SEED_TABLES, PERM_LABELS,
  SEED_ASSETS, ASSET_STATUS, PAGE_LIST,
} from "./constants/seeds.js";
import {
  todayISO, arDate, daysBetween, productBarcodes, matchesBarcode, matchesBarcodePartial,
  overdueDays, toWa,
} from "./utils/format.js";
import { promoActiveNow, promoFor } from "./utils/promos.js";
import { parseBookingMinutes } from "./utils/bookings.js";
import { DB, backupCounts, usePersistentState } from "./db/db.js";

/* ---------- small UI atoms ---------- */
const Badge = ({ tone = "g", children, style }) => {
  const map = {
    g: { bg: "#e1f4e8", c: "#1a5c2e" }, a: { bg: "#fef3d9", c: "#8a6a20" },
    r: { bg: C.redbg, c: "#922" }, b: { bg: C.bluebg, c: C.blue },
    gold: { bg: "rgba(201,168,76,.16)", c: C.gdd }, p: { bg: C.purpbg, c: C.purp },
  };
  const t = map[tone] || map.g;
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 7px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: t.bg, color: t.c, whiteSpace: "nowrap", ...style }}>{children}</span>;
};

const Crest = ({ size = 46 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" style={{ flexShrink: 0, filter: "drop-shadow(0 2px 4px rgba(0,0,0,.3))" }}>
    <defs><linearGradient id="ngg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f0d080" /><stop offset="1" stopColor="#b8923c" /></linearGradient></defs>
    <path d="M50 6L88 22V52C88 74 70 90 50 96C30 90 12 74 12 52V22L50 6Z" fill="#1a5c2e" stroke="url(#ngg)" strokeWidth="2.5" />
    <path d="M50 32C50 32 50 46 44 52C40 56 36 56 36 56C36 56 40 56 43 60C46 64 46 72 50 72C54 72 54 64 57 60C60 56 64 56 64 56C64 56 60 56 56 52C50 46 50 32 50 32Z" fill="url(#ngg)" />
  </svg>
);

/* ---------- HUB ICONS (SVG) ----------
   أيقونات خطية موحّدة لمراكز العمل الثمانية في الشريط الجانبي — بديل احترافي
   عن الإيموجي الذي يظهر بأشكال متفاوتة بين ويندوز/أندرويد/iOS. تستخدم
   currentColor فتتلوّن تلقائياً حسب الثيم النشط ولون التبويب (نشط/غير نشط). */
const HubIconPaths = {
  today:    "M4 10.5 12 4l8 6.5V19a1 1 0 01-1 1h-4v-6H9v6H5a1 1 0 01-1-1z",
  cart:     "M3 4h2l1.6 10.2A2 2 0 008.56 16H17a2 2 0 001.96-1.6L20.4 8H6.2 M9 20a1 1 0 100-2 1 1 0 000 2zM17 20a1 1 0 100-2 1 1 0 000 2z",
  calendar: "M4 5.5h16A1 1 0 0121 6.5V19a1 1 0 01-1 1H4a1 1 0 01-1-1V6.5a1 1 0 011-1zM3 10h18M8 3v4M16 3v4",
  box:      "M3.5 8 12 4l8.5 4v8L12 20l-8.5-4zM3.5 8 12 12l8.5-4M12 12v8",
  users:    "M9 12a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM3.5 20c.7-3.2 3-5 5.5-5s4.8 1.8 5.5 5M16.5 8.5a2.75 2.75 0 110-5.5M16 12.2c1.9.4 3.4 1.9 4 4.3",
  wallet:   "M4 7.5h14a2 2 0 012 2V17a2 2 0 01-2 2H4a2 2 0 01-2-2V9.5a2 2 0 012-2zM2 8l11-4.5L17 6M16.5 13.2a1.3 1.3 0 100-2.6 1.3 1.3 0 000 2.6z",
  chart:    "M4 20V10M10 20V4M16 20v-7M4 20h16",
  gear:     "M12 15.2a3.2 3.2 0 100-6.4 3.2 3.2 0 000 6.4zM12 3.5v2.2M12 18.3v2.2M5.4 6.4l1.55 1.55M17.05 16.05l1.55 1.55M3.5 12h2.2M18.3 12h2.2M5.4 17.6l1.55-1.55M17.05 7.95l1.55-1.55",
};
const HubIcon = ({ id, size = 18, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...rest}>
    <path d={HubIconPaths[id] || HubIconPaths.today} />
  </svg>
);

/* ============================ ROOT APP ============================ */

/* ---- شاشة الإقلاع: تحميل قاعدة البيانات قبل عرض النظام ---- */
export default function NakheelSystemRoot() {
  const [ready, setReady] = useState(DB.ready);
  useEffect(() => {
    const boot = async () => {
      if (!DB.ready) await DB.init();
      setReady(true);
      // بعد أول إقلاع ناجح، علّم القاعدة بأنها مهيّأة
      // (البيانات التجريبية زُرعت مرة واحدة؛ لن تعود بعد التصفير)
      DB.clearStaleSession();
      DB.markInitialized();
    };
    boot();
  }, []);
  if (!ready) {
    return (
      <div dir="rtl" style={{ minHeight: "100vh", background: "#14431f", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, fontFamily: "'Tajawal',sans-serif" }}>
        <style>{`
          @keyframes nkBootPulse { 0%,100%{transform:scale(1); filter:drop-shadow(0 0 0 rgba(201,168,76,0))} 50%{transform:scale(1.06); filter:drop-shadow(0 0 14px rgba(201,168,76,.55))} }
          @keyframes nkBootFade { from{opacity:0; transform:translateY(8px)} to{opacity:1; transform:none} }
          @keyframes nkBootDot { 0%,80%,100%{opacity:.25} 40%{opacity:1} }
          .nk-boot-crest { animation: nkBootPulse 1.8s ease-in-out infinite; }
          .nk-boot-txt { animation: nkBootFade .5s ease .1s both; }
          .nk-boot-dot { animation: nkBootDot 1.3s ease-in-out infinite; display:inline-block; }
        `}</style>
        <div className="nk-boot-crest"><Crest size={72} /></div>
        <div className="nk-boot-txt" style={{ color: "#f0d080", fontSize: 18, fontWeight: 900 }}>نادي النخيل</div>
        <div className="nk-boot-txt" style={{ color: "#c9a84c", fontSize: 12.5, display: "flex", alignItems: "center", gap: 2 }}>
          <span>⏳ جارٍ تحميل قاعدة البيانات</span>
          <span className="nk-boot-dot" style={{ animationDelay: "0ms" }}>.</span>
          <span className="nk-boot-dot" style={{ animationDelay: "180ms" }}>.</span>
          <span className="nk-boot-dot" style={{ animationDelay: "360ms" }}>.</span>
        </div>
      </div>
    );
  }
  return <NakheelApp />;
}

function NakheelApp() {
  // session state — لا تُحفظ دائمياً: كل زيارة للموقع تتطلب تسجيل دخول
  const [user, setUser] = useState(null);
  const [page, setPage] = useState("dashboard");

  // global settings
  const [settings, setSettings] = usePersistentState("settings", {
    logo: null,               // data URL for custom logo
    theme: "gold",            // gold | emerald | royal | sunset | ocean
    dark: false,              // night mode
    posMode: "grid",          // grid | list | compact
    printer: "xprinter",      // xprinter (80mm) | a4
    clubName: "نادي النخيل",
    clubSub: "النادي الرياضي الترفيهي",
    address: "مصراتة، ليبيا",
    phone: "0913-000-111",
    welcomeTitle: "أهلاً بك في نادي النخيل",
    welcomeMsg: "نتمنى لك وقتاً ممتعاً!",
    invoiceFooter: "شكراً لزيارتكم — نادي النخيل",
    invoiceShowLogo: true,
    currency: "د.ل",
    animations: true,
  }, true);

  // data stores — كلها محفوظة دائمياً
  const [products, setProducts] = usePersistentState("products", SEED_PRODUCTS);
  const [customers, setCustomers] = usePersistentState("customers", SEED_CUSTOMERS);
  const [suppliers, setSuppliers] = usePersistentState("suppliers", SEED_SUPPLIERS);
  const [invoices, setInvoices] = usePersistentState("invoices", SEED_INVOICES);
  const [purchases, setPurchases] = usePersistentState("purchases", SEED_PURCHASES);
  const [expenses, setExpenses] = usePersistentState("expenses", SEED_EXPENSES);
  const [employees, setEmployees] = usePersistentState("employees", SEED_EMPLOYEES);
  const [coupons, setCoupons] = usePersistentState("coupons", SEED_COUPONS);
  const [promotions, setPromotions] = usePersistentState("promotions", SEED_PROMOS);
  const [assets, setAssets] = usePersistentState("assets", SEED_ASSETS);
  const [closings, setClosings] = usePersistentState("closings", []);
  const [payments, setPayments] = usePersistentState("payments", []); // قبض من زبائن / صرف لموردين
  const [waste, setWaste] = usePersistentState("waste", []); // إتلاف/هالك المنتجات
  const [leaves, setLeaves] = usePersistentState("leaves", []); // عطلات وإجازات الموظفين
  const [tournaments, setTournaments] = usePersistentState("tournaments", []); // الدوريات والمسابقات
  const [cancellations, setCancellations] = usePersistentState("cancellations", []); // إلغاءات وعدم حضور الحجوزات
  const [auditLog, setAuditLog] = usePersistentState("auditLog", []); // تعديلات الأسعار والإعدادات
  const [rentalDevices, setRentalDevices] = usePersistentState("rentalDevices", []); // أجهزة إلكترونية للتأجير
  const [rentals, setRentals] = usePersistentState("rentals", []); // عمليات التأجير
  const [deductions, setDeductions] = usePersistentState("deductions", []); // خصومات وجزاءات الموظفين (تأخير، مخالفات...)
  const [capitalMoves, setCapitalMoves] = usePersistentState("capitalMoves", []); // ضخ/سحب رأس المال (سيولة خارج دورة البيع والمصاريف)
  const [users, setUsers] = usePersistentState("users", SEED_USERS);
  const [bookings, setBookings] = usePersistentState("bookings", {}); // الحجوزات النشطة تنجو من تحديث الصفحة
  const [tables, setTables] = usePersistentState("tables", SEED_TABLES, true);
  const [cats, setCats] = usePersistentState("cats", { games: "ألعاب فيديو", cafe: "كافيه" }, true);
  const [completedBookings, setCompletedBookings] = usePersistentState("completed_bookings", []);
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);

  // showToast(msg) للحالة العادية — أو showToast(msg, { onUndo, actionLabel, duration })
  // لإتاحة تراجع سريع بعد حذف/تعديل بدل نوافذ تأكيد متكررة قد تُنقر آلياً بدون انتباه
  const showToast = (msg, opts) => {
    clearTimeout(toastTimerRef.current);
    const duration = (opts && opts.duration) || (opts && opts.onUndo ? 5000 : 2800);
    setToast({ msg, onUndo: opts && opts.onUndo, actionLabel: (opts && opts.actionLabel) || "تراجع" });
    toastTimerRef.current = setTimeout(() => setToast(null), duration);
  };

  // derived totals
  const totals = useMemo(() => {
    // الإيرادات = الفواتير المدفوعة فقط (حجوزات الطاولات تُنشئ فواتيرها تلقائياً، فلا تُحسب مرتين)
    const paid = invoices.filter(i => i.status === "مدفوعة");
    const revenue = paid.reduce((s, i) => s + i.total, 0);
    // تكلفة البضاعة المباعة
    const cogs = paid.reduce((s, i) => s + (i.cost || 0), 0);
    const expTotal = expenses.reduce((s, e) => s + e.amount, 0);
    // خسائر الإتلاف/الهالك (سكب، تسريب، كسر...)
    const wasteCost = (waste || []).reduce((s, w) => s + (w.cost || 0), 0);
    // صافي الربح = الإيرادات − تكلفة البضاعة − خسائر الإتلاف − المصاريف
    return { revenue, cogs, expTotal, wasteCost, profit: revenue - cogs - wasteCost - expTotal };
  }, [invoices, expenses, waste]);

  // overdue alerts: deferred invoices past due date
  const overdueAlerts = useMemo(() => {
    return invoices
      .filter(iv => overdueDays(iv) > 0)
      .map(iv => ({ ...iv, late: overdueDays(iv), customer: iv.customer }))
      .sort((a, b) => b.late - a.late);
  }, [invoices]);

  // ---- مركز التنبيهات الموحّد ----
  const [notifOpen, setNotifOpen] = useState(false);
  const [nowTick, setNowTick] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNowTick(Date.now()), 60000); return () => clearInterval(t); }, []); // نبضة كل دقيقة لتحديث تنبيهات مواعيد التأجير
  const notifications = useMemo(() => {
    const list = [];
    const cur = settings.currency || "د.ل";
    if (overdueAlerts.length > 0) list.push({ id: "debt", icon: "🔔", tone: "r", text: `${overdueAlerts.length} فاتورة آجلة متأخرة — ${fmt(overdueAlerts.reduce((s, a) => s + a.total, 0))} ${cur}`, page: "alerts" });
    const low = products.filter(p => p.stock !== null && p.min && p.stock < p.min);
    if (low.length > 0) list.push({ id: "stock", icon: "📦", tone: "a", text: `${low.length} منتج تحت الحد الأدنى للمخزون`, page: "inventory" });
    const lastBk = DB.lastBackupAt();
    const bkDays = lastBk ? Math.floor((Date.now() - new Date(lastBk)) / 86400000) : null;
    if (bkDays === null || bkDays >= (settings.backupFreq || 7)) list.push({ id: "backup", icon: "🛡", tone: "gold", text: lastBk ? `مضى ${bkDays} يوم على آخر نسخة احتياطية` : "لم تُنشأ أي نسخة احتياطية بعد", page: "settings" });
    const todayClosing = closings.find(c => c.date === todayISO());
    if (!todayClosing) list.push({ id: "closing", icon: "🔒", tone: "b", text: "لم يُغلق حساب اليوم في الخزينة بعد", page: "treasury" });
    const maintTooLong = assets.filter(a => a.status === "maintenance" && a.maintStart && daysBetween(a.maintStart, todayISO()) > 14);
    if (maintTooLong.length > 0) list.push({ id: "maint", icon: "🔧", tone: "a", text: `${maintTooLong.length} مورد في الصيانة منذ أكثر من 14 يوماً`, page: "assets" });
    const rentalsEndingSoon = (rentals || []).filter(r => r.status !== "مُرجَع" && (new Date(r.endAt).getTime() - Date.now()) <= 3600000);
    if (rentalsEndingSoon.length > 0) list.push({ id: "rental", icon: "⏰", tone: "a", text: `${rentalsEndingSoon.length} جهاز مؤجَّر تنتهي مدته خلال ساعة أو متأخر`, page: "rentals" });
    return list;
  }, [overdueAlerts, products, closings, assets, settings, rentals, nowTick]);

  // ---- البحث الشامل (Ctrl+K) ----
  // searchIntent: عندما ينتقل المستخدم من نتيجة بحث لصفحة معيّنة، تحمل هذه الحالة
  // نص البحث ليُقرأ مرة واحدة عند إقلاع تلك الصفحة (تُعاد الصفحات بالكامل عبر
  // key={page} على الحاوية، فالقراءة عبر useState initializer آمنة ومضمونة).
  const [cmdOpen, setCmdOpen] = useState(false);
  const [searchIntent, setSearchIntent] = useState(null);

  // ---- responsive: tablet/drawer support (hooks must precede the login return) ----
  const [scrW, setScrW] = useState(typeof window !== "undefined" ? window.innerWidth : 1280);
  const [navOpen, setNavOpen] = useState(false);
  useEffect(() => {
    const on = () => setScrW(window.innerWidth);
    window.addEventListener("resize", on);
    // ensure proper scaling on tablets
    if (!document.querySelector('meta[name="viewport"]')) {
      const m = document.createElement("meta");
      m.name = "viewport"; m.content = "width=device-width, initial-scale=1, viewport-fit=cover";
      document.head.appendChild(m);
    }
    return () => window.removeEventListener("resize", on);
  }, []);
  const isTab = scrW <= 1080; // tablets & below: drawer nav + stacked layouts

  // in-app PDF document preview (no popups)
  const [pdfDoc, setPdfDoc] = useState(null);
  useEffect(() => { PDF_HOOK.show = setPdfDoc; return () => { PDF_HOOK.show = null; }; }, []);
  // اختصار البحث الشامل — يعمل من أي صفحة، بشرط عدم التركيز داخل حقل نصي (لتفادي تعارضه مع الكتابة العادية)
  useEffect(() => {
    const onKey = (e) => {
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && k === "k") { e.preventDefault(); setCmdOpen(o => !o); }
      else if (k === "escape") setCmdOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // شبكة أمان: احفظ فوراً أي تعديلات معلَّقة (لم يمرّ عليها 300ms بعد) عند إخفاء الصفحة أو مغادرتها —
  // يمنع فقدان آخر عملية (كإضافة منتج ثم إغلاق/تحديث الصفحة مباشرة) قبل اكتمال الحفظ المؤجَّل
  useEffect(() => {
    const flush = () => DB.flushAllPending();
    const onVisibility = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("beforeunload", flush);
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("beforeunload", flush);
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  // انتهاء الجلسة تلقائياً بعد فترة خمول (يُضبط من الإعدادات ← الأمان)
  useEffect(() => {
    const mins = settings.sessionTimeout;
    if (!user || !mins) return;
    let timer;
    const doLogout = () => { setUser(null); setPage("dashboard"); };
    const reset = () => { clearTimeout(timer); timer = setTimeout(doLogout, mins * 60000); };
    const events = ["mousedown", "keydown", "touchstart", "scroll"];
    events.forEach(e => window.addEventListener(e, reset));
    reset();
    return () => { clearTimeout(timer); events.forEach(e => window.removeEventListener(e, reset)); };
  }, [user, settings.sessionTimeout]);

  // إعداد أولي: إن لم يوجد أي مستخدم (بعد التصفير) → شاشة إنشاء المدير الرئيسي
  if (!users || users.length === 0) {
    return <FirstSetup settings={settings} onCreate={(admin) => { setUsers([admin]); setUser(admin); }} />;
  }

  if (!user) return <Login users={users} onLogin={setUser} settings={settings} />;

  // apply active theme to shared palette before rendering
  applyTheme(settings);
  Object.assign(CATS, cats); // keep global category labels in sync

  const ctx = {
    user, products, setProducts, customers, setCustomers, suppliers, setSuppliers,
    invoices, setInvoices, purchases, setPurchases, expenses, setExpenses,
    employees, setEmployees, coupons, setCoupons, users, setUsers,
    promotions, setPromotions,
    assets, setAssets,
    closings, setClosings,
    payments, setPayments,
    waste, setWaste,
    leaves, setLeaves,
    tournaments, setTournaments,
    cancellations, setCancellations,
    auditLog, setAuditLog,
    rentalDevices, setRentalDevices,
    rentals, setRentals,
    deductions, setDeductions,
    capitalMoves, setCapitalMoves,
    bookings, setBookings, completedBookings, setCompletedBookings, tables, setTables,
    cats, setCats,
    settings, setSettings,
    totals, showToast, overdueAlerts, notifications,
    cmdOpen, setCmdOpen, setSearchIntent,
  };

  const can = (perm) => user.perms[perm] || user.role === "مدير";

  // ---------------------------------------------------------------------
  // HUBS — إعادة هيكلة التنقل من 24 صفحة مسطحة إلى 8 مراكز عمل بتبويبات.
  // كل تبويب يحمل نفس id/perm/admin/icon التي كانت في NAV القديمة تماماً؛
  // صفحات النظام نفسها (Dashboard, POS, Sales...) لم تُمسّ إطلاقاً — هذه
  // طبقة تجميع وتوجيه فوقها فقط. hub.icon يشير لمفتاح في HubIcon (SVG).
  // ---------------------------------------------------------------------
  const HUBS = [
    { id: "today", label: "لوحة اليوم", icon: "today", tabs: [
      { id: "dashboard", label: "لوحة التحكم", icon: "▦" },
    ]},
    { id: "sell", label: "البيع", icon: "cart", tabs: [
      { id: "pos", label: "نقطة البيع السريع", icon: "🛍" },
      { id: "sales", label: "المبيعات والفواتير", icon: "🧾" },
    ]},
    { id: "floor", label: "الصالة", icon: "calendar", tabs: [
      { id: "bookings", label: "حجز الطاولات", icon: "📅" },
      { id: "rentals", label: "تأجير الأجهزة", icon: "🔌" },
      { id: "tournaments", label: "الدوريات والمسابقات", icon: "🏆" },
    ]},
    { id: "stock", label: "المخزون", icon: "box", tabs: [
      { id: "products", label: "المنتجات", icon: "📦" },
      { id: "inventory", label: "المخزون والنواقص", icon: "🏬", perm: "inventory" },
      { id: "purchases", label: "المشتريات", icon: "🛒", perm: "purchases" },
      { id: "suppliers", label: "الموردون", icon: "🚚", perm: "purchases" },
      { id: "assets", label: "موارد النادي", icon: "🏛" },
    ]},
    { id: "clients", label: "الزبائن", icon: "users", tabs: [
      { id: "customers", label: "سجل الزبائن", icon: "👥", perm: "customers" },
      { id: "alerts", label: "تنبيهات السداد", icon: "🔔", perm: "customers" },
      { id: "coupons", label: "كوبونات", icon: "🎟" },
      { id: "promos", label: "التخفيضات والعروض", icon: "🏷" },
    ]},
    { id: "money", label: "المال", icon: "wallet", tabs: [
      { id: "treasury", label: "الخزينة والإغلاق", icon: "💰" },
      { id: "expenses", label: "المصاريف", icon: "💵" },
      { id: "salaries", label: "المرتبات", icon: "🪪", perm: "salaries" },
      { id: "capital", label: "رأس المال والسيولة", icon: "🏦", perm: "salaries" },
    ]},
    { id: "analytics", label: "التقارير", icon: "chart", tabs: [
      { id: "reports", label: "التقارير", icon: "📊", perm: "reports" },
      { id: "insights", label: "الرؤى البيانية", icon: "📈", perm: "reports" },
    ]},
    { id: "admin", label: "الإدارة", icon: "gear", tabs: [
      { id: "activity", label: "سجل حركات الموظفين", icon: "📋", admin: true },
      { id: "users", label: "المستخدمون", icon: "🛡", admin: true },
      { id: "settings", label: "الإعدادات", icon: "⚙", admin: true },
    ]},
  ];

  const visibleItem = (it) => {
    if (it.admin) return user.role === "مدير"; // صفحات الإدارة للمدير فقط
    if (user.role === "مدير") return true;      // المدير يرى كل شيء
    // إخفاء صريح لصفحة من قبل المدير
    if (user.pages && user.pages[it.id] === false) return false;
    // صلاحيات تفصيلية (احتياطية)
    if (it.perm && !can(it.perm)) return false;
    return true;
  };
  // مركز يُعرض إن كان فيه تبويب واحد مرئي على الأقل
  const visibleHub = (h) => h.tabs.some(visibleItem);

  // attach responsive info to ctx + drawer-aware navigation
  ctx.scr = { w: scrW, isTab };
  const goPage = (id) => { setPage(id); setNavOpen(false); };

  const allPages = HUBS.flatMap(h => h.tabs);
  // المركز الحالي يُشتق من الصفحة النشطة — لا حاجة لحالة منفصلة قد تخرج عن التزامن معها
  const activeHub = HUBS.find(h => h.tabs.some(t => t.id === page)) || HUBS[0];

  // إن كانت الصفحة الحالية مخفية عن المستخدم، انتقل لأول صفحة مسموحة
  // (يُحسب أثناء التصيير بأمان بدل useEffect لتفادي اختلاف ترتيب الخطافات)
  if (user.role !== "مدير") {
    const currentItem = allPages.find(it => it.id === page);
    if (currentItem && !visibleItem(currentItem)) {
      const firstVisible = allPages.find(it => visibleItem(it));
      if (firstVisible && firstVisible.id !== page) {
        setTimeout(() => setPage(firstVisible.id), 0);
      }
    }
  }

  return (
    <div dir="rtl" style={{ fontFamily: "'Tajawal',sans-serif", background: C.pg, color: C.ink, minHeight: "100vh", fontSize: T.font.base, transition: settings.animations ? "background .4s ease, color .4s ease" : "none" }}>
      <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;900&display=swap" rel="stylesheet" />
      <style>{`
        @keyframes nkFadeUp { from { opacity:0; transform: translateY(10px);} to {opacity:1; transform:none;} }
        @keyframes nkPop { 0%{transform:scale(.92);opacity:0} 100%{transform:scale(1);opacity:1} }
        @keyframes nkGlow { 0%,100%{box-shadow:0 0 0 0 ${C.gold}44} 50%{box-shadow:0 0 0 6px ${C.gold}00} }
        @keyframes nkKCardIn { 0%{opacity:0; transform:translateY(12px)} 100%{opacity:1; transform:none} }
        @keyframes nkBarGrowY { 0%{transform:scaleY(0)} 100%{transform:scaleY(1)} }
        @keyframes nkDonutDraw { from { stroke-dashoffset: var(--nk-len, 0); } to { stroke-dashoffset: 0; } }
        @keyframes nkToastShrink { from{width:100%} to{width:0%} }
        @keyframes nkRowIn { from{opacity:0; transform:translateY(4px)} to{opacity:1; transform:none} }
        .nk-page { animation: ${settings.animations ? "nkFadeUp .35s ease" : "none"}; }
        .nk-nav-item { transition: ${settings.animations ? "background .18s, color .18s, border-color .18s, transform .18s" : "none"}; }
        .nk-nav-item:hover { transform: translateX(4px); }
        .nk-card-hover { transition: ${settings.animations ? "transform .2s, box-shadow .2s" : "none"}; }
        .nk-card-hover:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,.10); }
        .nk-kcard { animation: ${settings.animations ? "nkKCardIn .4s cubic-bezier(.2,.8,.2,1) both" : "none"}; transition: ${settings.animations ? "transform .18s ease, box-shadow .18s ease" : "none"}; }
        .nk-kcard:hover { transform: translateY(-3px); box-shadow: 0 8px 20px rgba(20,67,31,.12); }
        .nk-kcard-bar { transform-origin: top; animation: ${settings.animations ? "nkBarGrowY .5s cubic-bezier(.2,.8,.2,1) .08s both" : "none"}; }
        .nk-bar-grow { animation: ${settings.animations ? "nkBarGrowY .5s cubic-bezier(.2,.8,.2,1) both" : "none"}; }
        .nk-donut-seg { stroke-dashoffset: 0; animation: ${settings.animations ? "nkDonutDraw .7s cubic-bezier(.2,.8,.2,1) forwards" : "none"}; }
        .nk-row-in { animation: ${settings.animations ? "nkRowIn .3s ease both" : "none"}; }
        @keyframes nkBarGrowX { 0%{transform:scaleX(0)} 100%{transform:scaleX(1)} }
        @keyframes nkTrendDraw { from { stroke-dashoffset: var(--nk-tlen, 2000); } to { stroke-dashoffset: 0; } }
        .nk-bar-grow-x { animation: ${settings.animations ? "nkBarGrowX .5s cubic-bezier(.2,.8,.2,1) both" : "none"}; }
        .nk-trend-draw { stroke-dashoffset: 0; animation: ${settings.animations ? "nkTrendDraw 1.1s cubic-bezier(.2,.8,.2,1) forwards" : "none"}; }
        .nk-theme-transition { transition: ${settings.animations ? "background-color .35s ease, border-color .35s ease, color .35s ease" : "none"}; }
        .nk-theme-card { animation: ${settings.animations ? "nkKCardIn .35s cubic-bezier(.2,.8,.2,1) both" : "none"}; transition: ${settings.animations ? "transform .18s ease, box-shadow .18s ease, border-color .2s ease, background .2s ease" : "none"}; }
        .nk-theme-card:hover { transform: translateY(-3px) !important; }
        * { scrollbar-width: thin; scrollbar-color: ${C.gold}66 transparent; }
        /* ---- تحسينات اللمس للأجهزة اللوحية ---- */
        html { -webkit-text-size-adjust: 100%; }
        button, input, select, textarea, [role="button"] { touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
        @media (pointer: coarse) {
          input, select, textarea { font-size: 16px !important; min-height: ${T.touch}px; }
          button, [role="button"] { min-height: ${T.touch}px; }
        }
        .nk-tbl-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
        .nk-tbl-wrap table { min-width: 560px; }
        /* تلميع بصري: استجابة الضغط والتركيز */
        button:active { transform: scale(.97); }
        button, a { transition: ${settings.animations ? "transform .1s ease, background .15s, box-shadow .15s" : "none"}; }
        input:focus, select:focus, textarea:focus { border-color: ${C.gold} !important; box-shadow: 0 0 0 3px ${C.gold}22 !important; }
        button:focus-visible, [role="button"]:focus-visible, .nk-nav-item:focus-visible { outline: 2px solid ${C.gold}; outline-offset: 2px; }
        tbody tr { transition: background .12s; }
        tbody tr:hover td { background: ${C.gold}0d; }
        ::selection { background: ${C.gold}55; }
        *::-webkit-scrollbar { width: 8px; height: 8px; }
        *::-webkit-scrollbar-thumb { background: ${C.gold}55; border-radius: 4px; }
        *::-webkit-scrollbar-thumb:hover { background: ${C.gold}99; }
        *::-webkit-scrollbar-track { background: transparent; }
        button:hover { filter: brightness(1.05); }
        @keyframes nkModalIn { from { opacity: 0; transform: translateY(14px) scale(.97); } to { opacity: 1; transform: none; } }
        .nk-modal-in { animation: nkModalIn .25s ease; }
        /* عند الطباعة الاحتياطية: يُطبع المستند فقط */
        @media print {
          body.nk-printing * { visibility: hidden !important; }
          body.nk-printing .nk-pdf-sheet, body.nk-printing .nk-pdf-sheet * { visibility: visible !important; }
          body.nk-printing .nk-pdf-sheet { position: absolute !important; top: 0; right: 0; left: 0; margin: 0 !important; max-width: none !important; box-shadow: none !important; border-radius: 0 !important; }
        }
      `}</style>

      {/* TOP BAR (tablet) */}
      {isTab && (
        <div style={{ position: "sticky", top: 0, zIndex: 90, display: "flex", alignItems: "center", gap: 10, background: C.grn, padding: ".6rem .9rem", boxShadow: "0 2px 10px rgba(0,0,0,.18)" }}>
          <button onClick={() => setNavOpen(true)} aria-label="القائمة" style={{ background: C.gold + "22", border: `1px solid ${C.gold}66`, color: C.gld, borderRadius: 9, fontSize: 19, padding: ".2rem .65rem", cursor: "pointer", fontFamily: "inherit" }}>☰</button>
          {settings.logo ? <img src={settings.logo} alt="" style={{ width: 30, height: 30, borderRadius: 8, objectFit: "cover" }} /> : <Crest size={30} />}
          <div style={{ flex: 1, fontSize: 14, fontWeight: 900, color: C.gld }}>{settings.clubName}</div>
          {overdueAlerts.length > 0 && (
            <button onClick={() => goPage("alerts")} style={{ background: "#e34948", color: "#fff", border: "none", borderRadius: 9, fontSize: 12, fontWeight: 700, padding: ".25rem .6rem", cursor: "pointer", fontFamily: "inherit" }}>🔔 {overdueAlerts.length}</button>
          )}
        </div>
      )}

      {/* BACKDROP (tablet drawer) */}
      {isTab && navOpen && (
        <div onClick={() => setNavOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 99 }} />
      )}

      {/* SIDEBAR */}
      <div style={{ position: "fixed", top: 0, right: 0, width: isTab ? 260 : 225, height: "100vh", background: `linear-gradient(180deg,${C.grn} 0%, ${C.dark ? "#0a0906" : "#0e3318"} 100%)`, overflowY: "auto", zIndex: 100, display: "flex", flexDirection: "column",
        transform: isTab ? (navOpen ? "translateX(0)" : "translateX(100%)") : "none",
        transition: "transform .28s ease" + (settings.animations ? ", background .4s ease" : ""),
        boxShadow: isTab && navOpen ? "-8px 0 30px rgba(0,0,0,.35)" : "none" }}>
        {isTab && (
          <button onClick={() => setNavOpen(false)} style={{ position: "absolute", top: 10, left: 10, background: "rgba(255,255,255,.12)", border: "none", color: "#fff", borderRadius: 8, fontSize: 15, width: 30, height: 30, cursor: "pointer" }}>✕</button>
        )}
        <div style={{ padding: "1.1rem .9rem", borderBottom: `1px solid ${C.gold}40`, display: "flex", alignItems: "center", gap: 9, background: "rgba(0,0,0,.12)", position: "relative" }}>
          {settings.logo
            ? <img src={settings.logo} alt="logo" style={{ width: 46, height: 46, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />
            : <Crest size={46} />}
          <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 14, fontWeight: 900, color: C.gld }}>{settings.clubName}</div><div style={{ fontSize: 9, color: C.gld + "8c", marginTop: 1 }}>{settings.clubSub}</div></div>
          <button onClick={() => setCmdOpen(true)} title="بحث شامل (Ctrl+K)" style={{ position: "relative", background: "rgba(255,255,255,.1)", border: "none", borderRadius: 9, width: 32, height: 32, cursor: "pointer", fontSize: 14, color: C.gld, flexShrink: 0 }}>
            🔎
          </button>
          <button onClick={() => setNotifOpen(o => !o)} title="التنبيهات" style={{ position: "relative", background: "rgba(255,255,255,.1)", border: "none", borderRadius: 9, width: 32, height: 32, cursor: "pointer", fontSize: 15, color: C.gld, flexShrink: 0 }}>
            🔔
            {notifications.length > 0 && <span style={{ position: "absolute", top: -4, left: -4, background: "#e34948", color: "#fff", fontSize: 9.5, fontWeight: 700, minWidth: 16, height: 16, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px" }}>{notifications.length}</span>}
          </button>
          {notifOpen && (
            <>
              <div onClick={() => setNotifOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 149 }} />
              <div className="nk-modal-in" style={{ position: "absolute", top: "100%", left: 0, marginTop: 6, width: 280, maxHeight: 360, overflowY: "auto", background: "#fff", borderRadius: 12, boxShadow: "0 14px 40px rgba(0,0,0,.35)", zIndex: 150, padding: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.ink, padding: "4px 6px 8px", borderBottom: `0.5px solid ${C.bc}`, marginBottom: 6 }}>🔔 التنبيهات ({notifications.length})</div>
                {notifications.length === 0 ? (
                  <div style={{ textAlign: "center", color: C.mt, fontSize: 12, padding: "1.2rem 0" }}>لا تنبيهات حالياً ✓</div>
                ) : notifications.map(n => (
                  <div key={n.id} onClick={() => { goPage(n.page); setNotifOpen(false); }} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 6px", borderRadius: 8, cursor: "pointer", fontSize: 12, color: C.ink }} className="nk-nav-item">
                    <span style={{ fontSize: 15 }}>{n.icon}</span><span style={{ flex: 1, lineHeight: 1.5 }}>{n.text}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        <div style={{ padding: ".5rem 0", flex: 1 }}>
          {HUBS.filter(visibleHub).map((h) => {
            const tabs = h.tabs.filter(visibleItem);
            const isActiveHub = h.id === activeHub.id;
            const hubBadgeCount = h.id === "clients" ? overdueAlerts.length : 0;
            return (
              <div key={h.id} style={{ marginBottom: 2 }}>
                {/* صف المركز — دائماً ظاهر */}
                <div
                  onClick={() => { if (!isActiveHub) goPage(tabs[0].id); }}
                  className="nk-nav-item"
                  style={{
                    display: "flex", alignItems: "center", gap: 10, padding: ".62rem .95rem", cursor: "pointer",
                    fontSize: T.font.sm, fontWeight: isActiveHub ? 800 : 600,
                    color: isActiveHub ? C.gld : "rgba(255,255,255,.72)",
                    borderRight: isActiveHub ? `3px solid ${C.gold}` : "3px solid transparent",
                    background: isActiveHub ? C.gold + "1c" : "transparent",
                  }}>
                  <span style={{ width: 18, display: "flex", justifyContent: "center", flexShrink: 0 }}><HubIcon id={h.icon} size={17} /></span>
                  <span style={{ flex: 1 }}>{h.label}</span>
                  {hubBadgeCount > 0 && (
                    <span style={{ background: "#e34948", color: "#fff", fontSize: 10, fontWeight: 700, minWidth: 17, height: 17, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px", animation: settings.animations ? "nkGlow 2s infinite" : "none" }}>{hubBadgeCount}</span>
                  )}
                  {tabs.length > 1 && (
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,.4)", transform: isActiveHub ? "rotate(90deg)" : "none", transition: "transform .18s" }}>◂</span>
                  )}
                </div>
                {/* تبويبات المركز النشط — تُعرض فقط عندما يكون هذا المركز مفتوحاً، ولا تُعرض إن كان تبويباً وحيداً (لا فائدة من تكرار الاسم) */}
                {isActiveHub && tabs.length > 1 && (
                  <div style={{ padding: "2px 0 4px" }}>
                    {tabs.map((it) => (
                      <div key={it.id} onClick={() => goPage(it.id)} className="nk-nav-item"
                        style={{ display: "flex", alignItems: "center", gap: 8, padding: ".42rem .95rem .42rem 1.6rem", cursor: "pointer", fontSize: T.font.xs + 1,
                          color: page === it.id ? "#fff" : "rgba(255,255,255,.58)",
                          background: page === it.id ? "rgba(255,255,255,.08)" : "transparent" }}>
                        <span style={{ opacity: .5, fontSize: 4 }}>●</span>{it.label}
                        {it.id === "alerts" && overdueAlerts.length > 0 && (
                          <span style={{ marginRight: "auto", background: "#e34948", color: "#fff", fontSize: 9.5, fontWeight: 700, minWidth: 16, height: 16, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }}>{overdueAlerts.length}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div style={{ padding: ".85rem .95rem", borderTop: "1px solid rgba(201,168,76,.2)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <div style={{ width: 29, height: 29, borderRadius: "50%", background: C.gold, color: C.grn, fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{user.name.slice(0, 2)}</div>
            <div style={{ flex: 1 }}><div style={{ fontSize: 12, color: "rgba(255,255,255,.82)", fontWeight: 500 }}>{user.name}</div><div style={{ fontSize: 10, color: "rgba(255,255,255,.38)" }}>{user.role}{user.shift !== "—" ? " — " + user.shift : ""}</div></div>
            <button onClick={() => { setUser(null); setPage("dashboard"); setNavOpen(false); }} title="تسجيل الخروج" style={{ background: "none", border: "none", color: "rgba(255,255,255,.5)", cursor: "pointer", fontSize: 16 }}>⎋</button>
          </div>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ marginRight: isTab ? 0 : 225, minHeight: "100vh", padding: isTab ? ".9rem .8rem" : "1.1rem 1.4rem" }}>
        <div className="nk-page" key={page}>
        {page === "dashboard" && <Dashboard ctx={ctx} go={setPage} />}
        {page === "pos" && <POS ctx={ctx} can={can} />}
        {page === "sales" && <Sales ctx={ctx} can={can} />}
        {page === "purchases" && <Purchases ctx={ctx} />}
        {page === "products" && <Products ctx={ctx} can={can} />}
        {page === "inventory" && <Inventory ctx={ctx} />}
        {page === "assets" && <Assets ctx={ctx} />}
        {page === "rentals" && <RentalDevices ctx={ctx} />}
        {page === "bookings" && <Bookings ctx={ctx} />}
        {page === "tournaments" && <Tournaments ctx={ctx} />}
        {page === "suppliers" && <Suppliers ctx={ctx} />}
        {page === "customers" && <Customers ctx={ctx} />}
        {page === "alerts" && <Alerts ctx={ctx} />}
        {page === "coupons" && <Coupons ctx={ctx} />}
        {page === "promos" && <Promotions ctx={ctx} />}
        {page === "treasury" && <Treasury ctx={ctx} />}
        {page === "activity" && <EmployeeActivity ctx={ctx} />}
        {page === "expenses" && <Expenses ctx={ctx} />}
        {page === "salaries" && <Salaries ctx={ctx} />}
        {page === "capital" && <CapitalLedger ctx={ctx} />}
        {page === "reports" && <Reports ctx={ctx} />}
        {page === "insights" && <Insights ctx={ctx} />}
        {page === "users" && <Users ctx={ctx} />}
        {page === "settings" && <Settings ctx={ctx} />}
        </div>
      </div>

      {/* TOAST */}
      {toast && (() => {
        const t = typeof toast === "string" ? { msg: toast } : toast;
        return (
          <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", background: C.grn, color: "#fff", borderRadius: 12, fontSize: T.font.base, fontWeight: 600, zIndex: 600, boxShadow: "0 8px 24px rgba(0,0,0,.25)", overflow: "hidden", animation: settings.animations ? "nkPop .3s ease" : "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: ".85rem 1.4rem" }}>
              <span>✓ {t.msg}</span>
              {t.onUndo && (
                <button onClick={() => { t.onUndo(); setToast(null); }} style={{ background: "rgba(255,255,255,.18)", border: "none", color: "#fff", borderRadius: 8, fontSize: T.font.sm, fontWeight: 700, padding: ".3rem .75rem", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>{t.actionLabel}</button>
              )}
            </div>
            <div style={{ height: 3, background: "rgba(255,255,255,.25)" }}><div style={{ height: "100%", background: "#fff", width: settings.animations ? undefined : "0%", animation: settings.animations ? "nkToastShrink 2.8s linear forwards" : "none" }} /></div>
          </div>
        );
      })()}

      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} products={products} customers={customers} invoices={invoices} hubs={HUBS} goPage={goPage} setSearchIntent={setSearchIntent} currency={settings.currency || "د.ل"} />

      {/* PDF PREVIEW OVERLAY */}
      {pdfDoc && <PdfPreview doc={pdfDoc} onClose={() => setPdfDoc(null)} />}
    </div>
  );
}

/* ============================ LOGIN ============================ */
/* ============================ FIRST SETUP (إنشاء المدير الرئيسي) ============================ */
function FirstSetup({ settings = {}, onCreate }) {
  const [f, setF] = useState({ name: "", username: "admin", password: "", confirm: "", clubName: settings.clubName || "نادي النخيل" });
  const [err, setErr] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));

  const create = () => {
    if (!f.name.trim()) { setErr("أدخل اسمك الكامل"); return; }
    if (!f.username.trim()) { setErr("أدخل اسم المستخدم"); return; }
    if (!f.password || f.password.length < 4) { setErr("أدخل رمز دخول من 4 خانات على الأقل"); return; }
    if (f.password !== f.confirm) { setErr("رمز الدخول وتأكيده غير متطابقين"); return; }
    const admin = {
      id: 1, name: f.name.trim(), username: f.username.trim(), password: f.password, role: "مدير", shift: "—", active: true,
      perms: { invoices: true, discounts: true, cancel: true, reports: true, customers: true, prices: true, purchases: true, inventory: true, salaries: true },
      pages: {},
    };
    onCreate(admin);
  };

  return (
    <div dir="rtl" style={{ fontFamily: "'Tajawal',sans-serif", minHeight: "100vh", background: "radial-gradient(circle at 30% 20%, #1a5c2e 0%, #14431f 45%, #0a2712 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;900&display=swap" rel="stylesheet" />
      <div style={{ background: "#fff", borderRadius: 22, padding: "2.2rem 2rem", width: 460, maxWidth: "95vw", boxShadow: "0 24px 70px rgba(0,0,0,.4)" }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>{settings.logo ? <img src={settings.logo} alt="" style={{ width: 66, height: 66, borderRadius: 16, objectFit: "cover" }} /> : <Crest size={66} />}</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: C.grn2 }}>مرحباً بك في {f.clubName}</div>
          <div style={{ display: "inline-block", background: C.gold + "1c", color: C.gdd, fontSize: 12, fontWeight: 700, borderRadius: 20, padding: ".25rem .9rem", marginTop: 8 }}>⚙ الإعداد الأولي — إنشاء حساب المدير</div>
          <div style={{ fontSize: 12, color: C.mt, marginTop: 10, lineHeight: 1.8 }}>هذه أول مرة تشغّل فيها النظام (أو بعد تصفيره).<br />أنشئ حساب المدير الرئيسي للبدء.</div>
        </div>

        <div style={{ textAlign: "right", marginBottom: 12 }}>
          <label style={{ fontSize: 11, color: C.mt, fontWeight: 600 }}>الاسم الكامل *</label>
          <input value={f.name} autoFocus onChange={e => { set("name", e.target.value); setErr(""); }} placeholder="مثال: أحمد الحسين"
            style={{ width: "100%", marginTop: 4, fontSize: 13, border: `0.5px solid ${C.bc}`, borderRadius: 10, padding: ".6rem .8rem", background: C.crm, fontFamily: "inherit", outline: "none" }} />
        </div>
        <div style={{ textAlign: "right", marginBottom: 12 }}>
          <label style={{ fontSize: 11, color: C.mt, fontWeight: 600 }}>اسم المستخدم (للدخول) *</label>
          <input value={f.username} onChange={e => { set("username", e.target.value); setErr(""); }} placeholder="admin"
            onKeyDown={e => e.key === "Enter" && create()}
            style={{ width: "100%", marginTop: 4, fontSize: 13, border: `0.5px solid ${C.bc}`, borderRadius: 10, padding: ".6rem .8rem", background: C.crm, fontFamily: "inherit", outline: "none", direction: "ltr", textAlign: "left" }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
          <div style={{ textAlign: "right" }}>
            <label style={{ fontSize: 11, color: C.mt, fontWeight: 600 }}>رمز الدخول *</label>
            <input type={showPwd ? "text" : "password"} autoComplete="new-password" value={f.password} onChange={e => { set("password", e.target.value); setErr(""); }} placeholder="••••••"
              style={{ width: "100%", marginTop: 4, fontSize: 14, border: `0.5px solid ${C.bc}`, borderRadius: 10, padding: ".6rem .8rem", background: C.crm, fontFamily: "inherit", outline: "none" }} />
          </div>
          <div style={{ textAlign: "right" }}>
            <label style={{ fontSize: 11, color: C.mt, fontWeight: 600 }}>تأكيد الرمز *</label>
            <input type={showPwd ? "text" : "password"} autoComplete="new-password" value={f.confirm} onChange={e => { set("confirm", e.target.value); setErr(""); }} placeholder="••••••" onKeyDown={e => e.key === "Enter" && create()}
              style={{ width: "100%", marginTop: 4, fontSize: 14, border: `0.5px solid ${C.bc}`, borderRadius: 10, padding: ".6rem .8rem", background: C.crm, fontFamily: "inherit", outline: "none" }} />
          </div>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: C.mt, marginBottom: 12, cursor: "pointer" }}><input type="checkbox" checked={showPwd} onChange={e => setShowPwd(e.target.checked)} /> إظهار الرمز أثناء الكتابة</label>

        {err && <div style={{ color: C.red, fontSize: 12, marginBottom: 12, textAlign: "center" }}>{err}</div>}

        <button onClick={create} style={{ width: "100%", padding: ".8rem", borderRadius: 12, background: "linear-gradient(135deg,#c9a84c,#b8923c)", color: "#fff", border: "none", fontSize: 14.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>✓ إنشاء الحساب والدخول</button>

        <div style={{ fontSize: 10.5, color: C.mt, marginTop: 16, textAlign: "center", lineHeight: 1.7 }}>
          سيحصل هذا الحساب على كامل صلاحيات الإدارة.<br />
          يمكنك إضافة بائعين وموظفين لاحقاً من قسم المستخدمين.
        </div>
      </div>
    </div>
  );
}

function Login({ users, onLogin, settings = {} }) {
  const [selected, setSelected] = useState(null);
  const [pwd, setPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [err, setErr] = useState("");
  const [shake, setShake] = useState(false);
  const [phase, setPhase] = useState("idle"); // idle | checking | success
  const activeUsers = users.filter(u => u.active);

  const submit = () => {
    if (!selected || phase !== "idle") return;
    if (selected.password) {
      if (pwd !== selected.password) {
        setErr("رمز الدخول غير صحيح"); setPwd(""); setShake(true);
        setTimeout(() => setShake(false), 420);
        return;
      }
    }
    // لمسة احترافية: نبضة نجاح قصيرة قبل الدخول الفعلي
    setPhase("checking");
    setTimeout(() => {
      setPhase("success");
      setTimeout(() => onLogin(selected), 480);
    }, 420);
  };
  const roleIcon = (r) => r === "مدير" ? "👑" : "🧑‍💼";
  const pick = (u) => { setSelected(u); setErr(""); setPwd(""); };
  const back = () => { setSelected(null); setPwd(""); setErr(""); setPhase("idle"); };

  return (
    <div dir="rtl" style={{ fontFamily: "'Tajawal',sans-serif", minHeight: "100vh", background: "radial-gradient(circle at 30% 20%, #1a5c2e 0%, #14431f 45%, #0a2712 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, position: "relative", overflow: "hidden" }}>
      <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;900&display=swap" rel="stylesheet" />
      <style>{`
        @keyframes nkPopIn{0%{opacity:0;transform:translateY(22px) scale(.96)}100%{opacity:1;transform:none}}
        @keyframes nkGlowBg{0%,100%{opacity:.5;transform:scale(1)}50%{opacity:.85;transform:scale(1.08)}}
        @keyframes nkGlowBg2{0%,100%{opacity:.35;transform:scale(1)}50%{opacity:.6;transform:scale(1.12)}}
        @keyframes nkFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-14px)}}
        @keyframes nkCardIn{0%{opacity:0;transform:translateY(14px) scale(.94)}100%{opacity:1;transform:none}}
        @keyframes nkShake{10%,90%{transform:translateX(-1px)}20%,80%{transform:translateX(2px)}30%,50%,70%{transform:translateX(-5px)}40%,60%{transform:translateX(5px)}}
        @keyframes nkShimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
        @keyframes nkSpin{to{transform:rotate(360deg)}}
        @keyframes nkCheckPop{0%{opacity:0;transform:scale(.3) rotate(-20deg)}60%{transform:scale(1.15) rotate(4deg)}100%{opacity:1;transform:scale(1) rotate(0)}}
        @keyframes nkSlideIn{0%{opacity:0;transform:translateX(14px)}100%{opacity:1;transform:none}}
        @keyframes nkRing{0%{box-shadow:0 0 0 0 rgba(201,168,76,.55)}100%{box-shadow:0 0 0 10px rgba(201,168,76,0)}}
        .nk-login-card:hover { transform: translateY(-3px); box-shadow: 0 10px 26px rgba(0,0,0,.1); border-color: rgba(201,168,76,.55) !important; }
        .nk-login-card:active { transform: translateY(-1px) scale(.98); }
        .nk-login-card { transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease; }
        .nk-shake { animation: nkShake .42s ease; }
        .nk-btn-primary { transition: transform .15s ease, box-shadow .15s ease, filter .15s ease; }
        .nk-btn-primary:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 20px rgba(201,168,76,.4); filter: brightness(1.04); }
        .nk-btn-primary:active:not(:disabled) { transform: translateY(0) scale(.98); }
        .nk-back-btn { transition: color .15s ease, transform .15s ease; }
        .nk-back-btn:hover { color: #c9a84c !important; transform: translateX(3px); }
        .nk-eye-btn { transition: color .15s ease, transform .15s ease; }
        .nk-eye-btn:hover { color: #c9a84c !important; transform: translateY(-50%) scale(1.12); }
        .nk-pwd-input:focus { border-color: #c9a84c !important; box-shadow: 0 0 0 3px rgba(201,168,76,.15); }
      `}</style>

      {/* خلفية متوهجة متحركة */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", background: "radial-gradient(circle at 78% 82%, rgba(201,168,76,.16) 0%, transparent 42%)", animation: "nkGlowBg 6s ease-in-out infinite" }} />
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", background: "radial-gradient(circle at 15% 15%, rgba(255,255,255,.08) 0%, transparent 38%)", animation: "nkGlowBg2 7s ease-in-out infinite 1s" }} />
      {/* نخيل عائم خفيف في الخلفية للمسة هوية */}
      <div style={{ position: "fixed", bottom: "6%", left: "6%", fontSize: 90, opacity: .06, animation: "nkFloat 8s ease-in-out infinite", pointerEvents: "none" }}>🌴</div>
      <div style={{ position: "fixed", top: "10%", right: "8%", fontSize: 60, opacity: .05, animation: "nkFloat 9s ease-in-out infinite 1.5s", pointerEvents: "none" }}>🌴</div>

      <div style={{ background: "#fff", borderRadius: 22, padding: "2.2rem 2rem", width: 440, maxWidth: "95vw", boxShadow: "0 24px 70px rgba(0,0,0,.45)", animation: "nkPopIn .45s cubic-bezier(.2,.8,.2,1)", position: "relative", overflow: "hidden" }}>
        {/* خط ذهبي علوي متلألئ */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg, transparent, #c9a84c, transparent)", backgroundSize: "200% 100%", animation: "nkShimmer 3s linear infinite" }} />

        <div style={{ textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
            <div style={{ position: "relative" }}>
              {phase === "success" && <div style={{ position: "absolute", inset: -4, borderRadius: 18, animation: "nkRing 1s ease-out infinite" }} />}
              {settings.logo ? <img src={settings.logo} alt="" style={{ width: 66, height: 66, borderRadius: 16, objectFit: "cover" }} /> : <Crest size={66} />}
            </div>
          </div>
          <div style={{ fontSize: 21, fontWeight: 900, color: C.grn2 }}>{settings.clubName || "نادي النخيل"}</div>
          <div style={{ fontSize: 12, color: C.mt, marginBottom: 22, transition: "opacity .2s ease" }}>
            {phase === "success" ? "تم التحقق بنجاح ✓" : selected ? `مرحباً ${selected.name}` : "اختر المستخدم لتسجيل الدخول"}
          </div>
        </div>

        {!selected ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {activeUsers.map((u, i) => (
              <div key={u.id} onClick={() => pick(u)} className="nk-login-card" style={{ cursor: "pointer", border: `1px solid ${C.bc}`, borderRadius: 14, padding: "1rem .8rem", textAlign: "center", background: C.crm, animation: `nkCardIn .38s cubic-bezier(.2,.8,.2,1) both`, animationDelay: `${i * 60}ms` }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", margin: "0 auto 8px", background: u.role === "مدير" ? C.gold + "22" : C.grl + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>{roleIcon(u.role)}</div>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>{u.name}</div>
                <div style={{ fontSize: 11, color: C.mt, marginTop: 2 }}>{u.role}{u.shift !== "—" ? ` · ${u.shift}` : ""}</div>
              </div>
            ))}
            {activeUsers.length === 0 && <div style={{ gridColumn: "1 / -1", textAlign: "center", color: C.mt, fontSize: 12.5, padding: "1.5rem" }}>لا يوجد مستخدمون نشطون</div>}
          </div>
        ) : (
          <div style={{ animation: "nkSlideIn .3s cubic-bezier(.2,.8,.2,1)" }} className={shake ? "nk-shake" : ""}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, background: C.crm, borderRadius: 12, padding: ".7rem .85rem", marginBottom: 14 }}>
              <div style={{ width: 42, height: 42, borderRadius: "50%", background: phase === "success" ? "#1a8c3e22" : selected.role === "مدير" ? C.gold + "22" : C.grl + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 21, transition: "background .3s ease" }}>
                {phase === "success" ? <span style={{ display: "inline-block", animation: "nkCheckPop .4s ease" }}>✅</span> : roleIcon(selected.role)}
              </div>
              <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 700 }}>{selected.name}</div><div style={{ fontSize: 11, color: C.mt }}>{selected.role}</div></div>
              {phase === "idle" && <button onClick={back} className="nk-back-btn" style={{ background: "none", border: "none", color: C.mt, cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>تغيير</button>}
            </div>

            {phase !== "success" && <>
              <label style={{ fontSize: 11, color: C.mt, fontWeight: 600 }}>رمز الدخول</label>
              <div style={{ position: "relative", marginTop: 4, marginBottom: 16 }}>
                <input className="nk-pwd-input" type={showPwd ? "text" : "password"} autoFocus autoComplete="new-password" disabled={phase === "checking"} value={pwd} onChange={(e) => { setPwd(e.target.value); setErr(""); }} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="••••••••"
                  style={{ width: "100%", fontSize: 14, letterSpacing: showPwd ? 0 : 2, border: `0.5px solid ${C.bc}`, borderRadius: 10, padding: ".6rem 2.4rem .6rem .8rem", background: C.crm, fontFamily: "inherit", outline: "none", transition: "border-color .15s ease, box-shadow .15s ease", opacity: phase === "checking" ? .6 : 1 }} />
                <button onClick={() => setShowPwd(s => !s)} tabIndex={-1} title={showPwd ? "إخفاء" : "إظهار"} className="nk-eye-btn" style={{ position: "absolute", top: "50%", right: 8, transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 15, color: C.mt, padding: 4 }}>{showPwd ? "🙈" : "👁"}</button>
              </div>
              {err && <div style={{ color: C.red, fontSize: 12, marginBottom: 12, display: "flex", alignItems: "center", gap: 5 }}><span>⚠</span>{err}</div>}
              <button onClick={submit} disabled={phase === "checking"} className="nk-btn-primary" style={{ width: "100%", padding: ".72rem", borderRadius: 12, background: "linear-gradient(135deg,#c9a84c,#b8923c)", color: "#fff", border: "none", fontSize: 14.5, fontWeight: 700, cursor: phase === "checking" ? "default" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                {phase === "checking" ? <><span style={{ width: 15, height: 15, border: "2px solid rgba(255,255,255,.4)", borderTopColor: "#fff", borderRadius: "50%", animation: "nkSpin .6s linear infinite" }} />جارٍ التحقق...</> : "دخول →"}
              </button>
            </>}
          </div>
        )}

        <div style={{ fontSize: 10.5, color: C.mt, marginTop: 18, textAlign: "center", lineHeight: 1.7 }}>
          نظام إدارة متكامل — {new Date().getFullYear()}<br />
          <span style={{ fontSize: 10 }}>أدخل رمز الدخول الخاص بك — يديره المدير من قسم المستخدمين</span>
        </div>
      </div>
    </div>
  );
}


/* ============================ SHARED LAYOUT ============================ */
function PageTop({ title, action }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.1rem", flexWrap: "wrap", gap: 8 }}>
      <div style={{ fontSize: 18, fontWeight: 700 }}>{title}</div>
      <div style={{ display: "flex", gap: 7 }}>{action}</div>
    </div>
  );
}
const Card = ({ children, style, className }) => (
  <div className={"nk-theme-transition" + (className ? " " + className : "")} style={{ background: C.cd, border: `0.5px solid ${C.bc}`, borderRadius: 13, padding: ".95rem 1.05rem", boxShadow: "0 1px 2px rgba(20,67,31,.03)", ...style }}>{children}</div>
);
const CardHead = ({ title, sub, right }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: ".85rem", flexWrap: "wrap", gap: 6 }}>
    <div><div style={{ fontSize: 13, fontWeight: 700 }}>{title}</div>{sub && <div style={{ fontSize: 11, color: C.mt }}>{sub}</div>}</div>
    {right}
  </div>
);
const Btn = ({ children, onClick, gold, danger, sm, style }) => (
  <button onClick={onClick} style={{
    display: "inline-flex", alignItems: "center", gap: 5, padding: sm ? ".2rem .58rem" : ".36rem .82rem",
    borderRadius: 8, fontSize: sm ? 11.5 : 12.5, cursor: "pointer", fontFamily: "inherit", fontWeight: 500,
    border: `1px solid ${danger ? "rgba(192,57,43,.3)" : C.bc}`,
    background: gold ? "linear-gradient(135deg,#c9a84c,#b8923c)" : C.cd,
    color: gold ? "#fff" : danger ? C.red : C.ink, ...style,
  }}>{children}</button>
);
const KCard = ({ label, value, sub, bar = C.gold, delta }) => (
  <div className="nk-kcard" style={{ background: C.cd, border: `0.5px solid ${C.bc}`, borderRadius: 13, padding: ".85rem 1rem", position: "relative", overflow: "hidden", boxShadow: "0 1px 2px rgba(20,67,31,.04)" }}>
    <div className="nk-kcard-bar" style={{ position: "absolute", top: 0, right: 0, width: 4, height: "100%", background: bar }} />
    <div style={{ fontSize: T.font.xs, color: C.mt, marginBottom: ".18rem", fontWeight: 500 }}>{label}</div>
    <div style={{ fontSize: T.font.num, fontWeight: 700, lineHeight: 1 }}>{value}</div>
    {sub && <div style={{ fontSize: T.font.xs - 1, color: C.mt, marginTop: 2 }}>{sub}</div>}
    {delta && <div style={{ fontSize: 11, marginTop: ".28rem", fontWeight: 500, color: delta.up ? "#1a8c3e" : C.red }}>{delta.up ? "▲" : "▼"} {delta.text}</div>}
  </div>
);
const Field = ({ label, children, full }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: ".75rem", gridColumn: full ? "1/-1" : "auto" }}>
    <label style={{ fontSize: 11, color: C.mt, fontWeight: 600 }}>{label}</label>{children}
  </div>
);
const inputStyle = { fontSize: 12.5, border: `0.5px solid ${C.bc}`, borderRadius: 8, padding: ".4rem .7rem", background: C.crm, color: C.ink, outline: "none", fontFamily: "inherit", width: "100%" };
const Inp = (p) => <input {...p} style={{ ...inputStyle, ...(p.style || {}) }} />;
const Sel = (p) => <select {...p} style={{ ...inputStyle, ...(p.style || {}) }}>{p.children}</select>;

function Modal({ title, onClose, children, width = 540 }) {
  return (
    <div onClick={(e) => e.target === e.currentTarget && onClose()} style={{ position: "fixed", inset: 0, background: "rgba(10,30,15,.5)", backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
      <div className="nk-modal-in" style={{ background: C.cd, borderRadius: 16, padding: "1.4rem 1.5rem", width, maxWidth: "96vw", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 24px 60px rgba(0,0,0,.35)" }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: "1.1rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {title}<button onClick={onClose} style={{ cursor: "pointer", color: C.mt, fontSize: 18, background: "none", border: "none", fontFamily: "inherit" }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
const Table = ({ cols, rows }) => (
  <div className="nk-tbl-wrap">
    <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
      <thead><tr>{cols.map((c, i) => <th key={i} style={{ width: c.w, textAlign: "right", padding: ".42rem .5rem", color: C.mt, fontWeight: 600, borderBottom: `1px solid ${C.bc}`, fontSize: 11 }}>{c.h}</th>)}</tr></thead>
      <tbody>{rows.map((r, ri) => (
        <tr key={ri} className="nk-row-in" style={{ animationDelay: ri < 20 ? `${ri * 22}ms` : "0ms" }}>{r.map((cell, ci) => <td key={ci} style={{ padding: ".48rem .5rem", borderBottom: `0.5px solid rgba(201,168,76,.09)`, color: C.k2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cell}</td>)}</tr>
      ))}</tbody>
    </table>
  </div>
);

/* ============================ COMMAND PALETTE (البحث الشامل) ============================ */
function CommandPalette({ open, onClose, products, customers, invoices, hubs, goPage, setSearchIntent, currency }) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => { if (open) { setQ(""); setActive(0); setTimeout(() => inputRef.current?.focus(), 30); } }, [open]);

  // فهرس الأوامر الثابتة: أي تبويب في أي مركز عمل يمكن الوصول إليه مباشرة بالاسم
  const pageCommands = useMemo(() =>
    hubs.flatMap(h => h.tabs.map(t => ({ kind: "page", id: t.id, label: t.label, sub: h.label, icon: t.icon || "▸" }))),
    [hubs]);

  const results = useMemo(() => {
    const term = q.trim();
    if (!term) return pageCommands.slice(0, 8);
    const out = [];
    // 1) أوامر التنقل
    pageCommands.filter(c => c.label.includes(term)).forEach(c => out.push(c));
    // 2) الزبائن (بالاسم أو الهاتف)
    (customers || []).filter(c => c.name.includes(term) || (c.phone || "").includes(term)).slice(0, 5)
      .forEach(c => out.push({ kind: "customer", id: c.id, label: c.name, sub: `${c.phone || "—"} ${c.debt > 0 ? `· دين ${fmt(c.debt)} ${currency}` : ""}`, icon: "👤" }));
    // 3) المنتجات (بالاسم أو الباركود)
    (products || []).filter(p => p.name.includes(term) || (p.bc || "").includes(term) || (p.barcodes || []).some(b => b.includes(term))).slice(0, 5)
      .forEach(p => out.push({ kind: "product", id: p.id, label: p.name, sub: `${p.bc || "بلا باركود"} · ${fmt(p.sell)} ${currency}`, icon: "📦" }));
    // 4) الفواتير (برقم الفاتورة)
    (invoices || []).filter(i => i.id.includes(term)).slice(0, 5)
      .forEach(i => out.push({ kind: "invoice", id: i.id, label: `فاتورة ${i.id}`, sub: `${i.customer} · ${fmt(i.total)} ${currency}`, icon: "🧾" }));
    return out.slice(0, 12);
  }, [q, pageCommands, customers, products, invoices, currency]);

  const choose = (r) => {
    if (!r) return;
    if (r.kind === "page") goPage(r.id);
    else if (r.kind === "customer") { setSearchIntent({ type: "customer", query: r.label, id: r.id }); goPage("customers"); }
    else if (r.kind === "product") { setSearchIntent({ type: "product", query: r.label, id: r.id }); goPage("products"); }
    else if (r.kind === "invoice") { setSearchIntent({ type: "invoice", query: r.id, id: r.id }); goPage("sales"); }
    onClose();
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive(a => Math.min(a + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); choose(results[active]); }
  };

  if (!open) return null;
  return (
    <div onClick={(e) => e.target === e.currentTarget && onClose()} style={{ position: "fixed", inset: 0, background: "rgba(10,30,15,.45)", backdropFilter: "blur(2px)", zIndex: 700, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "12vh" }}>
      <div className="nk-modal-in" style={{ width: 560, maxWidth: "92vw", background: C.cd, borderRadius: 16, boxShadow: "0 24px 70px rgba(0,0,0,.4)", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0.9rem 1.1rem", borderBottom: `1px solid ${C.bc}` }}>
          <span style={{ fontSize: 17, color: C.mt }}>🔎</span>
          <input ref={inputRef} value={q} onChange={(e) => { setQ(e.target.value); setActive(0); }} onKeyDown={onKeyDown}
            placeholder="ابحث عن زبون، منتج، فاتورة، أو صفحة..."
            style={{ flex: 1, border: "none", outline: "none", fontSize: T.font.lg, fontFamily: "inherit", background: "transparent", color: C.ink }} />
          <kbd style={{ fontSize: 10, color: C.mt, background: C.crm, border: `1px solid ${C.bc}`, borderRadius: 6, padding: "2px 6px" }}>Esc</kbd>
        </div>
        <div style={{ maxHeight: "55vh", overflowY: "auto", padding: 6 }}>
          {results.length === 0 && <div style={{ textAlign: "center", color: C.mt, fontSize: 13, padding: "2rem 0" }}>لا نتائج مطابقة</div>}
          {results.map((r, i) => (
            <div key={`${r.kind}-${r.id}`} onClick={() => choose(r)} onMouseEnter={() => setActive(i)}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: ".62rem .8rem", borderRadius: 10, cursor: "pointer",
                background: i === active ? C.gold + "1c" : "transparent" }}>
              <span style={{ fontSize: 16, width: 22, textAlign: "center", flexShrink: 0 }}>{r.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: T.font.sm, fontWeight: 600, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.label}</div>
                {r.sub && <div style={{ fontSize: T.font.xs, color: C.mt, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.sub}</div>}
              </div>
              {r.kind === "page" && <span style={{ fontSize: 10, color: C.mt }}>صفحة</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ============================ DASHBOARD ============================ */
function MiniBars({ data, max, color }) {
  return (
    <svg viewBox="0 0 300 120" style={{ width: "100%", height: 120 }}>
      {data.map((d, i) => {
        const h = (d / max) * 90;
        const x = 20 + i * 46;
        return <g key={i}>
          <rect x={x} y={100 - h} width={28} height={h} rx={4} fill={color} className="nk-bar-grow" style={{ transformOrigin: `${x + 14}px 100px`, animationDelay: `${i * 55}ms` }} />
        </g>;
      })}
      <line x1="10" y1="100" x2="290" y2="100" stroke={C.bc} strokeWidth="1" />
    </svg>
  );
}
function Donut({ segments, size = 150 }) {
  const total = segments.reduce((s, x) => s + x.v, 0);
  let acc = 0; const r = 52, cx = size / 2, cy = size / 2, sw = 22;
  const circumference = 2 * Math.PI * r;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} style={{ width: size, height: size }}>
      {segments.map((seg, i) => {
        const frac = seg.v / total;
        const start = acc * 2 * Math.PI - Math.PI / 2;
        acc += frac;
        const end = acc * 2 * Math.PI - Math.PI / 2;
        const large = frac > 0.5 ? 1 : 0;
        const x1 = cx + r * Math.cos(start), y1 = cy + r * Math.sin(start);
        const x2 = cx + r * Math.cos(end), y2 = cy + r * Math.sin(end);
        const len = Math.max(0.01, frac * circumference);
        return <path key={i} d={`M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`} fill="none" stroke={seg.c} strokeWidth={sw}
          className="nk-donut-seg" style={{ strokeDasharray: len, "--nk-len": len + "px", animationDelay: `${i * 140}ms` }} />;
      })}
    </svg>
  );
}
function Dashboard({ ctx, go }) {
  const { totals, invoices, products, overdueAlerts, completedBookings, cats, settings } = ctx;
  const cur = settings?.currency || "د.ل";
  const low = products.filter(p => p.stock !== null && p.min && p.stock < p.min);

  // آخر 7 أيام — إيراد فعلي من الفواتير المدفوعة
  const last7 = useMemo(() => {
    const days = [], labels = [];
    const dayName = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const iso = d.toISOString().split("T")[0];
      const rev = invoices.filter(v => v.date === iso && v.status === "مدفوعة").reduce((s, v) => s + v.total, 0);
      days.push(rev); labels.push(i === 0 ? "اليوم" : dayName[d.getDay()]);
    }
    return { days, labels, max: Math.max(1000, ...days) };
  }, [invoices]);

  const todayISOv = new Date().toISOString().split("T")[0];
  const todayRev = invoices.filter(v => v.date === todayISOv && v.status === "مدفوعة").reduce((s, v) => s + v.total, 0);
  const todayCount = invoices.filter(v => v.date === todayISOv).length;

  // توزيع المبيعات حسب القسم (من مصدر الفاتورة والتفاصيل)
  const dist = useMemo(() => {
    let games = 0, cafe = 0, other = 0;
    invoices.filter(v => v.status === "مدفوعة").forEach(v => {
      if (v.source === "حجز") games += v.total;
      else if (v.details && (v.details.includes("قهوة") || v.details.includes("عصير") || v.details.includes("Red") || v.details.includes("ساندويش"))) cafe += v.total;
      else if (v.details && (v.details.includes("PS5") || v.details.includes("Xbox") || v.details.includes("كنترول"))) games += v.total;
      else other += v.total;
    });
    const tot = games + cafe + other || 1;
    return { games, cafe, other, gPct: Math.round(games / tot * 100), cPct: Math.round(cafe / tot * 100) };
  }, [invoices]);

  // ألوان اللهجة (tone) لبطاقات المهام — نفس القاموس المستخدم في جرس التنبيهات، مركزي هنا لتفادي التكرار
  const TASK_TONE = {
    r:    { bg: "linear-gradient(135deg,#fdeaea,#fff)", border: "rgba(192,57,43,.3)", ink: "#922", btn: "danger" },
    a:    { bg: "linear-gradient(135deg,#fff6e6,#fff)", border: `${C.gold}66`, ink: C.gdd, btn: "gold" },
    gold: { bg: "linear-gradient(135deg,#fff6e6,#fff)", border: `${C.gold}66`, ink: C.gdd, btn: "gold" },
    b:    { bg: "linear-gradient(135deg,#eaf1fd,#fff)", border: "rgba(26,62,140,.25)", ink: C.blue, btn: "primary" },
  };
  const tasks = ctx.notifications || [];

  return (
    <>
      <PageTop title="لوحة التحكم" action={<Badge tone="gold">{new Date().toLocaleDateString("ar-LY")}</Badge>} />

      {/* مهام اليوم — لوحة موحّدة تجيب "ماذا أفعل الآن؟" بدل عرض أرقام فقط.
          كل بند مصدره ctx.notifications (نفس مصدر جرس التنبيهات) مع زر إجراء مباشر لكل بند. */}
      {tasks.length > 0 && (
        <div style={{ marginBottom: "1.1rem" }}>
          <div style={{ fontSize: T.font.sm, fontWeight: 700, color: C.mt, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
            ⚠️ يتطلب انتباهك اليوم ({tasks.length})
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {tasks.map(n => {
              const tn = TASK_TONE[n.tone] || TASK_TONE.b;
              return (
                <div key={n.id} onClick={() => go(n.page)} className="nk-card-hover"
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, background: tn.bg, border: `1px solid ${tn.border}`, borderRadius: 12, padding: ".7rem 1rem", cursor: "pointer" }}>
                  <div style={{ fontSize: T.font.sm, color: tn.ink, display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 18 }}>{n.icon}</span>
                    <span>{n.text}</span>
                  </div>
                  <Btn sm {...(tn.btn === "danger" ? { danger: true } : tn.btn === "gold" ? { gold: true } : {})}>متابعة →</Btn>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* شريط اليوم */}
      <div style={{ background: `linear-gradient(120deg, ${C.grn} 0%, ${C.grn2} 100%)`, borderRadius: 14, padding: "1rem 1.2rem", marginBottom: "1.1rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 11.5, color: C.gld, opacity: .85 }}>إيرادات اليوم</div>
          <div style={{ fontSize: T.font.numLg, fontWeight: 900, color: "#fff" }}>{fmt(todayRev)} <span style={{ fontSize: T.font.sm, fontWeight: 600, color: C.gld }}>{cur}</span></div>
        </div>
        <div style={{ display: "flex", gap: 22 }}>
          <div style={{ textAlign: "center" }}><div style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>{todayCount}</div><div style={{ fontSize: 10.5, color: C.gld, opacity: .85 }}>فواتير اليوم</div></div>
          <div style={{ textAlign: "center" }}><div style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>{completedBookings.length}</div><div style={{ fontSize: 10.5, color: C.gld, opacity: .85 }}>حجوزات</div></div>
          <div style={{ textAlign: "center" }}><div style={{ fontSize: 20, fontWeight: 800, color: low.length ? "#ffb4b4" : "#fff" }}>{low.length}</div><div style={{ fontSize: 10.5, color: C.gld, opacity: .85 }}>نواقص</div></div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 11, marginBottom: "1.1rem" }}>
        <KCard label="إجمالي الإيرادات" value={fmt(totals.revenue)} sub={cur} bar="#1a8c3e" />
        <KCard label="تكلفة البضاعة المباعة" value={fmt(totals.cogs)} sub={cur} bar="#c77" />
        <KCard label="إجمالي المصاريف" value={fmt(totals.expTotal)} sub={cur} bar={C.red} />
        <KCard label="صافي الربح" value={fmt(totals.profit)} sub={`${totals.revenue ? ((totals.profit / totals.revenue) * 100).toFixed(1) : 0}% هامش`} bar={C.gold} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: ctx.scr?.isTab ? "1fr" : "3fr 2fr", gap: 11, marginBottom: "1.1rem" }}>
        <Card className="nk-card-hover">
          <CardHead title="الإيراد اليومي — آخر 7 أيام" sub={cur} />
          <MiniBars data={last7.days} max={last7.max} color={C.grl} />
          <div style={{ display: "flex", justifyContent: "space-around", fontSize: 9.5, color: C.mt, marginTop: 4 }}>{last7.labels.map((m, i) => <span key={i}>{m}</span>)}</div>
        </Card>
        <Card className="nk-card-hover">
          <CardHead title="توزيع المبيعات" sub="حسب النشاط" />
          {dist.games + dist.cafe + dist.other === 0 ? (
            <div style={{ textAlign: "center", color: C.mt, fontSize: 12, padding: "1.5rem 0" }}>لا مبيعات بعد لعرض التوزيع</div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }}>
              <Donut segments={[{ v: dist.gPct, c: C.grl }, { v: Math.max(0, 100 - dist.gPct), c: C.gold }]} />
              <div style={{ fontSize: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: C.grl }} />ألعاب {dist.gPct}%</div>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: C.gold }} />كافيه/أخرى {100 - dist.gPct}%</div>
              </div>
            </div>
          )}
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(310px,1fr))", gap: 11 }}>
        <Card className="nk-card-hover">
          <CardHead title="أحدث الفواتير" right={<Btn sm onClick={() => go("sales")}>عرض الكل</Btn>} />
          {invoices.length === 0 ? <div style={{ color: C.mt, fontSize: 12, padding: "1rem 0", textAlign: "center" }}>لا فواتير بعد</div> :
            <Table cols={[{ h: "رقم", w: "28%" }, { h: "الزبون", w: "30%" }, { h: "المبلغ", w: "22%" }, { h: "الحالة", w: "20%" }]}
              rows={invoices.slice(0, 5).map(i => ["#" + i.id, i.customer, fmt(i.total) + " " + cur, <Badge tone={i.status === "مدفوعة" ? "g" : i.status === "ملغاة" ? "r" : "a"}>{i.status}</Badge>])} />}
        </Card>
        <Card className="nk-card-hover">
          <CardHead title="تنبيهات المخزون" sub={`${low.length} منتج تحت الحد الأدنى`} right={low.length > 0 && <Btn sm onClick={() => go("inventory")}>الطلب</Btn>} />
          {low.length === 0 && <div style={{ color: C.mt, fontSize: 12, padding: "1rem 0", textAlign: "center" }}>كل المنتجات ضمن المستوى الآمن ✓</div>}
          {low.slice(0, 6).map(p => {
            const pct = Math.min(100, Math.round((p.stock / (p.min * 2)) * 100));
            return <div key={p.id} style={{ marginBottom: ".7rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 2 }}><span>{p.name}</span><span style={{ color: C.red, fontWeight: 600 }}>{p.stock} متبقي</span></div>
              <div style={{ height: 6, borderRadius: 3, background: "#eee", overflow: "hidden" }}><div style={{ width: pct + "%", height: "100%", background: pct < 30 ? "#e34948" : C.gold }} /></div>
            </div>;
          })}
        </Card>
      </div>
    </>
  );
}

/* ============================ POS ============================ */
function POS({ ctx, can }) {
  const { products, setProducts, invoices, setInvoices, coupons, customers, setCustomers, employees, promotions, user, showToast, settings } = ctx;
  const cur = settings?.currency || "د.ل";
  const [cart, setCart] = useState({});
  const [pay, setPay] = useState("cash");
  const [coupon, setCoupon] = useState("");
  const [discPct, setDiscPct] = useState(0);
  const [catFilter, setCatFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [bcInput, setBcInput] = useState("");
  const bcRef = useRef(null);
  const [deferCustomer, setDeferCustomer] = useState(null);
  const [custModal, setCustModal] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [pointsCustomer, setPointsCustomer] = useState(null);
  const [redeemPoints, setRedeemPoints] = useState(false);
  const [deferEmployee, setDeferEmployee] = useState(null);

  const PAY_LABEL = { cash: "كاش", card: "بطاقة", transfer: "تحويل", defer: "آجل", employee: "موظف" };
  const shown = products.filter(p =>
    (catFilter === "all" || p.cat === catFilter) &&
    (search === "" || p.name.includes(search) || matchesBarcodePartial(p, search))
  );

  // إضافة صنف عبر الباركود (Enter أو قارئ باركود) — يطابق الباركود الأساسي أو أياً من الباركودات الإضافية لنفس المنتج
  const addByBarcode = () => {
    const code = bcInput.trim();
    if (!code) return;
    const p = products.find(x => matchesBarcode(x, code)) || products.find(x => matchesBarcodePartial(x, code));
    if (!p) { showToast(`لا يوجد صنف بالباركود «${code}»`); setBcInput(""); return; }
    add(p, "piece");
    setBcInput("");
    bcRef.current?.focus();
  };
  // piecesInCartFor: total pieces already reserved for a product across piece+pack lines
  const piecesReserved = (pid) => Object.values(cart).filter(it => it.pid === pid).reduce((s, it) => s + it.qty * it.perPieces, 0);
  const add = (p, sellUnit = "piece") => {
    if (!p.sell) { showToast(`«${p.name}» غير مُسعّر بعد — يُسعّر عند التوريد`); return; }
    const pack = p.packSize || 1;
    const perPieces = sellUnit === "pack" ? pack : 1;
    const key = p.id + ":" + sellUnit;
    const already = piecesReserved(p.id);
    if (p.stock !== null && p.stock < already + perPieces) { showToast(`لا يوجد مخزون كافٍ من «${p.name}»`); return; }
    const promo = promoFor(promotions, p.cat);
    const factor = promo ? 1 - promo.pct / 100 : 1;
    const baseUnitPrice = sellUnit === "pack" ? (p.sellPack || p.sell * pack) : p.sell;
    const unitPrice = Math.round(baseUnitPrice * factor * 100) / 100;
    const unitLabel = sellUnit === "pack" ? p.unit : "قطعة";
    setCart(c => ({ ...c, [key]: { key, pid: p.id, cat: p.cat, name: p.name, img: p.img, sell: p.sell, unitPrice, perPieces, sellUnit, unitLabel, promoPct: promo ? promo.pct : 0, qty: (c[key]?.qty || 0) + 1 } }));
  };
  const chg = (key, d) => setCart(c => {
    const q = (c[key]?.qty || 0) + d;
    const nc = { ...c };
    if (q <= 0) delete nc[key]; else nc[key] = { ...nc[key], qty: q };
    return nc;
  });
  const items = Object.values(cart);
  const isEmployeeSale = pay === "employee";
  const freeDepts = settings?.freeDeptsForEmployees || [];
  const isFreeItem = (it) => isEmployeeSale && freeDepts.includes(it.cat);
  const sub = items.reduce((s, i) => s + (isFreeItem(i) ? 0 : i.unitPrice * i.qty), 0);
  const freeValue = items.reduce((s, i) => s + (isFreeItem(i) ? i.unitPrice * i.qty : 0), 0);
  const disc = Math.round(sub * discPct / 100);
  const custForPoints = pay === "defer" ? deferCustomer : (pay === "employee" ? null : pointsCustomer);
  const redeemBlocks = (settings?.loyaltyOn && redeemPoints && custForPoints) ? Math.floor((custForPoints.points || 0) / 100) : 0;
  const pointsDiscount = Math.min(redeemBlocks * (settings?.pointsRedeemValue || 0), Math.max(0, sub - disc));
  const total = Math.max(0, sub - disc - pointsDiscount);

  const applyCoupon = () => {
    const c = coupons.find(x => x.code === coupon.trim().toUpperCase() && x.status === "نشط");
    if (c) { setDiscPct(c.pct); showToast(`كوبون ${c.code} مفعّل — خصم ${c.pct}%`); }
    else { setDiscPct(0); showToast("كود الخصم غير صحيح"); }
  };

  const checkout = () => {
    if (!items.length) return;
    const num = "INV-" + (1048 + invoices.filter(i => i.id.startsWith("INV-1")).length);
    const details = items.map(i => `${i.name} ×${i.qty} ${i.sellUnit === "pack" ? i.unitLabel : ""}`.trim()).join("، ");
    let custName = "زبون نقدي";

    if (pay === "defer") {
      if (!deferCustomer) { showToast("اختر زبوناً أو سجّل زبوناً جديداً للبيع الآجل"); return; }
      custName = deferCustomer.name;
      setCustomers(cs => cs.map(c => c.id === deferCustomer.id
        ? { ...c, debt: (c.debt || 0) + total, total: c.total + total, invoices: c.invoices + 1, last: todayISO() }
        : c));
    } else if (pay === "employee") {
      if (!deferEmployee) { showToast("اختر الموظف الذي يشتري"); return; }
      custName = deferEmployee.name;
    } else if (custForPoints) {
      custName = custForPoints.name;
    }

    // نقاط الولاء: استبدال (إن اختير) ثم اكتساب نقاط جديدة على قيمة البيع النهائية
    if (settings?.loyaltyOn && custForPoints) {
      const earned = Math.floor(total / (settings.pointsPerCurrency || 10));
      const redeemed = redeemBlocks * 100;
      setCustomers(cs => cs.map(c => c.id === custForPoints.id ? { ...c, points: Math.max(0, (c.points || 0) - redeemed + earned) } : c));
    }

    // decrement stock in pieces (sum piece+pack lines per product)
    setProducts(ps => ps.map(p => {
      const pieces = items.filter(it => it.pid === p.id).reduce((s, it) => s + it.qty * it.perPieces, 0);
      if (pieces && p.stock !== null) return { ...p, stock: Math.max(0, p.stock - pieces) };
      return p;
    }));
    // تكلفة البضاعة المباعة (COGS) = مجموع (سعر شراء القطعة × عدد القطع)
    const cost = items.reduce((s, it) => {
      const p = products.find(x => x.id === it.pid);
      return s + (p?.buy || 0) * it.qty * it.perPieces;
    }, 0);
    setInvoices(iv => [{ id: num, customer: custName, date: todayISO(), source: "منتج", details, items: items.map(it => ({ pid: it.pid, cat: it.cat, name: it.name, qty: it.qty, lineTotal: isFreeItem(it) ? 0 : Math.round(it.unitPrice * it.qty * 100) / 100, free: isFreeItem(it) || undefined })), pay: PAY_LABEL[pay], discount: [discPct ? discPct + "%" : "", pointsDiscount ? `نقاط -${fmt(pointsDiscount)}` : "", freeValue > 0 ? `مزايا مجانية -${fmt(freeValue)}` : ""].filter(Boolean).join(" + ") || "—", total, cost: Math.round(cost * 100) / 100, status: pay === "defer" ? "معلقة" : "مدفوعة", by: user?.name || "—", time: new Date().toTimeString().slice(0, 5), ...(pay === "defer" ? { dueDate: dueDate || todayISO() } : {}), ...(pay === "employee" ? { empId: deferEmployee.id } : {}) }, ...iv]);
    showToast(pay === "defer" ? `فاتورة آجلة #${num} على ${custName} — ${fmt(total)} ${ctx.settings?.currency || "د.ل"}` : pay === "employee" ? `فاتورة موظف #${num} على ${custName} — ${fmt(total)} ${cur}${freeValue > 0 ? ` (مزايا مجانية ${fmt(freeValue)} ${cur})` : ""}` : `تم إنشاء الفاتورة #${num} — ${fmt(total)} ${ctx.settings?.currency || "د.ل"}`);
    setCart({}); setDiscPct(0); setCoupon(""); setDeferCustomer(null); setDueDate(""); setPointsCustomer(null); setRedeemPoints(false); setDeferEmployee(null);
  };

  const CAT_ICON = { games: "🎮", cafe: "☕" };
  const mode = ctx.settings?.posMode || "grid";
  return (
    <>
      <PageTop title="نقطة البيع السريع" />
      <div style={{ display: "grid", gridTemplateColumns: ctx.scr?.isTab ? "1fr" : "1fr 360px", gap: 14, alignItems: "start" }}>
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: ".7rem", flexWrap: "wrap" }}>
            <div style={{ flex: 1.2, minWidth: 170, display: "flex", alignItems: "center", gap: 6, background: C.cd, border: `0.5px solid ${C.bc}`, borderRadius: 10, padding: ".42rem .75rem" }}>
              <span style={{ color: C.mt, fontSize: 14 }}>🔍</span>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث عن صنف بالاسم..." style={{ border: "none", outline: "none", background: "transparent", fontSize: 12.5, width: "100%", fontFamily: "inherit", color: C.ink }} />
              {search && <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: C.mt, fontSize: 13 }}>✕</button>}
            </div>
            <div style={{ flex: 1, minWidth: 190, display: "flex", alignItems: "center", gap: 6, background: C.grn, borderRadius: 10, padding: ".42rem .75rem", border: `1px solid ${C.gold}55` }}>
              <span style={{ fontSize: 14 }}>📷</span>
              <input ref={bcRef} value={bcInput} onChange={e => setBcInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addByBarcode()}
                placeholder="امسح الباركود أو اكتبه ثم Enter"
                style={{ border: "none", outline: "none", background: "transparent", fontSize: 12.5, width: "100%", fontFamily: "inherit", color: C.gld, letterSpacing: 1 }} />
              <button onClick={addByBarcode} style={{ background: C.gold, border: "none", borderRadius: 6, color: "#fff", fontSize: 11, fontWeight: 700, padding: "3px 10px", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>إضافة</button>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, marginBottom: ".9rem", flexWrap: "wrap" }}>
            {[["all", "الكل"], ...Object.entries(ctx.cats || CATS)].map(([k, l]) => (
              <button key={k} onClick={() => setCatFilter(k)} style={{ padding: ".3rem .8rem", borderRadius: 20, fontSize: 12, cursor: "pointer", fontFamily: "inherit", border: `0.5px solid ${C.bc}`, background: catFilter === k ? C.grn : C.crm, color: catFilter === k ? C.gld : C.k2, fontWeight: catFilter === k ? 600 : 400 }}>{l}</button>
            ))}
          </div>

          {shown.length === 0 && (
            <div style={{ textAlign: "center", padding: "2rem 1rem", color: C.mt, fontSize: 12.5, background: C.cd, borderRadius: 11, border: `0.5px dashed ${C.bc}` }}>لا توجد أصناف مطابقة{search ? ` لـ«${search}»` : ""}.</div>
          )}
          {mode === "grid" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(130px,1fr))", gap: 10 }}>
              {shown.map(p => {
                const promo = promoFor(promotions, p.cat);
                const dSell = promo && p.sell ? Math.round(p.sell * (1 - promo.pct / 100) * 100) / 100 : null;
                return (
                <div key={p.id} className="nk-card-hover" style={{ background: C.cd, border: `0.5px solid ${promo ? "#1a8c3e55" : C.bc}`, borderRadius: 11, padding: ".8rem .75rem", textAlign: "center", position: "relative" }}>
                  {promo && p.sell ? <span style={{ position: "absolute", top: 6, left: 6, background: "#1a8c3e", color: "#fff", fontSize: 9.5, fontWeight: 700, borderRadius: 6, padding: "1px 6px" }}>-{promo.pct}%</span> : null}
                  <div onClick={() => add(p, "piece")} style={{ cursor: "pointer" }}>
                    <div style={{ width: 46, height: 46, borderRadius: 12, margin: "0 auto .5rem", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, background: p.cat === "games" ? C.grl + "22" : C.gold + "22", overflow: "hidden" }}>{p.img ? <img src={p.img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : CAT_ICON[p.cat]}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>{p.name}</div>
                    {dSell !== null
                      ? <div style={{ fontSize: 13, fontWeight: 700 }}><span style={{ color: C.mt, textDecoration: "line-through", fontSize: 10.5, marginLeft: 4 }}>{p.sell}</span><span style={{ color: "#1a8c3e" }}>{dSell} {cur}</span></div>
                      : <div style={{ fontSize: 13, fontWeight: 700, color: C.grn2 }}>{p.sell ? `${p.sell} ${cur}` : "غير مُسعّر"}</div>}
                    <div style={{ fontSize: 10, color: C.mt, marginTop: 2 }}>{p.stock !== null ? `مخزون: ${p.stock} قطعة` : "خدمة"}</div>
                  </div>
                  {p.packSize > 1 && p.sell ? (
                    <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                      <button onClick={() => add(p, "piece")} style={posUnitBtn(false)}>قطعة</button>
                      <button onClick={() => add(p, "pack")} style={posUnitBtn(true)}>{p.unit} — {fmt(Math.round((p.sellPack || p.sell * p.packSize) * (promo ? 1 - promo.pct / 100 : 1) * 100) / 100)}</button>
                    </div>
                  ) : null}
                </div>
                );
              })}
            </div>
          )}
          {mode === "list" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {shown.map(p => (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, background: C.cd, border: `0.5px solid ${C.bc}`, borderRadius: 10, padding: ".55rem .8rem" }}>
                  <div onClick={() => add(p, "piece")} style={{ width: 36, height: 36, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, background: p.cat === "games" ? C.grl + "22" : C.gold + "22", flexShrink: 0, overflow: "hidden", cursor: "pointer" }}>{p.img ? <img src={p.img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : CAT_ICON[p.cat]}</div>
                  <div onClick={() => add(p, "piece")} style={{ flex: 1, cursor: "pointer" }}><div style={{ fontSize: 12.5, fontWeight: 600 }}>{p.name}</div><div style={{ fontSize: 10.5, color: C.mt }}>{CATS[p.cat]} · {p.stock !== null ? `مخزون ${p.stock} قطعة` : "خدمة"}</div></div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.grn2 }}>{p.sell ? `${p.sell} ${cur}` : "—"}</div>
                  {p.packSize > 1 && p.sell ? <button onClick={() => add(p, "pack")} style={posUnitBtn(true)}>{p.unit}</button> : null}
                  <button onClick={() => add(p, "piece")} style={posUnitBtn(false)}>قطعة</button>
                </div>
              ))}
            </div>
          )}
          {mode === "compact" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(105px,1fr))", gap: 6 }}>
              {shown.map(p => (
                <div key={p.id} onClick={() => add(p, "piece")} style={{ background: C.cd, border: `0.5px solid ${C.bc}`, borderRadius: 8, padding: ".45rem .5rem", cursor: "pointer", textAlign: "center" }}>
                  <div style={{ fontSize: 11.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.grn2, marginTop: 2 }}>{p.sell || "—"}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <Card style={{ position: "sticky", top: "1rem" }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: ".9rem" }}>🛍 سلة المبيعات</div>
          {!items.length && <div style={{ textAlign: "center", padding: "2rem 0", color: C.mt, fontSize: 12.5 }}>لا توجد منتجات بعد<br /><span style={{ fontSize: 11 }}>اضغط على منتج لإضافته</span></div>}
          {items.map(it => (
            <div key={it.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: ".5rem 0", borderBottom: "0.5px solid rgba(201,168,76,.12)" }}>
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.name} {it.sellUnit === "pack" && <Badge tone="gold" style={{ fontSize: 9 }}>{it.unitLabel}</Badge>} {it.promoPct ? <Badge tone="g" style={{ fontSize: 9 }}>-{it.promoPct}%</Badge> : null}</div><div style={{ fontSize: 11, color: C.mt }}>{it.unitPrice} × {it.qty} {it.sellUnit === "pack" ? `(${it.perPieces} قطعة)` : ""}</div></div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: C.grn2, minWidth: 50, textAlign: "left" }}>{fmt(it.unitPrice * it.qty)}</span>
                <button onClick={() => chg(it.key, -1)} style={qbtn}>−</button>
                <span style={{ fontSize: 12, fontWeight: 700, minWidth: 16, textAlign: "center" }}>{it.qty}</span>
                <button onClick={() => chg(it.key, 1)} style={qbtn}>+</button>
              </div>
            </div>
          ))}
          {items.length > 0 && (
            <div style={{ marginTop: ".75rem", borderTop: `1px solid ${C.bc}`, paddingTop: ".75rem" }}>
              <Row label="المجموع الفرعي" val={fmt(sub) + " د.ل"} />
              {disc > 0 && <Row label="الخصم" val={"-" + fmt(disc) + " د.ل"} color="#1a8c3e" />}
              {pointsDiscount > 0 && <Row label="🎁 خصم النقاط" val={"-" + fmt(pointsDiscount) + " د.ل"} color="#1a8c3e" />}
              {freeValue > 0 && <Row label="🎁 مزايا مجانية (موظف)" val={fmt(freeValue) + " د.ل"} color="#1a8c3e" />}
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 15, borderTop: `0.5px solid ${C.bc}`, marginTop: ".5rem", paddingTop: ".5rem" }}><span>الإجمالي</span><span style={{ color: C.grn2 }}>{fmt(total)} د.ل</span></div>
              {can("discounts") && (
                <div style={{ display: "flex", gap: 7, marginTop: ".7rem" }}>
                  <input value={coupon} onChange={e => setCoupon(e.target.value)} placeholder="كود الخصم" style={{ ...inputStyle, flex: 1 }} />
                  <Btn sm onClick={applyCoupon}>تطبيق</Btn>
                </div>
              )}
              <div style={{ fontSize: 11, color: C.mt, fontWeight: 600, margin: ".8rem 0 5px" }}>طريقة الدفع</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {[["cash", "كاش"], ["card", "بطاقة"], ["transfer", "تحويل مصرفي"], ["defer", "آجل — زبون"], ["employee", "آجل — موظف (يُخصم من راتبه)"]].map(([k, l]) => (
                  <div key={k} onClick={() => setPay(k)} style={{ gridColumn: (k === "defer" || k === "employee") ? "1/-1" : "auto", border: `1px solid ${pay === k ? C.gold : C.bc}`, borderRadius: 8, padding: ".45rem .6rem", cursor: "pointer", fontSize: 12, fontWeight: pay === k ? 600 : 500, background: pay === k ? "rgba(201,168,76,.12)" : C.crm, color: pay === k ? C.grn2 : C.k2, textAlign: "center" }}>{l}</div>
                ))}
              </div>
              {pay === "defer" && (
                <div style={{ marginTop: 8, background: C.gold + "10", border: `0.5px solid ${C.gold}55`, borderRadius: 10, padding: ".7rem" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.gdd, marginBottom: 6 }}>البيع الآجل يُسجّل على حساب زبون</div>
                  {deferCustomer ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: C.cd, borderRadius: 8, padding: ".5rem .7rem" }}>
                      <div><div style={{ fontSize: 12.5, fontWeight: 600 }}>{deferCustomer.name}</div><div style={{ fontSize: 10.5, color: C.mt }}>📱 {deferCustomer.phone}</div></div>
                      <button onClick={() => setDeferCustomer(null)} style={{ background: "none", border: "none", cursor: "pointer", color: C.mt, fontSize: 14 }}>تغيير</button>
                    </div>
                  ) : (
                    <>
                      <Sel value="" onChange={e => { const c = customers.find(x => x.id == e.target.value); if (c) setDeferCustomer(c); }} style={{ marginBottom: 6 }}>
                        <option value="">اختر من قائمة الزبائن...</option>
                        {customers.map(c => <option key={c.id} value={c.id}>{c.name} — {c.phone}</option>)}
                      </Sel>
                      <Btn sm onClick={() => setCustModal(true)} style={{ width: "100%", justifyContent: "center" }}>+ تسجيل زبون جديد</Btn>
                    </>
                  )}
                  {deferCustomer && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontSize: 10.5, color: C.mt, fontWeight: 600, marginBottom: 3 }}>تاريخ استحقاق السداد</div>
                      <Inp type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={{ background: C.cd }} />
                    </div>
                  )}
                </div>
              )}
              {pay === "employee" && (
                <div style={{ marginTop: 8, background: C.purpbg, border: `0.5px solid ${C.purp}55`, borderRadius: 10, padding: ".7rem" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.purp, marginBottom: 6 }}>يُخصم المبلغ تلقائياً من راتب الموظف — تُحتسب هذه العملية ضمن مبيعات وأرباح النادي فوراً</div>
                  {deferEmployee ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: C.cd, borderRadius: 8, padding: ".5rem .7rem" }}>
                      <div><div style={{ fontSize: 12.5, fontWeight: 600 }}>{deferEmployee.name}</div><div style={{ fontSize: 10.5, color: C.mt }}>راتب {fmt(deferEmployee.salary)} {cur}</div></div>
                      <button onClick={() => setDeferEmployee(null)} style={{ background: "none", border: "none", cursor: "pointer", color: C.mt, fontSize: 14 }}>تغيير</button>
                    </div>
                  ) : (
                    <Sel value="" onChange={e => { const emp = employees.find(x => x.id == e.target.value); if (emp) setDeferEmployee(emp); }}>
                      <option value="">اختر الموظف...</option>
                      {employees.filter(e => e.status === "نشط").map(e => <option key={e.id} value={e.id}>{e.name} — {e.role}</option>)}
                    </Sel>
                  )}
                  {freeValue > 0 && <div style={{ marginTop: 8, fontSize: 11, color: "#1a8c3e", fontWeight: 600, background: "#eaf6ee", borderRadius: 7, padding: ".4rem .6rem" }}>🎁 {fmt(freeValue)} {cur} من هذه السلة مجانية (أقسام معفاة) — لن تُخصم من راتبه</div>}
                </div>
              )}
              {settings?.loyaltyOn && pay !== "defer" && pay !== "employee" && (
                <div style={{ marginTop: 8, background: "#fff7eb", border: `0.5px solid ${C.gold}55`, borderRadius: 10, padding: ".7rem" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.gdd, marginBottom: 6 }}>🎁 اختر زبوناً لكسب نقاط الولاء (اختياري)</div>
                  {pointsCustomer ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: C.cd, borderRadius: 8, padding: ".5rem .7rem" }}>
                      <div><div style={{ fontSize: 12.5, fontWeight: 600 }}>{pointsCustomer.name}</div><div style={{ fontSize: 10.5, color: C.mt }}>🎁 {pointsCustomer.points || 0} نقطة</div></div>
                      <button onClick={() => { setPointsCustomer(null); setRedeemPoints(false); }} style={{ background: "none", border: "none", cursor: "pointer", color: C.mt, fontSize: 14 }}>إزالة</button>
                    </div>
                  ) : (
                    <Sel value="" onChange={e => { const c = customers.find(x => x.id == e.target.value); if (c) setPointsCustomer(c); }}>
                      <option value="">اختر من قائمة الزبائن...</option>
                      {customers.map(c => <option key={c.id} value={c.id}>{c.name} — {c.points || 0} نقطة</option>)}
                    </Sel>
                  )}
                </div>
              )}
              {settings?.loyaltyOn && custForPoints && Math.floor((custForPoints.points || 0) / 100) > 0 && (
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, marginTop: 8, cursor: "pointer", background: "rgba(26,140,62,.07)", borderRadius: 8, padding: ".5rem .7rem" }}>
                  <input type="checkbox" checked={redeemPoints} onChange={e => setRedeemPoints(e.target.checked)} />
                  استخدام {Math.floor((custForPoints.points || 0) / 100) * 100} نقطة = خصم {fmt(Math.floor((custForPoints.points || 0) / 100) * (settings.pointsRedeemValue || 0))} {cur}
                </label>
              )}
              <button onClick={checkout} style={{ width: "100%", marginTop: ".9rem", padding: ".65rem", fontSize: 14, fontWeight: 700, borderRadius: 10, cursor: "pointer", border: "none", background: "linear-gradient(135deg," + C.gold + "," + C.gdd + ")", color: "#fff", fontFamily: "inherit" }}>✓ إتمام البيع</button>
            </div>
          )}
        </Card>
      </div>
      {custModal && <NewCustomerModal ctx={ctx} onClose={() => setCustModal(false)} onCreated={(c) => { setDeferCustomer(c); setCustModal(false); }} />}
    </>
  );
}
const qbtn = { width: 22, height: 22, borderRadius: 6, border: `0.5px solid ${C.bc}`, background: C.crm, cursor: "pointer", fontSize: 13, fontFamily: "inherit" };
const posUnitBtn = (primary) => ({ flex: 1, padding: ".28rem .3rem", borderRadius: 6, fontSize: 10.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", border: `1px solid ${primary ? C.gold : C.bc}`, background: primary ? C.gold + "18" : C.crm, color: primary ? C.gdd : C.k2, whiteSpace: "nowrap" });
const Row = ({ label, val, color }) => <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: color || C.k2, marginBottom: ".4rem" }}><span>{label}</span><span>{val}</span></div>;

/* ============================ SALES ============================ */
function Sales({ ctx, can }) {
  const { invoices, setInvoices } = ctx;
  const cur = ctx.settings?.currency || "د.ل";
  const [q, setQ] = useState(() => (ctx.searchIntent && ctx.searchIntent.type === "invoice") ? ctx.searchIntent.query : "");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState(() => {
    if (ctx.searchIntent && ctx.searchIntent.type === "invoice") {
      return (ctx.invoices || []).find(i => i.id === ctx.searchIntent.id) || null;
    }
    return null;
  }); // الفاتورة المعروضة تفصيلياً
  useEffect(() => { if (ctx.searchIntent && ctx.searchIntent.type === "invoice") ctx.setSearchIntent(null); }, []);
  const PAGE_SIZE = 50;
  const PAY_TONE = { "كاش": "g", "بطاقة": "b", "تحويل": "p", "آجل": "a" };
  const SRC_TONE = { "منتج": "b", "حجز": "gold", "تأجير": "p", "رصيد سابق": "a" };
  const shown = invoices.filter(i =>
    (filter === "all" || i.status === filter) &&
    (i.customer.includes(q) || i.id.includes(q))
  );
  const totalPages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pageRows = shown.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);
  const monthSales = invoices.filter(i => i.status === "مدفوعة").reduce((s, i) => s + i.total, 0);
  const cancel = (id) => { if (!can("cancel")) return; setInvoices(iv => iv.map(i => i.id === id ? { ...i, status: "ملغاة" } : i)); setDetail(null); };
  const deleteInvoice = (id) => {
    if (!can("cancel")) return;
    if (!window.confirm("حذف هذه الفاتورة نهائياً من السجل؟\n\nهذا مختلف عن «الإلغاء» — الحذف يزيل الفاتورة تماماً ولا يمكن التراجع عنه، ولن تظهر بعدها في أي تقرير. استخدمه فقط لتصحيح خطأ إدخال حقيقي (كفاتورة مكرَّرة بالخطأ).")) return;
    setInvoices(iv => iv.filter(i => i.id !== id));
    DB.flush("invoices");
    ctx.showToast("تم حذف الفاتورة نهائياً");
    setDetail(null);
  };
  const printInvoice = (i) => {
    openPdfDoc(ctx.settings, {
      title: "فاتورة مبيعات", recipientLabel: "الزبون", recipientName: i.customer,
      docNo: i.id,
      columns: i.items && i.items.length ? ["الصنف", "القسم", "الكمية", "الإجمالي"] : ["التفاصيل"],
      rows: i.items && i.items.length ? i.items.map(it => [it.name, it.cat, it.qty, fmt(it.lineTotal) + " " + cur]) : [[i.details]],
      totals: [["طريقة الدفع", i.pay], ["الحالة", i.status], ["الإجمالي", fmt(i.total) + " " + cur]],
      note: `التاريخ: ${arDate(i.date)}${i.time ? " — " + i.time : ""} — بواسطة: ${i.by || "—"}`,
    });
  };
  return (
    <>
      <PageTop title="المبيعات والفواتير" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 11, marginBottom: "1.1rem" }}>
        <KCard label="إجمالي المبيعات" value={fmt(monthSales)} sub="دينار ليبي" bar="#1a8c3e" />
        <KCard label="عدد الفواتير" value={invoices.length} bar="#2a78d6" />
        <KCard label="متوسط الفاتورة" value={(() => { const paid = invoices.filter(i => i.status === "مدفوعة"); return paid.length ? fmt(Math.round(monthSales / paid.length)) : 0; })()} sub="د.ل" bar={C.gold} />
      </div>
      <Card>
        <CardHead title="سجل الفواتير" sub={`الفواتير من الحجوزات تظهر بعلامة (حجز) — ${fmt(shown.length)} فاتورة مطابقة — اضغط أي صف لعرض التفاصيل`} right={
          <div style={{ display: "flex", gap: 7 }}>
            <input value={q} onChange={e => { setQ(e.target.value); setPage(1); }} placeholder="بحث..." style={{ ...inputStyle, width: 150 }} />
            <Sel value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }} style={{ width: 110 }}>
              <option value="all">كل الحالات</option><option value="مدفوعة">مدفوعة</option><option value="معلقة">معلقة</option><option value="ملغاة">ملغاة</option>
            </Sel>
          </div>
        } />
        <Table cols={[{ h: "رقم", w: "13%" }, { h: "الزبون", w: "16%" }, { h: "التاريخ", w: "12%" }, { h: "المصدر", w: "11%" }, { h: "التفاصيل", w: "16%" }, { h: "الدفع", w: "10%" }, { h: "الإجمالي", w: "11%" }, { h: "الحالة", w: "11%" }]}
          rows={pageRows.map(i => [
            <span onClick={() => setDetail(i)} style={{ cursor: "pointer", fontWeight: 600, color: C.blue }}>#{i.id}</span>,
            <span onClick={() => setDetail(i)} style={{ cursor: "pointer" }}>{i.customer}</span>,
            arDate(i.date),
            <Badge tone={SRC_TONE[i.source] || "b"}>{i.source}</Badge>,
            <span onClick={() => setDetail(i)} style={{ cursor: "pointer" }}>{i.details}</span>,
            <Badge tone={PAY_TONE[i.pay] || "g"}>{i.pay}</Badge>,
            fmt(i.total) + " د.ل",
            <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <Badge tone={i.status === "مدفوعة" ? "g" : i.status === "ملغاة" ? "r" : "a"}>{i.status}</Badge>
              <button onClick={() => setDetail(i)} title="عرض التفاصيل" style={{ background: "none", border: "none", cursor: "pointer", color: C.blue, fontSize: 13 }}>👁</button>
            </span>,
          ])} />
        {shown.length === 0 && <div style={{ textAlign: "center", color: C.mt, fontSize: 12.5, padding: "1.5rem" }}>لا فواتير مطابقة</div>}
        {totalPages > 1 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 12, paddingTop: 10, borderTop: `0.5px solid ${C.bc}` }}>
            <Btn sm onClick={() => setPage(p => Math.max(1, p - 1))} style={{ opacity: pageSafe === 1 ? .4 : 1 }}>‹ السابق</Btn>
            <span style={{ fontSize: 12, color: C.mt }}>صفحة {pageSafe} من {totalPages}</span>
            <Btn sm onClick={() => setPage(p => Math.min(totalPages, p + 1))} style={{ opacity: pageSafe === totalPages ? .4 : 1 }}>التالي ›</Btn>
          </div>
        )}
      </Card>

      {/* نافذة تفاصيل الفاتورة */}
      {detail && (
        <Modal title={`فاتورة #${detail.id}`} onClose={() => setDetail(null)} width={560}>
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
            <div><div style={{ fontSize: 11, color: C.mt }}>الزبون</div><div style={{ fontSize: 14, fontWeight: 700 }}>{detail.customer}</div></div>
            <div><div style={{ fontSize: 11, color: C.mt }}>التاريخ</div><div style={{ fontSize: 14, fontWeight: 700 }}>{arDate(detail.date)}{detail.time ? " — " + detail.time : ""}</div></div>
            <div><div style={{ fontSize: 11, color: C.mt }}>الحالة</div><Badge tone={detail.status === "مدفوعة" ? "g" : detail.status === "ملغاة" ? "r" : "a"}>{detail.status}</Badge></div>
          </div>

          {detail.items && detail.items.length > 0 ? (
            <Table cols={[{ h: "الصنف", w: "45%" }, { h: "القسم", w: "20%" }, { h: "الكمية", w: "15%" }, { h: "الإجمالي", w: "20%" }]}
              rows={detail.items.map(it => [it.name, it.cat, it.qty, fmt(it.lineTotal) + " " + cur])} />
          ) : (
            <div style={{ background: C.crm, borderRadius: 8, padding: ".7rem .9rem", fontSize: 13, marginBottom: 10 }}>{detail.details}</div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14, background: C.crm, borderRadius: 10, padding: ".8rem 1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}><span style={{ color: C.mt }}>المصدر</span><Badge tone={SRC_TONE[detail.source] || "b"}>{detail.source}</Badge></div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}><span style={{ color: C.mt }}>طريقة الدفع</span><Badge tone={PAY_TONE[detail.pay] || "g"}>{detail.pay}</Badge></div>
            {detail.discount && detail.discount !== "—" && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}><span style={{ color: C.mt }}>الخصم</span><span>{detail.discount}</span></div>}
            {detail.dueDate && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}><span style={{ color: C.mt }}>تاريخ الاستحقاق</span><span>{arDate(detail.dueDate)}</span></div>}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}><span style={{ color: C.mt }}>بواسطة</span><span>{detail.by || "—"}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 800, gridColumn: "1/-1", borderTop: `0.5px solid ${C.bc}`, paddingTop: 8, marginTop: 4 }}><span>الإجمالي</span><span style={{ color: C.grn2 }}>{fmt(detail.total)} {cur}</span></div>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
            <Btn gold onClick={() => printInvoice(detail)}>🖨 طباعة</Btn>
            {can("cancel") && detail.status !== "ملغاة" && <Btn onClick={() => cancel(detail.id)}>✕ إلغاء الفاتورة</Btn>}
            {can("cancel") && <Btn danger onClick={() => deleteInvoice(detail.id)}>🗑 حذف نهائياً</Btn>}
          </div>
        </Modal>
      )}
    </>
  );
}

/* ============================ PRODUCTS ============================ */
function genBarcode(products) {
  const year = new Date().getFullYear();
  return "NKH" + year + String(products.length + 1).padStart(4, "0");
}
function BarcodeSVG({ code }) {
  if (!code) return null;
  let x = 4; const bars = [];
  for (let i = 0; i < code.length; i++) {
    const cc = code.charCodeAt(i);
    const w1 = (cc % 3) + 1, w2 = ((cc >> 2) % 3) + 1, w3 = ((cc >> 4) % 2) + 1;
    bars.push(<rect key={i + "a"} x={x} y={2} width={w1} height={32} fill="#fff" />); x += w1 + 1;
    bars.push(<rect key={i + "b"} x={x} y={2} width={w2} height={32} fill="#fff" />); x += w2 + 2;
    bars.push(<rect key={i + "c"} x={x} y={2} width={w3} height={32} fill="#fff" />); x += w3 + 1;
  }
  return (
    <div style={{ background: "#111", borderRadius: 7, padding: ".5rem", textAlign: "center" }}>
      <svg viewBox={`0 0 ${x + 4} 36`} style={{ height: 34, width: "100%" }}><rect x="0" y="0" width={x + 4} height="36" fill="#111" />{bars}</svg>
      <div style={{ color: "#fff", fontFamily: "monospace", fontSize: 11, letterSpacing: 2, marginTop: 2 }}>{code}</div>
    </div>
  );
}
function Products({ ctx, can }) {
  const { products, setProducts, waste, setWaste, user, showToast, settings, cats, setCats } = ctx;
  const cur = settings?.currency || "د.ل";
  const [modal, setModal] = useState(false);
  const [editingId, setEditingId] = useState(null); // null = add mode
  const [filter, setFilter] = useState("");
  const [q, setQ] = useState(() => (ctx.searchIntent && ctx.searchIntent.type === "product") ? ctx.searchIntent.query : "");
  useEffect(() => { if (ctx.searchIntent && ctx.searchIntent.type === "product") ctx.setSearchIntent(null); }, []);
  const [wasteItem, setWasteItem] = useState(null); // منتج قيد تسجيل الإتلاف
  const [wasteForm, setWasteForm] = useState({ qty: 1, reason: "سكب / انسكاب", note: "", date: todayISO() });
  const WASTE_REASONS = ["سكب / انسكاب", "تسريب عبوة", "كسر", "انتهاء الصلاحية", "تلف بالتخزين", "أخرى"];
  const applyWaste = () => {
    if (!wasteItem) return;
    const qty = Math.min(wasteItem.stock, Math.max(1, parseInt(wasteForm.qty) || 1));
    const cost = Math.round((wasteItem.buy || 0) * qty * 100) / 100;
    setProducts(ps => ps.map(p => p.id === wasteItem.id ? { ...p, stock: Math.max(0, p.stock - qty) } : p));
    setWaste(w => [{ id: "WS-" + Date.now(), date: wasteForm.date, pid: wasteItem.id, name: wasteItem.name, cat: wasteItem.cat, qty, reason: wasteForm.reason, note: wasteForm.note.trim(), cost, by: user?.name || "—" }, ...w]);
    showToast(`تم تسجيل إتلاف ${qty} ${wasteItem.unit} من «${wasteItem.name}» — خسارة ${fmt(cost)} ${cur}`);
    setWasteItem(null); setWasteForm({ qty: 1, reason: "سكب / انسكاب", note: "", date: todayISO() });
  };
  const empty = { bc: "", extraBc: "", name: "", cat: "", newCat: "", unit: "علبة", packSize: "", min: "", hasExp: "no", supplier: "", status: "active", img: null, sell: "", sellPack: "" };
  const [form, setForm] = useState(empty);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const PACK_UNITS = ["صندوق", "كرتون", "كيس", "علبة"];
  const isPack = PACK_UNITS.includes(form.unit);
  const isEdit = editingId !== null;

  const shown = products.filter(p =>
    (!filter || p.cat === filter) && (p.name.includes(q) || matchesBarcodePartial(p, q))
  );
  const lowCount = products.filter(p => p.stock !== null && p.min && p.stock < p.min).length;
  const stockValue = products.reduce((s, p) => s + (p.buy || 0) * (p.stock || 0), 0);

  const openAdd = () => { setEditingId(null); setForm(empty); setModal(true); };
  const openEdit = (p) => {
    setEditingId(p.id);
    setForm({
      bc: p.bc, extraBc: (p.barcodes || []).join(", "), name: p.name, cat: p.cat, newCat: "", unit: p.unit, packSize: p.packSize > 1 ? String(p.packSize) : "",
      min: p.min ? String(p.min) : "", hasExp: p.hasExp ? "yes" : "no", supplier: p.supplier || "", status: p.status,
      img: p.img || null, sell: p.sell ? String(p.sell) : "", sellPack: p.sellPack ? String(p.sellPack) : "",
    });
    setModal(true);
  };

  const resolveCat = () => {
    if (form.cat !== "__new") return form.cat;
    const name = form.newCat.trim();
    if (!name) return null;
    // create key and register
    const key = "cat_" + Date.now().toString().slice(-6);
    setCats(cs => ({ ...cs, [key]: name }));
    CATS[key] = name; // immediate availability
    return key;
  };

  const save = () => {
    if (!form.name.trim() || !form.cat) { showToast("أدخل اسم المنتج والقسم"); return; }
    if (form.cat === "__new" && !form.newCat.trim()) { showToast("أدخل اسم القسم الجديد"); return; }
    if (isPack && form.packSize && parseInt(form.packSize) < 1) { showToast("عدد القطع في العبوة يجب أن يكون 1 أو أكثر"); return; }
    const cat = resolveCat();
    if (!cat) { showToast("أدخل اسم القسم الجديد"); return; }
    const packSize = isPack ? (parseInt(form.packSize) || 1) : 1;
    const isService = form.unit === "ساعة" || form.unit === "جلسة" || form.unit === "كود رقمي";

    // باركودات إضافية (نكهات/أنواع لنفس المنتج بنفس السعر) — مفصولة بفواصل
    const extraBarcodes = (form.extraBc || "").split(",").map(b => b.trim()).filter(Boolean);
    const allCodesEntered = [form.bc.trim(), ...extraBarcodes].filter(Boolean);
    const conflict = products.find(p => p.id !== editingId && allCodesEntered.some(c => productBarcodes(p).includes(c)));
    if (conflict) { showToast(`الباركود مستخدم بالفعل في المنتج «${conflict.name}»`); return; }

    if (isEdit) {
      const oldP = products.find(p => p.id === editingId);
      const newSell = parseFloat(form.sell) || 0;
      setProducts(ps => ps.map(p => p.id === editingId ? {
        ...p,
        bc: form.bc.trim() || p.bc, barcodes: extraBarcodes, name: form.name.trim(), cat, unit: form.unit, packSize,
        min: parseInt(form.min) || 0, hasExp: form.hasExp === "yes",
        supplier: form.supplier, status: form.status, img: form.img,
        sell: parseFloat(form.sell) || 0,
        sellPack: parseFloat(form.sellPack) || 0,
      } : p));
      if (oldP && oldP.sell !== newSell) {
        ctx.setAuditLog(al => [{ id: "AU-" + Date.now(), date: todayISO(), by: user?.name || "—", type: "تعديل سعر", detail: `${form.name.trim()}: ${fmt(oldP.sell)} ← ${fmt(newSell)} ${cur}` }, ...al]);
      }
      showToast(`تم تحديث «${form.name.trim()}»`);
    } else {
      const bc = form.bc.trim() || genBarcode(products);
      setProducts(ps => [...ps, {
        id: Math.max(0, ...ps.map(x => x.id)) + 1, bc, barcodes: extraBarcodes, name: form.name.trim(), cat, unit: form.unit,
        packSize, sell: 0, sellPack: 0, buy: 0,
        stock: isService ? null : 0, min: parseInt(form.min) || 0,
        hasExp: form.hasExp === "yes", exp: null,
        supplier: form.supplier, status: form.status, img: form.img,
      }]);
      showToast(`تمت إضافة المنتج «${form.name.trim()}» — يُسعّر عند أول توريد`);
    }
    DB.flush("products"); DB.flush("auditLog"); // حفظ فوري — لا ننتظر التأجيل المعتاد لعملية مهمة كإضافة/تعديل منتج
    setForm(empty); setModal(false); setEditingId(null);
  };

  const STATUS = { active: ["نشط", "g"], limited: ["محدود", "a"], inactive: ["غير نشط", "r"] };
  const imgRef = useRef(null);
  const onImg = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 700000) { showToast("حجم الصورة كبير — اختر أصغر من 700KB"); return; }
    const reader = new FileReader();
    reader.onload = () => set("img", reader.result);
    reader.readAsDataURL(file);
  };

  return (
    <>
      <PageTop title="إدارة المنتجات" action={can("inventory") && <Btn gold onClick={openAdd}>+ إضافة منتج</Btn>} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 11, marginBottom: "1.1rem" }}>
        <KCard label="إجمالي المنتجات" value={products.length} sub="منتج" bar={C.grl} />
        <KCard label="مخزون منخفض" value={lowCount} sub="تحتاج تزويد" bar={C.red} />
        <KCard label="قيمة المخزون" value={fmt(stockValue)} sub={cur} bar={C.gold} />
      </div>
      <Card>
        <CardHead title="قائمة المنتجات" sub="اضغط «تعديل» لتغيير البيانات أو الأسعار أو الصورة" right={
          <div style={{ display: "flex", gap: 7 }}>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="بحث بالاسم أو الباركود..." style={{ ...inputStyle, width: 170 }} />
            <Sel value={filter} onChange={e => setFilter(e.target.value)} style={{ width: 130 }}><option value="">كل الأقسام</option>{Object.entries(cats).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Sel>
          </div>
        } />
        <Table cols={[{ h: "الباركود", w: "11%" }, { h: "الاسم", w: "19%" }, { h: "القسم", w: "10%" }, { h: "العبوة", w: "10%" }, { h: "بيع/قطعة", w: "8%" }, { h: "بيع/عبوة", w: "8%" }, { h: "شراء/قطعة", w: "8%" }, { h: "المخزون", w: "8%" }, { h: "الصلاحية", w: "8%" }, { h: "إجراءات", w: "10%" }]}
          rows={shown.map(p => [
            <span><span style={{ fontFamily: "monospace", fontSize: 11, background: C.crm, padding: "2px 6px", borderRadius: 5 }}>{p.bc}</span>{p.barcodes && p.barcodes.length > 0 && <span title={p.barcodes.join(", ")} style={{ fontSize: 9.5, background: C.gold + "22", color: C.gdd, padding: "2px 5px", borderRadius: 5, marginRight: 4, fontWeight: 700 }}>+{p.barcodes.length}</span>}</span>,
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>{p.img ? <img src={p.img} alt="" style={{ width: 26, height: 26, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} /> : <span style={{ width: 26, height: 26, borderRadius: 6, background: C.crm, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>{p.cat === "games" ? "🎮" : "☕"}</span>}<span style={{ fontWeight: 600 }}>{p.name}</span></span>,
            <Badge tone={p.cat === "games" ? "g" : "a"}>{CATS[p.cat] || p.cat}</Badge>,
            <span>{p.unit}{p.packSize > 1 ? <span style={{ fontSize: 10, color: C.mt }}> (×{p.packSize})</span> : ""}</span>,
            p.sell ? <span style={{ fontWeight: 600, color: C.grn2 }}>{p.sell} {cur}</span> : <span style={{ color: C.mt, fontSize: 11 }}>لم يُسعّر</span>,
            p.packSize > 1 ? (p.sellPack ? <span style={{ fontWeight: 600, color: C.gdd }}>{p.sellPack} {cur}</span> : <span style={{ color: C.mt, fontSize: 11 }}>{p.sell ? fmt(p.sell * p.packSize) + " " + cur : "—"}</span>) : "—",
            p.buy ? p.buy + " " + cur : "—",
            p.stock !== null ? <span style={{ color: p.min && p.stock < p.min ? C.red : C.k2, fontWeight: p.min && p.stock < p.min ? 600 : 400 }}>{p.stock}</span> : "خدمة",
            <span style={{ fontSize: 11 }}>{p.hasExp ? arDate(p.exp) : "—"}</span>,
            can("inventory") ? (
              <div style={{ display: "flex", gap: 4 }}>
                <Btn sm onClick={() => openEdit(p)}>✎ تعديل</Btn>
                {p.stock !== null && <Btn sm danger onClick={() => { setWasteItem(p); setWasteForm({ qty: 1, reason: "سكب / انسكاب", note: "", date: todayISO() }); }}>🗑 إتلاف</Btn>}
              </div>
            ) : "—",
          ])} />
      </Card>

      {wasteItem && (
        <Modal title={`تسجيل إتلاف — ${wasteItem.name}`} onClose={() => setWasteItem(null)} width={440}>
          <div style={{ fontSize: 12, color: C.mt, marginBottom: 12, background: C.crm, borderRadius: 8, padding: ".55rem .8rem" }}>المتوفر حالياً: <b>{wasteItem.stock} {wasteItem.unit}</b> — سعر الشراء: <b>{fmt(wasteItem.buy || 0)} {cur}</b> / {wasteItem.unit}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label={"الكمية التالفة (" + wasteItem.unit + ")"}><Inp type="number" min="1" max={wasteItem.stock} value={wasteForm.qty} onChange={e => setWasteForm({ ...wasteForm, qty: e.target.value })} /></Field>
            <Field label="التاريخ"><Inp type="date" value={wasteForm.date} onChange={e => setWasteForm({ ...wasteForm, date: e.target.value })} /></Field>
            <Field label="السبب" full><Sel value={wasteForm.reason} onChange={e => setWasteForm({ ...wasteForm, reason: e.target.value })}>{WASTE_REASONS.map(r => <option key={r}>{r}</option>)}</Sel></Field>
            <Field label="ملاحظة (اختياري)" full><Inp value={wasteForm.note} onChange={e => setWasteForm({ ...wasteForm, note: e.target.value })} placeholder="مثال: سقط كوب أثناء التقديم" /></Field>
          </div>
          <div style={{ background: "#fdeaea", border: "0.5px solid rgba(192,57,43,.25)", borderRadius: 9, padding: ".6rem .85rem", margin: ".4rem 0 1rem", fontSize: 12.5, display: "flex", justifyContent: "space-between" }}>
            <span>الخسارة المقدّرة</span><b style={{ color: C.red }}>{fmt(Math.round((wasteItem.buy || 0) * (Math.max(1, parseInt(wasteForm.qty) || 1)) * 100) / 100)} {cur}</b>
          </div>
          <div style={{ display: "flex", gap: 8 }}><Btn danger onClick={applyWaste} style={{ flex: 1, justifyContent: "center" }}>🗑 تأكيد الإتلاف وخصمه من المخزون</Btn><Btn onClick={() => setWasteItem(null)}>إلغاء</Btn></div>
        </Modal>
      )}

      {modal && (
        <Modal title={isEdit ? `تعديل منتج — ${form.name || ""}` : "إضافة منتج جديد"} onClose={() => { setModal(false); setEditingId(null); }}>
          <div style={{ display: "flex", gap: 7, alignItems: "flex-end", marginBottom: ".75rem" }}>
            <div style={{ flex: 1 }}><Field label="رقم المنتج / الباركود"><Inp value={form.bc} onChange={e => set("bc", e.target.value)} placeholder="يُولّد تلقائياً إن تُرك فارغاً" /></Field></div>
            {!isEdit && <Btn onClick={() => set("bc", genBarcode(products))} style={{ marginBottom: ".75rem", background: C.grn, color: C.gld, border: "none" }}>توليد</Btn>}
          </div>
          {form.bc && <div style={{ marginBottom: ".75rem" }}><BarcodeSVG code={form.bc} /></div>}
          <Field label="باركودات إضافية لنفس المنتج (اختياري)" full>
            <Inp value={form.extraBc} onChange={e => set("extraBc", e.target.value)} placeholder="مثال: نكهة عنب، نكهة مانجا — افصل بينها بفاصلة ," />
          </Field>
          <div style={{ fontSize: 10.5, color: C.mt, marginTop: -6, marginBottom: ".75rem", lineHeight: 1.7 }}>💡 لمنتج له عدة أنواع/نكهات بنفس السعر (كعصير بأنواع عنب/مانجا/برتقال) — أدخل باركود كل نوع هنا مفصولاً بفاصلة، وسيتعرّف عليها الماسح جميعاً كصنف واحد بنفس السعر والمخزون.</div>
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: ".75rem", background: C.crm, borderRadius: 10, padding: ".7rem .85rem" }}>
            <div style={{ width: 64, height: 64, borderRadius: 12, background: C.cd, border: `1px dashed ${C.gold}`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
              {form.img ? <img src={form.img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 24, color: C.mt }}>🖼</span>}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>صورة المنتج {isEdit ? "(يمكن تغييرها)" : "(اختياري)"}</div>
              <input ref={imgRef} type="file" accept="image/*" onChange={onImg} style={{ display: "none" }} />
              <div style={{ display: "flex", gap: 6 }}>
                <Btn sm gold onClick={() => imgRef.current?.click()}>📤 {form.img ? "تغيير الصورة" : "رفع صورة"}</Btn>
                {form.img && <Btn sm onClick={() => set("img", null)}>إزالة</Btn>}
              </div>
              <div style={{ fontSize: 10, color: C.mt, marginTop: 4 }}>تظهر في الكتالوج ونقطة البيع — أقل من 700KB</div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="اسم المنتج *" full><Inp value={form.name} onChange={e => set("name", e.target.value)} placeholder="مثال: Red Bull" /></Field>
            <Field label="القسم *">
              <Sel value={form.cat} onChange={e => set("cat", e.target.value)}>
                <option value="">اختر...</option>
                {Object.entries(cats).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                <option value="__new">➕ إضافة قسم جديد...</option>
              </Sel>
            </Field>
            {form.cat === "__new" && <Field label="اسم القسم الجديد *"><Inp value={form.newCat} onChange={e => set("newCat", e.target.value)} placeholder="مثال: مشروبات ساخنة" /></Field>}
            <Field label="الوحدة / العبوة"><Sel value={form.unit} onChange={e => set("unit", e.target.value)}>{["علبة", "قطعة", "كود رقمي", "صندوق", "كرتون", "كيس", "وجبة", "ساعة", "جلسة", "زجاجة", "كوب"].map(u => <option key={u}>{u}</option>)}</Sel></Field>
            {isPack && <Field label={`عدد القطع في ${form.unit} *`}><Inp type="number" value={form.packSize} onChange={e => set("packSize", e.target.value)} placeholder="مثال: 24" min="1" /></Field>}
            <Field label="الحد الأدنى للتنبيه (بالقطعة)"><Inp type="number" value={form.min} onChange={e => set("min", e.target.value)} /></Field>
            <Field label="له تاريخ صلاحية؟"><Sel value={form.hasExp} onChange={e => set("hasExp", e.target.value)}><option value="no">لا</option><option value="yes">نعم</option></Sel></Field>
            <Field label="المورد الافتراضي"><Sel value={form.supplier} onChange={e => set("supplier", e.target.value)}><option value="">بدون</option>{ctx.suppliers.map(s => <option key={s.id}>{s.name}</option>)}</Sel></Field>
            <Field label="الحالة"><Sel value={form.status} onChange={e => set("status", e.target.value)}><option value="active">نشط</option><option value="limited">محدود</option><option value="inactive">غير نشط</option></Sel></Field>
          </div>
          {isEdit && (
            <div style={{ background: C.gold + "10", border: `0.5px solid ${C.gold}55`, borderRadius: 10, padding: ".7rem .85rem", margin: ".5rem 0" }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: C.gdd, marginBottom: 8 }}>💰 تعديل أسعار البيع الحالية</div>
              <div style={{ display: "grid", gridTemplateColumns: isPack ? "1fr 1fr" : "1fr", gap: 10 }}>
                <Field label={`سعر بيع القطعة (${cur})`}><Inp type="number" value={form.sell} onChange={e => set("sell", e.target.value)} placeholder="0" /></Field>
                {isPack && <Field label={`سعر بيع ${form.unit} (${cur})`}><Inp type="number" value={form.sellPack} onChange={e => set("sellPack", e.target.value)} placeholder={form.sell ? fmt(form.sell * (parseInt(form.packSize) || 1)) : "0"} /></Field>}
              </div>
              {isPack && form.sell && form.packSize && <div style={{ fontSize: 11, color: C.mt }}>سعر {form.unit} المحسوب من القطع: {fmt(form.sell * (parseInt(form.packSize) || 1))} {cur}{form.sellPack ? ` — السعر المخصص: ${form.sellPack} ${cur}` : ""}</div>}
            </div>
          )}
          {isPack && form.packSize > 1 && !isEdit && <div style={{ background: C.bluebg, border: `0.5px solid ${C.blue}33`, borderRadius: 8, padding: ".55rem .8rem", margin: ".5rem 0", fontSize: 12, color: C.blue }}>📦 كل {form.unit} = <b>{form.packSize} قطعة</b> — سيُحسب المخزون بالقطع تلقائياً عند التوريد</div>}
          {!isEdit && <div style={{ background: C.gold + "12", border: `0.5px solid ${C.gold}44`, borderRadius: 8, padding: ".6rem .8rem", margin: ".5rem 0", fontSize: 11.5, color: C.gdd, display: "flex", gap: 7 }}><span>💡</span><span>أسعار الشراء والبيع وتاريخ الصلاحية تُحدَّد عند توريد المنتج من قسم <b>المشتريات</b> — هنا تُعرّف المنتج في الكتالوج فقط.</span></div>}
          <div style={{ display: "flex", gap: 8, marginTop: ".5rem" }}><Btn gold onClick={save} style={{ flex: 1, justifyContent: "center" }}>✓ {isEdit ? "حفظ التعديلات" : "حفظ المنتج"}</Btn><Btn onClick={() => { setModal(false); setEditingId(null); }}>إلغاء</Btn></div>
        </Modal>
      )}
    </>
  );
}

/* ============================ PURCHASES ============================ */
function Purchases({ ctx }) {
  const { products, setProducts, purchases, setPurchases, suppliers, setSuppliers, user, showToast } = ctx;
  const [modal, setModal] = useState(false);
  const [supplier, setSupplier] = useState("");
  const [newSupModal, setNewSupModal] = useState(false);
  const [newSup, setNewSup] = useState({ name: "", phone: "", spec: "" });
  const [date, setDate] = useState(todayISO());
  const [pay, setPay] = useState("كاش");
  // each line: prodId, qty, qtyUnit ('pack'|'piece'), buyBasis ('pack'|'piece'), buyPrice, sellPiece, sellPack, exp
  const emptyLine = { prodId: "", qty: 1, qtyUnit: "pack", buyBasis: "pack", buyPrice: "", sellPiece: "", sellPack: "", exp: "" };
  const [lines, setLines] = useState([{ ...emptyLine }]);
  const cur = ctx.settings?.currency || "د.ل";

  const prodOf = (id) => products.find(x => x.id == id);

  const addLine = () => setLines(l => [...l, { ...emptyLine }]);
  const setLine = (i, k, v) => setLines(l => l.map((ln, idx) => {
    if (idx !== i) return ln;
    const nl = { ...ln, [k]: v };
    if (k === "prodId") {
      const p = prodOf(v);
      if (p) {
        const pack = p.packSize || 1;
        nl.qtyUnit = pack > 1 ? "pack" : "piece";
        nl.buyBasis = pack > 1 ? "pack" : "piece";
        nl.buyPrice = p.buy ? (pack > 1 ? String(p.buy * pack) : String(p.buy)) : "";
        nl.sellPiece = p.sell ? String(p.sell) : "";
        nl.sellPack = p.sellPack ? String(p.sellPack) : (p.sell && pack > 1 ? String(p.sell * pack) : "");
      }
    }
    return nl;
  }));
  const delLine = (i) => setLines(l => l.filter((_, idx) => idx !== i));

  // pieces added by a line (qty may be in packs or pieces)
  const piecesOf = (ln) => {
    const p = prodOf(ln.prodId);
    if (!p) return 0;
    const pack = p.packSize || 1;
    return ln.qtyUnit === "pack" ? ln.qty * pack : ln.qty;
  };
  // buy cost per single piece
  const buyPieceOf = (ln) => {
    const p = prodOf(ln.prodId);
    if (!p) return 0;
    const pack = p.packSize || 1;
    const bp = parseFloat(ln.buyPrice) || 0;
    return ln.buyBasis === "pack" ? bp / pack : bp;
  };
  const lineCost = (ln) => piecesOf(ln) * buyPieceOf(ln);
  const grand = lines.reduce((s, l) => s + lineCost(l), 0);

  const monthPurch = purchases.reduce((s, p) => s + p.total, 0);
  const dueTotal = suppliers.reduce((s, x) => s + x.due, 0);

  const save = () => {
    const valid = lines.filter(l => l.prodId && l.qty > 0);
    if (!supplier) { showToast("اختر المورد"); return; }
    if (!valid.length) { showToast("أضف منتجاً واحداً على الأقل"); return; }
    const num = "PO-" + (235 + purchases.filter(p => p.id.startsWith("PO-")).length);
    const itemsStr = valid.map(l => {
      const p = prodOf(l.prodId);
      const unitLbl = l.qtyUnit === "pack" && p?.packSize > 1 ? p.unit : "قطعة";
      return `${p?.name} ×${l.qty} ${unitLbl}`;
    }).join("، ");

    setProducts(ps => ps.map(p => {
      const ln = valid.find(l => l.prodId == p.id);
      if (!ln) return p;
      const piecesAdded = piecesOf(ln);
      const buyPiece = buyPieceOf(ln);
      const sellPiece = parseFloat(ln.sellPiece) || 0;
      const sellPack = parseFloat(ln.sellPack) || 0;
      return {
        ...p,
        stock: (p.stock === null ? 0 : p.stock) + piecesAdded,
        buy: Math.round(buyPiece * 100) / 100,
        sell: sellPiece ? Math.round(sellPiece * 100) / 100 : p.sell,
        sellPack: sellPack ? Math.round(sellPack * 100) / 100 : p.sellPack,
        exp: (p.hasExp && ln.exp) ? ln.exp : p.exp,
        supplier: p.supplier || supplier,
      };
    }));

    setPurchases(pr => [{ id: num, supplier, date, items: itemsStr, pay, total: Math.round(grand * 100) / 100, status: "جديد", by: user?.name || "—" }, ...pr]);
    setSuppliers(sup => sup.map(x => x.name === supplier
      ? { ...x, total: x.total + grand, due: (x.due || 0) + (pay === "آجل" ? grand : 0), status: pay === "آجل" ? "آجل" : x.status }
      : x));
    // حفظ فوري (بلا انتظار التأجيل المعتاد) — هذه عملية حرجة تُحدِّث المخزون ولا يجب أن تُفقد
    DB.flush("products"); DB.flush("purchases"); DB.flush("suppliers");
    showToast(`تم حفظ التوريد #${num} وتحديث المخزون والأسعار${pay === "آجل" ? " (آجل)" : ""}`);
    setModal(false); setLines([{ ...emptyLine }]); setSupplier("");
  };

  const PAY_TONE = { "كاش": "g", "بطاقة": "b", "تحويل": "p", "آجل": "a" };
  return (
    <>
      <PageTop title="فواتير المشتريات والتوريد" action={<Btn gold onClick={() => setModal(true)}>+ فاتورة توريد</Btn>} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 11, marginBottom: "1.1rem" }}>
        <KCard label="مشتريات الشهر" value={fmt(monthPurch)} sub={cur} bar={C.red} />
        <KCard label="عدد الفواتير" value={purchases.length} bar="#2a78d6" />
        <KCard label="مستحقات آجلة" value={fmt(dueTotal)} sub={cur} bar={C.gold} />
      </div>
      <Card>
        <CardHead title="سجل فواتير التوريد" sub="عند التوريد يُحدَّث المخزون (بالقطع) وسعر الشراء والبيع وتاريخ الصلاحية" />
        <Table cols={[{ h: "رقم", w: "13%" }, { h: "المورد", w: "18%" }, { h: "التاريخ", w: "14%" }, { h: "المنتجات", w: "24%" }, { h: "الدفع", w: "12%" }, { h: "الإجمالي", w: "11%" }, { h: "الحالة", w: "8%" }]}
          rows={purchases.map(p => ["#" + p.id, p.supplier, arDate(p.date), p.items, <Badge tone={PAY_TONE[p.pay] || "g"}>{p.pay}</Badge>, fmt(p.total) + " " + cur, <Badge tone={p.status === "قيد الشحن" ? "a" : "g"}>{p.status}</Badge>])} />
      </Card>

      {modal && (
        <Modal title="فاتورة توريد جديدة" onClose={() => setModal(false)} width={720}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="المورد">
              <div style={{ display: "flex", gap: 6 }}>
                <Sel value={supplier} onChange={e => setSupplier(e.target.value)} style={{ flex: 1 }}><option value="">اختر المورد...</option>{suppliers.map(s => <option key={s.id}>{s.name}</option>)}</Sel>
                <Btn sm gold onClick={() => { setNewSup({ name: "", phone: "", spec: "" }); setNewSupModal(true); }} style={{ whiteSpace: "nowrap" }}>+ مورد</Btn>
              </div>
            </Field>
            <Field label="تاريخ الفاتورة"><Inp type="date" value={date} onChange={e => setDate(e.target.value)} /></Field>
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.mt, margin: ".3rem 0 .5rem" }}>الأصناف الموردة</div>
          {lines.map((ln, i) => {
            const p = prodOf(ln.prodId);
            const pack = p?.packSize || 1;
            const isPackaged = pack > 1;
            const piecesAdded = piecesOf(ln);
            const buyPiece = buyPieceOf(ln);
            return (
              <div key={i} style={{ background: C.crm, borderRadius: 10, padding: ".6rem .7rem", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 7 }}>
                  <Sel value={ln.prodId} onChange={e => setLine(i, "prodId", e.target.value)} style={{ flex: 2.5, background: C.cd }}><option value="">اختر المنتج...</option>{products.map(pr => <option key={pr.id} value={pr.id}>{pr.name}{pr.packSize > 1 ? ` (${pr.unit} = ${pr.packSize} قطعة)` : ""}</option>)}</Sel>
                  <button onClick={() => delLine(i)} style={{ background: "none", border: "none", cursor: "pointer", color: C.mt, fontSize: 15 }}>✕</button>
                </div>
                {p && (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: isPackaged ? "0.8fr 1fr 1fr 1fr" : "1fr 1.4fr", gap: 6, alignItems: "end", marginBottom: 6 }}>
                      <div>
                        <div style={labelMini}>الكمية</div>
                        <Inp type="number" value={ln.qty} onChange={e => setLine(i, "qty", parseInt(e.target.value) || 1)} style={{ background: C.cd }} min="1" />
                      </div>
                      {isPackaged && (
                        <div>
                          <div style={labelMini}>وحدة الكمية</div>
                          <Sel value={ln.qtyUnit} onChange={e => setLine(i, "qtyUnit", e.target.value)} style={{ background: C.cd }}>
                            <option value="pack">{p.unit} (×{pack})</option>
                            <option value="piece">قطعة</option>
                          </Sel>
                        </div>
                      )}
                      <div>
                        <div style={labelMini}>سعر الشراء</div>
                        <Inp type="number" value={ln.buyPrice} onChange={e => setLine(i, "buyPrice", e.target.value)} style={{ background: C.cd }} placeholder="0" />
                      </div>
                      {isPackaged && (
                        <div>
                          <div style={labelMini}>أساس السعر</div>
                          <Sel value={ln.buyBasis} onChange={e => setLine(i, "buyBasis", e.target.value)} style={{ background: C.cd }}>
                            <option value="pack">لكل {p.unit}</option>
                            <option value="piece">لكل قطعة</option>
                          </Sel>
                        </div>
                      )}
                    </div>
                    {isPackaged && parseFloat(ln.buyPrice) > 0 && (
                      <div style={{ background: C.bluebg, borderRadius: 7, padding: ".4rem .7rem", fontSize: 11.5, color: C.blue, marginBottom: 6 }}>
                        🧮 تكلفة القطعة الواحدة: <b>{fmt(buyPiece)} {cur}</b>{ln.buyBasis === "pack" ? ` (${ln.buyPrice} ÷ ${pack})` : ""}
                      </div>
                    )}
                    <div style={{ display: "grid", gridTemplateColumns: isPackaged ? (p.hasExp ? "1fr 1fr 1fr" : "1fr 1fr") : (p.hasExp ? "1fr 1fr" : "1fr"), gap: 6, alignItems: "end" }}>
                      <div>
                        <div style={labelMini}>سعر بيع القطعة</div>
                        <Inp type="number" value={ln.sellPiece} onChange={e => setLine(i, "sellPiece", e.target.value)} style={{ background: C.cd }} placeholder="0" />
                      </div>
                      {isPackaged && (
                        <div>
                          <div style={labelMini}>سعر بيع {p.unit}</div>
                          <Inp type="number" value={ln.sellPack} onChange={e => setLine(i, "sellPack", e.target.value)} style={{ background: C.cd }} placeholder={ln.sellPiece ? fmt((parseFloat(ln.sellPiece) || 0) * pack) : "0"} />
                        </div>
                      )}
                      {p.hasExp && <div><div style={labelMini}>تاريخ الصلاحية</div><Inp type="date" value={ln.exp} onChange={e => setLine(i, "exp", e.target.value)} style={{ background: C.cd }} /></div>}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 7, fontSize: 11, color: C.mt, flexWrap: "wrap", gap: 4 }}>
                      <span>➕ يُضاف <b>{piecesAdded}</b> قطعة للمخزون{ln.qtyUnit === "pack" && isPackaged ? ` (${ln.qty} ${p.unit} × ${pack})` : ""}</span>
                      {parseFloat(ln.sellPiece) > 0 && buyPiece > 0 && <span style={{ color: "#1a8c3e" }}>ربح القطعة: {fmt((parseFloat(ln.sellPiece) || 0) - buyPiece)} {cur}</span>}
                      <span style={{ fontWeight: 700, color: C.grn2 }}>إجمالي السطر: {fmt(lineCost(ln))} {cur}</span>
                    </div>
                  </>
                )}
              </div>
            );
          })}
          <Btn sm onClick={addLine} style={{ marginTop: 2 }}>+ إضافة صنف</Btn>
          <Field label="طريقة الدفع" full><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 4 }}>
            {["كاش", "بطاقة", "تحويل", "آجل"].map(m => <div key={m} onClick={() => setPay(m)} style={{ gridColumn: m === "آجل" ? "1/-1" : "auto", border: `1px solid ${pay === m ? C.gold : C.bc}`, borderRadius: 8, padding: ".45rem", textAlign: "center", cursor: "pointer", fontSize: 12, background: pay === m ? "rgba(201,168,76,.12)" : C.crm, color: pay === m ? C.grn2 : C.k2, fontWeight: pay === m ? 600 : 500 }}>{m}</div>)}
          </div></Field>
          <div style={{ background: C.crm, borderRadius: 9, padding: ".65rem .85rem", margin: ".75rem 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ fontSize: 12, color: C.mt, fontWeight: 600 }}>إجمالي الفاتورة</span><span style={{ fontSize: 17, fontWeight: 700, color: C.grn2 }}>{fmt(grand)} {cur}</span></div>
          <div style={{ display: "flex", gap: 8 }}><Btn gold onClick={save} style={{ flex: 1, justifyContent: "center" }}>✓ حفظ وتوريد</Btn><Btn onClick={() => setModal(false)}>إلغاء</Btn></div>
        </Modal>
      )}

      {newSupModal && (
        <Modal title="إضافة مورد جديد" onClose={() => setNewSupModal(false)} width={430}>
          <Field label="اسم المورد *"><Inp value={newSup.name} onChange={e => setNewSup({ ...newSup, name: e.target.value })} /></Field>
          <Field label="رقم الهاتف / الواتساب"><Inp value={newSup.phone} onChange={e => setNewSup({ ...newSup, phone: e.target.value })} placeholder="0913-000-000" /></Field>
          <Field label="التخصص"><Inp value={newSup.spec} onChange={e => setNewSup({ ...newSup, spec: e.target.value })} placeholder="أجهزة ألعاب / مواد كافيه" /></Field>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn gold style={{ flex: 1, justifyContent: "center" }} onClick={() => {
              if (!newSup.name.trim()) { showToast("أدخل اسم المورد"); return; }
              let d = (newSup.phone || "").replace(/\D/g, ""); if (d.startsWith("0")) d = "218" + d.slice(1);
              const s = { id: Math.max(0, ...suppliers.map(x => x.id)) + 1, name: newSup.name.trim(), phone: newSup.phone, wa: d, spec: newSup.spec || "عام", total: 0, due: 0, status: "نشط" };
              setSuppliers(list => [...list, s]);
              setSupplier(s.name); // اختره تلقائياً في الفاتورة
              showToast("تمت إضافة المورد واختياره");
              setNewSupModal(false);
            }}>✓ حفظ واختيار</Btn>
            <Btn onClick={() => setNewSupModal(false)}>إلغاء</Btn>
          </div>
        </Modal>
      )}
    </>
  );
}
const labelMini = { fontSize: 10, color: C.mt, fontWeight: 600, marginBottom: 2 };

/* ============================ BOOKINGS ============================ */
function Bookings({ ctx }) {
  const { bookings, setBookings, completedBookings, setCompletedBookings, invoices, setInvoices, tables, setTables, cancellations, setCancellations, user, showToast, settings } = ctx;
  const cur = settings?.currency || "د.ل";
  const [modal, setModal] = useState(false);
  const [manageModal, setManageModal] = useState(false);
  const [editTable, setEditTable] = useState(null); // table being edited/added
  const [type, setType] = useState("billiard");
  const [tableId, setTableId] = useState(null);
  const [customer, setCustomer] = useState("");
  const [duration, setDuration] = useState("60"); // بالدقائق: 15 | 30 | 60 | مفتوح (open)
  const [bkPay, setBkPay] = useState("كاش");
  const [cancelModal, setCancelModal] = useState(false);
  const [cancelForm, setCancelForm] = useState({ customer: "", resType: "billiard", reason: "عدم حضور", note: "", date: todayISO() });
  const CANCEL_REASONS = ["عدم حضور", "إلغاء بطلب الزبون", "خطأ في التسجيل", "أخرى"];
  const [, force] = useState(0);
  useEffect(() => { const t = setInterval(() => force(x => x + 1), 1000); return () => clearInterval(t); }, []);

  const logCancellation = (data) => setCancellations(cs => [{ id: "CN-" + Date.now(), by: user?.name || "—", ...data }, ...cs]);
  const saveCancelLog = () => {
    if (!cancelForm.customer.trim()) { showToast("أدخل اسم الزبون"); return; }
    logCancellation({ date: cancelForm.date, customer: cancelForm.customer.trim(), resType: cancelForm.resType, reason: cancelForm.reason, note: cancelForm.note.trim() });
    showToast("تم تسجيل الإلغاء/عدم الحضور");
    setCancelModal(false); setCancelForm({ customer: "", resType: "billiard", reason: "عدم حضور", note: "", date: todayISO() });
  };
  // إلغاء حجز نشط حالياً بدون فوترة (مثلاً بدأ بالخطأ) — يحرّر الطاولة ويُسجَّل في سجل الإلغاءات
  const cancelActive = (id) => {
    const b = bookings[id]; if (!b) return;
    if (!window.confirm(`إلغاء حجز ${b.tableName} دون إصدار فاتورة؟`)) return;
    logCancellation({ date: todayISO(), customer: b.customer, resType: b.type, resName: b.tableName, reason: "خطأ في التسجيل", note: "أُلغي أثناء الحجز النشط" });
    setBookings(bk => { const n = { ...bk }; delete n[id]; return n; });
    showToast("أُلغي الحجز وحُرّرت الطاولة");
  };

  const tablesByType = (t) => tables.filter(x => x.type === t);
  const busy = (tid) => Object.values(bookings).some(b => b.tableId === tid);
  const rateOf = (tid) => tables.find(t => t.id === tid)?.rate || 0;
  // سعر المدة حسب سعر الساعة (النصف والربع تناسبياً)
  const priceForDuration = (rate, mins) => {
    if (mins === "open") return 0;
    return Math.round(rate * (parseInt(mins) / 60) * 10) / 10;
  };
  const DUR_OPTS = [{ v: "15", l: "ربع ساعة", s: "15 دقيقة" }, { v: "30", l: "نصف ساعة", s: "30 دقيقة" }, { v: "60", l: "ساعة كاملة", s: "60 دقيقة" }, { v: "open", l: "وقت مفتوح", s: "عدّاد حر" }];

  const start = (tbl, cust, mins, pay) => {
    const id = "bk_" + Date.now();
    const isOpen = mins === "open";
    const price = isOpen ? 0 : priceForDuration(tbl.rate, mins);
    setBookings(b => ({ ...b, [id]: {
      type: tbl.type, tableId: tbl.id, tableName: tbl.name, customer: cust || "زبون",
      startTime: Date.now(), rate: tbl.rate,
      durationMin: isOpen ? null : parseInt(mins), // null = مفتوح
      prepaid: !isOpen, prepaidAmount: price, pay: pay || "كاش",
    } }));
    // الحجز محدد المدة يُدفع مقدماً → أنشئ الفاتورة فوراً
    if (!isOpen) {
      const invNum = "INV-BK-" + (completedBookings.length + invoices.filter(i => i.id.startsWith("INV-BK")).length + 1);
      const durStr = mins === "15" ? "ربع ساعة" : mins === "30" ? "نصف ساعة" : "ساعة";
      setInvoices(iv => [{ id: invNum, customer: cust || "زبون", date: todayISO(), source: "حجز", details: `${TYPE_NAME[tbl.type]} — ${tbl.name} — ${durStr}`, resType: tbl.type, resName: tbl.name, pay, discount: "—", total: price, cost: 0, status: "مدفوعة", by: user?.name || "—", time: new Date().toTimeString().slice(0, 5) }, ...iv]);
      showToast(`تم تأكيد الحجز — ${durStr} بـ ${fmt(price)} ${cur} (${pay}) · فاتورة #${invNum}`);
    } else {
      showToast(`بدأ حجز مفتوح على ${tbl.name} — العدّاد يعمل`);
    }
  };

  const stop = (id) => {
    const b = bookings[id]; if (!b) return;
    // الحجز المدفوع مقدماً: أُنشئت فاتورته عند البدء — الإنهاء يحرّر الطاولة فقط
    if (b.prepaid) {
      setCompletedBookings(cb => [{ type: b.type, tableName: b.tableName, customer: b.customer, dur: b.durationMin >= 60 ? "ساعة" : b.durationMin === 30 ? "نصف ساعة" : "ربع ساعة", rate: b.rate, total: b.prepaidAmount, inv: "مدفوع مقدماً" }, ...cb]);
      setBookings(bk => { const n = { ...bk }; delete n[id]; return n; });
      showToast(`انتهى حجز ${b.tableName}`);
      return;
    }
    // الحجز المفتوح: يُحسب بالوقت الفعلي وتُنشأ فاتورته الآن
    const ms = Date.now() - b.startTime;
    const hours = ms / 3600000;
    const total = Math.max(b.rate * 0.25, hours * b.rate);
    const durMin = Math.round(ms / 60000);
    const durStr = durMin >= 60 ? `${Math.floor(durMin / 60)}س ${durMin % 60}د` : `${durMin}د`;
    const invNum = "INV-AUTO-" + (completedBookings.length + 9);
    setCompletedBookings(cb => [{ type: b.type, tableName: b.tableName, customer: b.customer, dur: durStr, rate: b.rate, total, inv: invNum }, ...cb]);
    setInvoices(iv => [{ id: invNum, customer: b.customer, date: todayISO(), source: "حجز", details: `${TYPE_NAME[b.type]} — ${b.tableName} — ${durStr}`, resType: b.type, resName: b.tableName, pay: b.pay || "كاش", discount: "—", total: Math.round(total * 10) / 10, cost: 0, status: "مدفوعة", by: user?.name || "—", time: new Date().toTimeString().slice(0, 5) }, ...iv]);
    setBookings(bk => { const n = { ...bk }; delete n[id]; return n; });
    showToast(`فاتورة تلقائية #${invNum} — ${fmt(Math.round(total * 10) / 10)} ${cur}`);
  };

  const elapsed = (st) => {
    const ms = Date.now() - st;
    const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };
  const busyCount = Object.keys(bookings).length;
  const todayRev = completedBookings.reduce((s, b) => s + b.total, 0);

  /* ---- table management ---- */
  const saveTable = (data) => {
    if (!data.name.trim()) { showToast("أدخل اسم الطاولة"); return; }
    const rate = parseFloat(data.rate) || TYPE_DEFAULT_RATE[data.type] || 0;
    if (data.id && tables.some(t => t.id === data.id)) {
      // edit
      setTables(ts => ts.map(t => t.id === data.id ? { ...t, name: data.name.trim(), rate, type: data.type } : t));
      showToast("تم تحديث الطاولة");
    } else {
      // add
      const newId = data.type[0] + Date.now().toString().slice(-5);
      setTables(ts => [...ts, { id: newId, type: data.type, name: data.name.trim(), rate }]);
      showToast("تمت إضافة الطاولة");
    }
    setEditTable(null);
  };
  const deleteTable = (tid) => {
    if (busy(tid)) { showToast("لا يمكن حذف طاولة مشغولة — أنهِ الحجز أولاً"); return; }
    setTables(ts => ts.filter(t => t.id !== tid));
    showToast("تم حذف الطاولة");
  };

  const openNewBooking = () => {
    const first = tablesByType("billiard")[0] || tables[0];
    if (first) { setType(first.type); setTableId(first.id); }
    setModal(true);
  };

  return (
    <>
      <PageTop title="حجز الطاولات — اللوحة الحية" action={
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
          <Btn onClick={() => setManageModal(true)}>⚙ إدارة الطاولات</Btn>
          <Btn onClick={() => { setCancelForm({ customer: "", resType: "billiard", reason: "عدم حضور", note: "", date: todayISO() }); setCancelModal(true); }}>✕ تسجيل إلغاء / عدم حضور</Btn>
          <Btn gold onClick={openNewBooking}>+ حجز جديد</Btn>
        </div>
      } />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 11, marginBottom: "1.1rem" }}>
        <KCard label="مشغولة الآن" value={busyCount} sub={`من ${tables.length} طاولة`} bar="#1a8c3e" />
        <KCard label="إيراد الحجوزات" value={fmt(todayRev)} sub={cur} bar={C.gold} />
        <KCard label="حجوزات مكتملة" value={completedBookings.length} sub="اليوم" bar="#2a78d6" />
        <KCard label="فواتير تلقائية" value={completedBookings.length} sub="عند الخروج" bar={C.purp} />
      </div>
      <Card>
        <CardHead title="حالة الطاولات والملاعب — مباشر" sub="🟢 تحديث تلقائي كل ثانية" />
        {tables.length === 0 ? (
          <div style={{ textAlign: "center", padding: "2rem", color: C.mt }}>لا توجد طاولات — اضغط «إدارة الطاولات» لإضافة أول طاولة.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(165px,1fr))", gap: 12 }}>
            {tables.map(tb => {
              const entry = Object.entries(bookings).find(([, b]) => b.tableId === tb.id);
              if (entry) {
                const [id, b] = entry;
                return (
                  <div key={tb.id} style={{ borderRadius: 13, padding: ".9rem", border: "1px solid rgba(201,168,76,.4)", background: "linear-gradient(135deg,#fff7eb,#fff)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: ".5rem" }}><div style={{ fontSize: 13, fontWeight: 700 }}>{TYPE_ICON[tb.type]} {tb.name}</div><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#1a8c3e", display: "inline-block" }} /></div>
                    {b.prepaid ? (() => {
                      const remainMs = (b.startTime + b.durationMin * 60000) - Date.now();
                      const over = remainMs <= 0;
                      const rm = Math.abs(remainMs);
                      const mm = Math.floor(rm / 60000), ss = Math.floor((rm % 60000) / 1000);
                      return (
                        <>
                          <div style={{ fontSize: 21, fontWeight: 700, color: over ? "#e34948" : C.grn2, fontFamily: "monospace", letterSpacing: 1, margin: ".4rem 0" }}>{over ? "-" : ""}{String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}</div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: over ? "#e34948" : "#1a8c3e" }}>{over ? "⏰ انتهى الوقت!" : "متبقٍ من الحجز"}</div>
                        </>
                      );
                    })() : (
                      <>
                        <div style={{ fontSize: 21, fontWeight: 700, color: C.grn2, fontFamily: "monospace", letterSpacing: 1, margin: ".4rem 0" }}>{elapsed(b.startTime)}</div>
                        <div style={{ fontSize: 10, color: C.mt }}>وقت مفتوح · {b.rate} {cur}/س</div>
                      </>
                    )}
                    <div style={{ fontSize: 11.5, color: C.k2, marginTop: 4, marginBottom: 2 }}>👤 {b.customer}</div>
                    {b.prepaid && <div style={{ fontSize: 10, color: "#1a8c3e", fontWeight: 600 }}>✓ مدفوع مقدماً {fmt(b.prepaidAmount)} {cur} ({b.pay})</div>}
                    <button onClick={() => stop(id)} style={{ width: "100%", marginTop: ".6rem", padding: ".4rem", borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: "pointer", border: "none", background: "#e34948", color: "#fff", fontFamily: "inherit" }}>{b.prepaid ? "■ إنهاء الحجز" : "■ إنهاء وإصدار فاتورة"}</button>
                    {!b.prepaid && <button onClick={() => cancelActive(id)} style={{ width: "100%", marginTop: 4, padding: ".3rem", borderRadius: 7, fontSize: 10, fontWeight: 600, cursor: "pointer", border: `1px solid ${C.bc}`, background: "none", color: C.mt, fontFamily: "inherit" }}>✕ إلغاء دون فاتورة</button>}
                  </div>
                );
              }
              return (
                <div key={tb.id} style={{ borderRadius: 13, padding: ".9rem", border: `1px solid ${C.bc}`, background: C.crm }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: ".5rem" }}>{TYPE_ICON[tb.type]} {tb.name}</div>
                  <div style={{ fontSize: 26, color: C.mt, textAlign: "center", marginBottom: 2 }}>○</div>
                  <div style={{ textAlign: "center", fontSize: 10.5, color: C.mt, marginBottom: 8 }}>متاحة · {tb.rate} {cur}/س</div>
                  <button onClick={() => { setType(tb.type); setTableId(tb.id); setDuration("60"); setBkPay("كاش"); setCustomer(""); setModal(true); }} style={{ width: "100%", padding: ".45rem", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "none", background: C.grl, color: "#fff", fontFamily: "inherit" }}>▶ حجز</button>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card style={{ marginTop: 11 }}>
        <CardHead title="آخر الحجوزات المكتملة" sub={completedBookings.length > 50 ? `عرض أحدث 50 من ${fmt(completedBookings.length)}` : undefined} />
        {completedBookings.length === 0 ? <div style={{ color: C.mt, fontSize: 12, padding: "1rem 0", textAlign: "center" }}>لا توجد حجوزات مكتملة بعد — ابدأ حجزاً ثم أنهِه لترى الفوترة التلقائية</div> :
          <Table cols={[{ h: "النشاط", w: "22%" }, { h: "الزبون", w: "18%" }, { h: "المدة", w: "14%" }, { h: "السعر/ساعة", w: "14%" }, { h: "الإجمالي", w: "14%" }, { h: "الفاتورة", w: "18%" }]}
            rows={completedBookings.slice(0, 50).map(b => [`${TYPE_ICON[b.type]} ${TYPE_NAME[b.type]} — ${b.tableName}`, b.customer, b.dur, b.rate + " " + cur, fmt(Math.round(b.total * 10) / 10) + " " + cur, <Badge tone="b">#{b.inv}</Badge>])} />}
      </Card>

      {cancellations.length > 0 && (
        <Card style={{ marginTop: 11 }}>
          <CardHead title="✕ سجل الإلغاءات وعدم الحضور" sub={`${cancellations.length} حالة مسجَّلة`} />
          <Table cols={[{ h: "التاريخ", w: "14%" }, { h: "الزبون", w: "20%" }, { h: "النوع", w: "18%" }, { h: "السبب", w: "20%" }, { h: "ملاحظة", w: "18%" }, { h: "بواسطة", w: "10%" }]}
            rows={cancellations.slice(0, 10).map(c => [arDate(c.date), c.customer, `${TYPE_ICON[c.resType] || ""} ${TYPE_NAME[c.resType] || c.resType}`, <Badge tone={c.reason === "عدم حضور" ? "a" : "r"}>{c.reason}</Badge>, c.note || "—", c.by])} />
        </Card>
      )}

      {/* نافذة تسجيل إلغاء / عدم حضور */}
      {cancelModal && (
        <Modal title="تسجيل إلغاء / عدم حضور" onClose={() => setCancelModal(false)} width={440}>
          <Field label="اسم الزبون"><Inp value={cancelForm.customer} onChange={e => setCancelForm({ ...cancelForm, customer: e.target.value })} placeholder="اسم من كان محجوزاً" /></Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="النوع"><Sel value={cancelForm.resType} onChange={e => setCancelForm({ ...cancelForm, resType: e.target.value })}>{Object.entries(TYPE_NAME).map(([k, l]) => <option key={k} value={k}>{TYPE_ICON[k]} {l}</option>)}</Sel></Field>
            <Field label="التاريخ"><Inp type="date" value={cancelForm.date} onChange={e => setCancelForm({ ...cancelForm, date: e.target.value })} /></Field>
          </div>
          <Field label="السبب"><Sel value={cancelForm.reason} onChange={e => setCancelForm({ ...cancelForm, reason: e.target.value })}>{CANCEL_REASONS.map(r => <option key={r}>{r}</option>)}</Sel></Field>
          <Field label="ملاحظة (اختياري)"><Inp value={cancelForm.note} onChange={e => setCancelForm({ ...cancelForm, note: e.target.value })} placeholder="أي تفاصيل إضافية" /></Field>
          <div style={{ fontSize: 11, color: C.mt, margin: "4px 0 12px", lineHeight: 1.7 }}>يُستخدم هذا لتسجيل حجوزات هاتفية أو شفهية لم تُنفَّذ — يساعد على متابعة معدل الإلغاء وعدم الحضور بمرور الوقت.</div>
          <div style={{ display: "flex", gap: 8 }}><Btn gold onClick={saveCancelLog} style={{ flex: 1, justifyContent: "center" }}>✓ تسجيل</Btn><Btn onClick={() => setCancelModal(false)}>إلغاء</Btn></div>
        </Modal>
      )}

      {/* NEW BOOKING MODAL */}
      {modal && (
        <Modal title="حجز جديد" onClose={() => setModal(false)}>
          <Field label="نوع النشاط" full>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
              {["billiard", "tennis", "football"].map(t => {
                const count = tablesByType(t).length;
                return (
                  <div key={t} onClick={() => { setType(t); const first = tablesByType(t)[0]; setTableId(first?.id || null); }} style={{ border: `1px solid ${type === t ? C.gold : C.bc}`, borderRadius: 10, padding: ".6rem", textAlign: "center", cursor: "pointer", background: type === t ? "rgba(201,168,76,.12)" : C.crm, opacity: count ? 1 : .5 }}>
                    <div style={{ fontSize: 22, marginBottom: 4 }}>{TYPE_ICON[t]}</div><div style={{ fontSize: 11.5, fontWeight: 600 }}>{TYPE_NAME[t]}</div><div style={{ fontSize: 10, color: C.mt, marginTop: 2 }}>{count} طاولة</div>
                  </div>
                );
              })}
            </div>
          </Field>
          <Field label="اختر الطاولة / الملعب" full>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 7 }}>
              {tablesByType(type).map(tb => {
                const isBusy = busy(tb.id);
                return <div key={tb.id} onClick={() => !isBusy && setTableId(tb.id)} style={{ border: `1px solid ${tableId === tb.id ? C.gold : C.bc}`, borderRadius: 9, padding: ".5rem", textAlign: "center", fontSize: 11.5, fontWeight: 600, cursor: isBusy ? "not-allowed" : "pointer", background: isBusy ? C.redbg : tableId === tb.id ? "rgba(201,168,76,.15)" : C.crm, color: isBusy ? "#922" : C.k2, opacity: isBusy ? .7 : 1 }}>{TYPE_ICON[type]}<br />{tb.name}<br /><span style={{ fontSize: 9, color: C.mt }}>{tb.rate} {cur}/س</span>{isBusy && <><br /><span style={{ fontSize: 9 }}>مشغولة</span></>}</div>;
              })}
              {tablesByType(type).length === 0 && <div style={{ gridColumn: "1/-1", textAlign: "center", color: C.mt, fontSize: 12, padding: ".5rem" }}>لا توجد طاولات لهذا النوع.</div>}
            </div>
          </Field>
          <Field label="اسم الزبون"><Inp value={customer} onChange={e => setCustomer(e.target.value)} placeholder="محمد علي" /></Field>

          <Field label="مدة الحجز" full>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 7 }}>
              {DUR_OPTS.map(o => {
                const price = priceForDuration(rateOf(tableId), o.v);
                return (
                  <div key={o.v} onClick={() => setDuration(o.v)} style={{ border: `1.5px solid ${duration === o.v ? C.gold : C.bc}`, borderRadius: 10, padding: ".55rem .7rem", cursor: "pointer", background: duration === o.v ? C.gold + "14" : C.crm, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div><div style={{ fontSize: 12.5, fontWeight: 700 }}>{o.l}</div><div style={{ fontSize: 9.5, color: C.mt }}>{o.s}</div></div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: o.v === "open" ? C.mt : C.grn2 }}>{o.v === "open" ? "حسب الوقت" : fmt(price) + " " + cur}</div>
                  </div>
                );
              })}
            </div>
          </Field>

          {duration !== "open" && (
            <Field label="طريقة الدفع" full>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
                {["كاش", "بطاقة", "تحويل"].map(m => (
                  <div key={m} onClick={() => setBkPay(m)} style={{ border: `1px solid ${bkPay === m ? C.gold : C.bc}`, borderRadius: 8, padding: ".45rem", textAlign: "center", cursor: "pointer", fontSize: 12, fontWeight: bkPay === m ? 700 : 500, background: bkPay === m ? C.gold + "14" : C.crm, color: bkPay === m ? C.grn2 : C.k2 }}>{m}</div>
                ))}
              </div>
            </Field>
          )}

          <div style={{ background: "rgba(26,140,62,.07)", border: "0.5px solid rgba(26,140,62,.22)", borderRadius: 9, padding: ".65rem .85rem", margin: ".6rem 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: C.mt, fontWeight: 600 }}>{duration === "open" ? "السعر بالساعة" : "الإجمالي المستحق"}</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: C.grn2 }}>{duration === "open" ? fmt(rateOf(tableId)) : fmt(priceForDuration(rateOf(tableId), duration))} {cur}</span>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <Btn gold style={{ flex: 1, justifyContent: "center" }} onClick={() => {
              const tbl = tables.find(t => t.id === tableId);
              if (!tbl) { showToast("اختر طاولة"); return; }
              if (busy(tableId)) { showToast("الطاولة مشغولة"); return; }
              start(tbl, customer, duration, bkPay);
              setModal(false); setCustomer(""); setDuration("60"); setBkPay("كاش");
            }}>{duration === "open" ? "▶ بدء الحجز المفتوح" : "✓ تأكيد الحجز والدفع"}</Btn>
            <Btn onClick={() => setModal(false)}>إلغاء</Btn>
          </div>
        </Modal>
      )}

      {/* MANAGE TABLES MODAL */}
      {manageModal && (
        <Modal title="إدارة الطاولات والملاعب" onClose={() => setManageModal(false)} width={600}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: C.mt }}>أضف، عدّل، احذف، وغيّر أسعار الطاولات لكل نشاط.</div>
            <Btn gold sm onClick={() => setEditTable({ id: null, type: "billiard", name: "", rate: "" })}>+ طاولة جديدة</Btn>
          </div>
          {["billiard", "tennis", "football"].map(t => {
            const list = tablesByType(t);
            return (
              <div key={t} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.gdd, marginBottom: 6 }}>{TYPE_ICON[t]} {TYPE_NAME[t]} ({list.length})</div>
                {list.length === 0 && <div style={{ fontSize: 11.5, color: C.mt, padding: ".3rem 0" }}>لا توجد طاولات.</div>}
                {list.map(tb => (
                  <div key={tb.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: C.crm, borderRadius: 8, padding: ".5rem .75rem", marginBottom: 5 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 16 }}>{TYPE_ICON[t]}</span>
                      <div><div style={{ fontSize: 12.5, fontWeight: 600 }}>{tb.name}</div><div style={{ fontSize: 10.5, color: C.mt }}>{tb.rate} {cur} / ساعة{busy(tb.id) && " · مشغولة الآن"}</div></div>
                    </div>
                    <div style={{ display: "flex", gap: 5 }}>
                      <Btn sm onClick={() => setEditTable({ ...tb, rate: String(tb.rate) })}>تعديل</Btn>
                      <Btn sm danger onClick={() => deleteTable(tb.id)}>حذف</Btn>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </Modal>
      )}

      {/* ADD / EDIT TABLE MODAL */}
      {editTable && (
        <Modal title={editTable.id ? "تعديل طاولة" : "إضافة طاولة جديدة"} onClose={() => setEditTable(null)} width={420}>
          <Field label="نوع النشاط">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
              {["billiard", "tennis", "football"].map(t => (
                <div key={t} onClick={() => setEditTable(e => ({ ...e, type: t, rate: e.rate || String(TYPE_DEFAULT_RATE[t]) }))} style={{ border: `1px solid ${editTable.type === t ? C.gold : C.bc}`, borderRadius: 8, padding: ".5rem", textAlign: "center", cursor: "pointer", background: editTable.type === t ? "rgba(201,168,76,.12)" : C.crm }}>
                  <div style={{ fontSize: 18 }}>{TYPE_ICON[t]}</div><div style={{ fontSize: 10.5, fontWeight: 600 }}>{TYPE_NAME[t]}</div>
                </div>
              ))}
            </div>
          </Field>
          <Field label="اسم الطاولة / الملعب"><Inp value={editTable.name} onChange={e => setEditTable(x => ({ ...x, name: e.target.value }))} placeholder="طاولة 4" /></Field>
          <Field label={`السعر بالساعة (${cur})`}><Inp type="number" value={editTable.rate} onChange={e => setEditTable(x => ({ ...x, rate: e.target.value }))} placeholder={String(TYPE_DEFAULT_RATE[editTable.type])} /></Field>
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}><Btn gold onClick={() => saveTable(editTable)} style={{ flex: 1, justifyContent: "center" }}>✓ حفظ</Btn><Btn onClick={() => setEditTable(null)}>إلغاء</Btn></div>
        </Modal>
      )}
    </>
  );
}

/* ============================ SUPPLIERS ============================ */
function Suppliers({ ctx }) {
  const { suppliers, setSuppliers, purchases, setPurchases, showToast, settings } = ctx;
  const [modal, setModal] = useState(false);
  const [filter, setFilter] = useState("all"); // all | due
  const [q, setQ] = useState("");
  const [detail, setDetail] = useState(null);
  const [f, setF] = useState({ name: "", phone: "", spec: "" });
  const cur = settings?.currency || "د.ل";
  const toWa = (phone) => {
    let d = (phone || "").replace(/\D/g, "");
    if (d.startsWith("0")) d = "218" + d.slice(1);
    return d;
  };
  const save = () => {
    if (!f.name.trim()) { showToast("أدخل اسم المورد"); return; }
    setSuppliers(s => [...s, { id: Math.max(0, ...s.map(x => x.id)) + 1, name: f.name, phone: f.phone, wa: toWa(f.phone), spec: f.spec || "عام", total: 0, due: 0, status: "نشط" }]);
    showToast("تمت إضافة المورد"); setModal(false); setF({ name: "", phone: "", spec: "" });
  };

  const shown = suppliers.filter(s => {
    if (!(s.name.includes(q) || (s.phone || "").includes(q))) return false;
    if (filter === "due") return (s.due || 0) > 0;
    if (filter.startsWith("spec:")) return s.spec === filter.slice(5);
    return true;
  });
  const totalDue = suppliers.reduce((s, x) => s + (x.due || 0), 0);
  const dueCount = suppliers.filter(s => (s.due || 0) > 0).length;
  // تصنيفات الموردين (حسب التخصص)
  const specs = [...new Set(suppliers.map(s => s.spec).filter(Boolean))];

  return (
    <>
      <PageTop title="إدارة الموردين" action={<Btn gold onClick={() => setModal(true)}>+ إضافة مورد</Btn>} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 11, marginBottom: "1.1rem" }}>
        <KCard label="الموردون النشطون" value={suppliers.filter(s => s.status === "نشط").length} sub="مورد" bar={C.grl} />
        <KCard label="موردون غير مسدّدين" value={dueCount} sub="عليهم مستحقات" bar={C.gold} />
        <KCard label="إجمالي المستحقات" value={fmt(totalDue)} sub={cur} bar={C.red} />
      </div>

      {totalDue > 0 && (
        <div style={{ background: "linear-gradient(135deg,#fdeaea,#fff)", border: "1px solid rgba(192,57,43,.28)", borderRadius: 12, padding: ".7rem 1rem", marginBottom: "1rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div style={{ fontSize: 12.5, color: "#922" }}>💰 يوجد <b>{dueCount}</b> مورد بمستحقات غير مسددة بإجمالي <b>{fmt(totalDue)} {cur}</b></div>
          <Btn sm danger onClick={() => setFilter("due")}>عرض غير المسدّدين →</Btn>
        </div>
      )}

      <Card>
        <CardHead title="قائمة الموردين" sub="اضغط «عرض» لكشف الحساب والسداد" right={
          <div style={{ display: "flex", gap: 7 }}>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="بحث..." style={{ ...inputStyle, width: 160 }} />
            <Sel value={filter} onChange={e => setFilter(e.target.value)} style={{ width: 165 }}>
              <option value="all">كل الموردين</option>
              <option value="due">غير المسدّدين</option>
              {specs.length > 0 && <option disabled>── حسب التخصص ──</option>}
              {specs.map(sp => <option key={sp} value={"spec:" + sp}>{sp}</option>)}
            </Sel>
          </div>
        } />
        {/* شرائح التصنيف السريع حسب التخصص */}
        {specs.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
            <span onClick={() => setFilter("all")} style={{ cursor: "pointer", fontSize: 11.5, fontWeight: 600, padding: ".3rem .8rem", borderRadius: 20, background: filter === "all" ? C.grn : C.crm, color: filter === "all" ? C.gld : C.k2, border: `0.5px solid ${C.bc}` }}>الكل ({suppliers.length})</span>
            {specs.map(sp => {
              const n = suppliers.filter(s => s.spec === sp).length;
              const active = filter === "spec:" + sp;
              return <span key={sp} onClick={() => setFilter("spec:" + sp)} style={{ cursor: "pointer", fontSize: 11.5, fontWeight: 600, padding: ".3rem .8rem", borderRadius: 20, background: active ? C.grn : C.crm, color: active ? C.gld : C.k2, border: `0.5px solid ${C.bc}` }}>{sp} ({n})</span>;
            })}
          </div>
        )}
        <Table cols={[{ h: "الاسم", w: "19%" }, { h: "الهاتف", w: "15%" }, { h: "واتساب", w: "8%" }, { h: "التخصص", w: "16%" }, { h: "إجمالي الطلبات", w: "13%" }, { h: "المستحقات", w: "14%" }, { h: "عرض", w: "9%" }]}
          rows={shown.map(s => [
            <span style={{ fontWeight: 600 }}>{s.name}</span>, s.phone,
            s.wa ? <span style={{ color: "#25D366", fontSize: 15 }} title="متصل بواتساب">📱</span> : <span style={{ color: C.mt }}>—</span>,
            <Badge tone={s.spec.includes("ألعاب") ? "g" : s.spec.includes("كافيه") ? "a" : "p"}>{s.spec}</Badge>,
            fmt(s.total) + " " + cur,
            (s.due || 0) > 0 ? <Badge tone="a">{fmt(s.due)} {cur}</Badge> : <Badge tone="g">مسدّد</Badge>,
            <Btn sm onClick={() => setDetail(s)}>عرض</Btn>,
          ])} />
      </Card>

      {modal && <Modal title="إضافة مورد جديد" onClose={() => setModal(false)} width={440}>
        <Field label="اسم المورد"><Inp value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="رقم الهاتف / الواتساب"><Inp value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} placeholder="0913-000-000" /></Field>
        {f.phone && <div style={{ fontSize: 11, color: C.mt, marginTop: -6, marginBottom: 10 }}>سيُحفظ رقم الواتساب كـ: {toWa(f.phone) || "—"}</div>}
        <Field label="التخصص"><Inp value={f.spec} onChange={e => setF({ ...f, spec: e.target.value })} placeholder="أجهزة ألعاب / مواد كافيه" /></Field>
        <div style={{ display: "flex", gap: 8 }}><Btn gold onClick={save} style={{ flex: 1, justifyContent: "center" }}>✓ حفظ</Btn><Btn onClick={() => setModal(false)}>إلغاء</Btn></div>
      </Modal>}

      {detail && <SupplierDetail ctx={ctx} supplier={suppliers.find(s => s.id === detail.id)} onClose={() => setDetail(null)} />}
    </>
  );
}

/* ---- Supplier detail: statement, settle payment, receipt, WhatsApp ---- */
function SupplierDetail({ ctx, supplier, onClose }) {
  const { purchases, setPurchases, suppliers, setSuppliers, showToast, settings } = ctx;
  const cur = settings?.currency || "د.ل";
  const [payModal, setPayModal] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payVia, setPayVia] = useState("كاش");
  const s = supplier;
  const supPurchases = purchases.filter(p => p.supplier === s.name);
  const deferredPurchases = supPurchases.filter(p => p.pay === "آجل");

  const settle = () => {
    const amt = parseFloat(payAmount) || 0;
    if (amt <= 0) { showToast("أدخل مبلغاً صحيحاً"); return; }
    if (amt > (s.due || 0)) { showToast("المبلغ أكبر من المستحقات"); return; }
    // reduce supplier due; settle oldest deferred purchases
    let remaining = amt;
    const sorted = [...deferredPurchases].sort((a, b) => a.date.localeCompare(b.date));
    const settledIds = [];
    for (const p of sorted) {
      if (remaining >= p.total) { remaining -= p.total; settledIds.push(p.id); }
    }
    setPurchases(ps => ps.map(x => settledIds.includes(x.id) ? { ...x, pay: "مسدد", status: "مستلم" } : x));
    setSuppliers(sup => sup.map(x => x.id === s.id ? { ...x, due: Math.max(0, (x.due || 0) - amt), status: (x.due || 0) - amt <= 0 ? "نشط" : x.status } : x));
    // سجّل الصرف — يُخصم من الخزينة بيوم الدفع وطريقته
    ctx.setPayments(ps => [{ id: "PY-" + Date.now(), date: todayISO(), kind: "صرف", party: s.name, via: payVia, amount: amt, by: ctx.user?.name || "—" }, ...ps]);
    printVoucher(amt);
    showToast(`تم سداد ${fmt(amt)} ${cur} للمورد وإصدار السند`);
    setPayModal(false); setPayAmount("");
  };

  const printVoucher = (amt) => {
    const isThermal = settings?.printer === "xprinter";
    const newDue = Math.max(0, (s.due || 0) - amt);
    const w = window.open("", "_blank", `width=${isThermal ? 340 : 800},height=600`);
    w.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>سند صرف</title>
    <style>@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap');*{box-sizing:border-box;margin:0;padding:0;font-family:${isThermal ? "monospace" : "'Tajawal',sans-serif"}}
    body{padding:${isThermal ? "10px" : "2cm"};direction:rtl;color:#1a1a18}
    .ttl{text-align:center;font-size:${isThermal ? "14px" : "18px"};font-weight:700;color:#1a5c2e}.sub{text-align:center;font-size:10px;color:#7a7870;margin-bottom:8px}
    .box{border:1px dashed #c9a84c;border-radius:8px;padding:${isThermal ? "8px" : "16px"};margin-top:10px}
    .r{display:flex;justify-content:space-between;font-size:${isThermal ? "11px" : "13px"};margin-bottom:6px}
    .big{font-size:${isThermal ? "18px" : "26px"};font-weight:700;color:#c0392b;text-align:center;margin:10px 0}
    .ft{text-align:center;font-size:10px;color:#7a7870;margin-top:14px;border-top:1px dashed #ccc;padding-top:8px}</style></head><body>
    <div class="ttl">🌴 ${settings?.clubName || "نادي النخيل"}</div><div class="sub">سند صرف للمورد</div>
    <div class="box">
      <div class="r"><span>التاريخ:</span><span>${new Date().toLocaleDateString("ar-LY")}</span></div>
      <div class="r"><span>المورد:</span><span>${s.name}</span></div>
      <div class="r"><span>الهاتف:</span><span>${s.phone}</span></div>
      <div class="big">${fmt(amt)} ${cur}</div>
      <div class="r"><span>المستحق السابق:</span><span>${fmt(s.due || 0)} ${cur}</span></div>
      <div class="r"><span>المتبقي:</span><span>${fmt(newDue)} ${cur}</span></div>
    </div>
    <div class="ft">${settings?.invoiceFooter || "نادي النخيل"}</div>
    <script>window.onload=function(){window.print();}<\/script></body></html>`);
    w.document.close();
  };

  const sendStatement = () => {
    // توليد كشف الحساب PDF — المستخدم يحفظه ويشاركه بنفسه عبر واتساب
    openPdfDoc(settings, {
      title: "كشف حساب مورد",
      recipientLabel: "المورد", recipientName: s.name, recipientPhone: s.phone,
      docNo: "SUP-" + s.id + "-" + Date.now().toString().slice(-4),
      columns: ["#", "رقم الطلب", "التاريخ", "المنتجات", "الدفع", "المبلغ"],
      rows: supPurchases.length
        ? supPurchases.map((p, i) => [i + 1, "#" + p.id, arDate(p.date), p.items, p.pay, fmt(p.total) + " " + cur])
        : [["—", "لا توجد طلبات", "", "", "", ""]],
      totals: [
        ["إجمالي الطلبات", fmt(s.total) + " " + cur],
        ["المستحقات غير المسددة", fmt(s.due || 0) + " " + cur],
      ],
      note: (s.due || 0) > 0 ? "سيتم تسديد المستحقات وفق الاتفاق المبرم. شكراً لتعاونكم." : "جميع المستحقات مسددة — شكراً لتعاونكم.",
    });
    showToast("فُتح كشف الحساب — احفظه كـ PDF ثم شاركه عبر واتساب المورد");
  };

  const PAY_TONE = { "كاش": "g", "بطاقة": "b", "تحويل": "p", "آجل": "a", "مسدد": "g" };
  return (
    <Modal title={`ملف المورد — ${s.name}`} onClose={onClose} width={620}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 14 }}>
        <div style={{ background: C.crm, borderRadius: 10, padding: ".7rem", textAlign: "center" }}><div style={{ fontSize: 17, fontWeight: 700, color: C.grn2 }}>{fmt(s.total)}</div><div style={{ fontSize: 10, color: C.mt }}>إجمالي الطلبات ({cur})</div></div>
        <div style={{ background: C.crm, borderRadius: 10, padding: ".7rem", textAlign: "center" }}><div style={{ fontSize: 17, fontWeight: 700 }}>{supPurchases.length}</div><div style={{ fontSize: 10, color: C.mt }}>عدد الطلبات</div></div>
        <div style={{ background: (s.due || 0) > 0 ? C.redbg : "#e1f4e8", borderRadius: 10, padding: ".7rem", textAlign: "center" }}><div style={{ fontSize: 17, fontWeight: 700, color: (s.due || 0) > 0 ? C.red : "#1a5c2e" }}>{fmt(s.due || 0)}</div><div style={{ fontSize: 10, color: C.mt }}>المستحقات ({cur})</div></div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.mt, marginBottom: 12 }}>
        <span style={{ color: "#25D366", fontSize: 15 }}>📱</span> واتساب: {s.phone || "غير مسجّل"} · التخصص: {s.spec}
      </div>

      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 14 }}>
        {(s.due || 0) > 0 && <Btn gold onClick={() => setPayModal(true)}>💵 سداد مستحقات + سند</Btn>}
        <Btn onClick={sendStatement} style={{ borderColor: "#25D366", color: "#128C4B" }}>📄 فتح كشف الحساب PDF</Btn>
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, color: C.mt, marginBottom: 8 }}>سجل طلبات الشراء ({supPurchases.length})</div>
      <div style={{ maxHeight: 220, overflowY: "auto" }}>
        <Table cols={[{ h: "رقم", w: "16%" }, { h: "التاريخ", w: "20%" }, { h: "المنتجات", w: "30%" }, { h: "الدفع", w: "16%" }, { h: "المبلغ", w: "18%" }]}
          rows={supPurchases.length ? supPurchases.map(p => ["#" + p.id, arDate(p.date), p.items, <Badge tone={PAY_TONE[p.pay] || "g"}>{p.pay}</Badge>, fmt(p.total) + " " + cur]) : [["—", "لا توجد طلبات", "", "", ""]]} />
      </div>

      {payModal && (
        <Modal title="سداد مستحقات المورد" onClose={() => setPayModal(false)} width={400}>
          <div style={{ textAlign: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: C.mt }}>المستحقات غير المسددة</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: C.red }}>{fmt(s.due || 0)} {cur}</div>
          </div>
          <Field label="المبلغ المدفوع"><Inp type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder="0.00" /></Field>
          <Field label="طريقة الدفع">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
              {["كاش", "بطاقة", "تحويل"].map(m => (
                <div key={m} onClick={() => setPayVia(m)} style={{ border: `1px solid ${payVia === m ? C.gold : C.bc}`, borderRadius: 8, padding: ".4rem", textAlign: "center", cursor: "pointer", fontSize: 12, fontWeight: payVia === m ? 700 : 500, background: payVia === m ? C.gold + "14" : C.crm }}>{m}</div>
              ))}
            </div>
          </Field>
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            <Btn sm onClick={() => setPayAmount(String(s.due || 0))}>المبلغ كامل</Btn>
            <Btn sm onClick={() => setPayAmount(String(Math.round((s.due || 0) / 2)))}>النصف</Btn>
          </div>
          <div style={{ fontSize: 11, color: C.mt, marginBottom: 12 }}>سيتم إصدار سند صرف قابل للطباعة، وتسوية طلبات الشراء الآجلة تلقائياً حسب المبلغ.</div>
          <div style={{ display: "flex", gap: 8 }}><Btn gold onClick={settle} style={{ flex: 1, justifyContent: "center" }}>✓ تأكيد وإصدار السند</Btn><Btn onClick={() => setPayModal(false)}>إلغاء</Btn></div>
        </Modal>
      )}
    </Modal>
  );
}

/* ============================ CUSTOMERS ============================ */
/* ---- WhatsApp helper ---- */
/* ---- shared PDF document system: in-app preview + real PDF download ---- */
const PDF_HOOK = { show: null };
// تُستدعى من أي مكوّن — تعرض المستند داخل التطبيق (بدون نوافذ منبثقة)
function openPdfDoc(settings, cfg) {
  if (PDF_HOOK.show) PDF_HOOK.show({ settings: settings || {}, cfg });
}

// تحميل مكتبة تحويل HTML إلى PDF عند الحاجة (تدعم العربية لأنها تلتقط العرض الفعلي)
function ensureHtml2pdf() {
  return new Promise((resolve, reject) => {
    if (window.html2pdf) return resolve();
    const sc = document.createElement("script");
    sc.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
    sc.onload = resolve; sc.onerror = () => reject(new Error("cdn"));
    document.head.appendChild(sc);
  });
}

function PdfPreview({ doc, onClose }) {
  const s = doc.settings || {};
  const cfg = doc.cfg;
  const sheetRef = useRef(null);
  const [state, setState] = useState("preparing"); // preparing | ready | failed
  const [blob, setBlob] = useState(null);
  const [blobUrl, setBlobUrl] = useState(null);
  const [note, setNote] = useState("");
  const docNo = cfg.docNo || ("DOC-" + Date.now().toString().slice(-6));
  const fileName = docNo + ".pdf";

  // تجهيز ملف الـPDF تلقائياً عند فتح المعاينة
  useEffect(() => {
    let cancelled = false;
    const prepare = async () => {
      // ننتظر لحظة حتى يكتمل عرض المستند والخط
      await new Promise(r => setTimeout(r, 350));
      try {
        await ensureHtml2pdf();
        const b = await window.html2pdf().set({
          margin: [8, 8, 10, 8],
          image: { type: "jpeg", quality: 0.96 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        }).from(sheetRef.current).output("blob");
        if (cancelled) return;
        const url = URL.createObjectURL(b);
        setBlob(b); setBlobUrl(url); setState("ready");
      } catch (e) {
        if (!cancelled) setState("failed");
      }
    };
    prepare();
    return () => { cancelled = true; };
  }, []);
  useEffect(() => () => { if (blobUrl) URL.revokeObjectURL(blobUrl); }, [blobUrl]);

  // مشاركة أصلية (الأجهزة اللوحية/الهواتف): تفتح قائمة النظام ← واتساب والملف مرفق
  const shareFile = async () => {
    if (!blob) return;
    try {
      const f = new File([blob], fileName, { type: "application/pdf" });
      if (navigator.canShare && navigator.canShare({ files: [f] })) {
        await navigator.share({ files: [f], title: cfg.title });
      } else {
        setNote("المشاركة المباشرة غير مدعومة في هذا المتصفح — استخدم زر التنزيل ثم شارك الملف من جهازك.");
      }
    } catch (e) { /* المستخدم أغلق قائمة المشاركة */ }
  };

  const printDoc = () => {
    document.body.classList.add("nk-printing");
    const done = () => { document.body.classList.remove("nk-printing"); window.removeEventListener("afterprint", done); };
    window.addEventListener("afterprint", done);
    setTimeout(done, 3000);
    window.print();
  };

  const btn = (bg, color) => ({ background: bg, color, border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, padding: "8px 15px", cursor: "pointer", fontFamily: "inherit", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 5 });
  const hint = note
    || (state === "preparing" ? "⏳ جارٍ تجهيز ملف الـPDF تلقائياً..."
      : state === "failed" ? "تعذّر تجهيز الملف (تحقق من الإنترنت) — استخدم زر «طباعة / حفظ» واختر PDF."
        : "✅ الملف جاهز — نزّله أو شاركه عبر واتساب 📎 مباشرة");

  const D = { grn: "#1a5c2e", gold: "#c9a84c", gld: "#f0d080", mt: "#7a7870", crm: "#faf8f2" };
  const th = { background: D.grn, color: D.gld, padding: "7px 9px", textAlign: "right", fontSize: 11.5, fontWeight: 700 };
  const td = { padding: "6px 9px", borderBottom: "0.5px solid #e8e4d8", fontSize: 11.5, color: "#1a1a18" };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 700, background: "rgba(12,20,14,.75)", display: "flex", flexDirection: "column" }}>
      {/* شريط الأدوات */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: ".65rem .9rem", background: D.grn, boxShadow: "0 2px 12px rgba(0,0,0,.3)", flexWrap: "wrap" }}>
        <span style={{ color: D.gld, fontWeight: 700, fontSize: 13, flex: 1, minWidth: 130 }}>📄 {cfg.title}</span>
        {state === "ready" && (
          <>
            <a href={blobUrl} download={fileName} style={btn(D.gold, "#fff")}>⬇ تنزيل PDF</a>
            <button onClick={shareFile} style={btn("#25D366", "#fff")}>📤 مشاركة</button>
          </>
        )}
        {state === "preparing" && <span style={{ ...btn("rgba(255,255,255,.14)", "#fff"), cursor: "default" }}>⏳ تجهيز الملف...</span>}
        <button onClick={printDoc} style={btn("rgba(255,255,255,.14)", "#fff")}>🖨 طباعة / حفظ</button>
        <button onClick={onClose} style={btn("rgba(255,255,255,.14)", "#fff")}>✕ إغلاق</button>
      </div>
      <div style={{ background: state === "ready" ? "#e8f8ee" : "#fdf6e3", color: state === "ready" ? "#1a5c2e" : "#8a6a20", fontSize: 11.5, padding: "6px 14px", textAlign: "center" }}>
        {hint}
      </div>

      {/* المستند */}
      <div style={{ flex: 1, overflowY: "auto", padding: "18px 10px" }}>
        <div ref={sheetRef} className="nk-pdf-sheet" dir="rtl" style={{ maxWidth: 780, margin: "0 auto", background: "#fff", padding: "26px 30px", borderRadius: 6, boxShadow: "0 8px 30px rgba(0,0,0,.35)", fontFamily: "'Tajawal',sans-serif", color: "#1a1a18" }}>
          {/* الترويسة */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `2.5px solid ${D.gold}`, paddingBottom: 12, marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
              {s.logo ? <img src={s.logo} alt="" style={{ width: 54, height: 54, borderRadius: 12, objectFit: "cover" }} /> : <Crest size={54} />}
              <div>
                <div style={{ fontSize: 18, fontWeight: 900, color: D.grn }}>{s.clubName || "نادي النخيل"}</div>
                <div style={{ fontSize: 10.5, color: D.mt, marginTop: 2 }}>{s.clubSub || "النادي الرياضي الترفيهي"}</div>
              </div>
            </div>
            <div style={{ textAlign: "left", fontSize: 10.5, color: D.mt, lineHeight: 1.8 }}>
              {s.address || "مصراتة، ليبيا"}<br />هاتف: {s.phone || ""}<br />التاريخ: {new Date().toLocaleDateString("ar-LY")}
            </div>
          </div>

          <div style={{ textAlign: "center", margin: "4px 0 12px" }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: D.grn, borderBottom: `1.5px dashed ${D.gold}`, paddingBottom: 3 }}>{cfg.title}</span>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, background: D.crm, border: "0.5px solid rgba(201,168,76,.35)", borderRadius: 10, padding: "9px 13px", marginBottom: 12, fontSize: 11.5 }}>
            <span>{cfg.recipientLabel || "إلى"}: <b style={{ color: D.grn }}>{cfg.recipientName || "—"}</b></span>
            {cfg.recipientPhone && <span>الهاتف: <b style={{ color: D.grn }}>{cfg.recipientPhone}</b></span>}
            <span>رقم المستند: <b style={{ color: D.grn }}>{docNo}</b></span>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 12 }}>
            <thead><tr>{cfg.columns.map((c, i) => <th key={i} style={th}>{c}</th>)}</tr></thead>
            <tbody>{cfg.rows.map((r, ri) => (
              <tr key={ri} style={{ background: ri % 2 ? D.crm : "#fff" }}>{r.map((cell, ci) => <td key={ci} style={td}>{cell}</td>)}</tr>
            ))}</tbody>
          </table>

          {cfg.totals && cfg.totals.length > 0 && (
            <div style={{ display: "flex", marginBottom: 12 }}>
              <div style={{ minWidth: 250, border: "1px solid rgba(201,168,76,.5)", borderRadius: 10, overflow: "hidden" }}>
                {cfg.totals.map((t, i) => {
                  const last = i === cfg.totals.length - 1;
                  return (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "7px 13px", fontSize: last ? 13 : 12, borderBottom: last ? "none" : "0.5px solid rgba(201,168,76,.25)", background: last ? D.grn : "transparent", color: last ? D.gld : "#1a1a18", fontWeight: last ? 700 : 500 }}>
                      <span>{t[0]}</span><span>{t[1]}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {cfg.note && <div style={{ background: "#fdf6e3", border: `0.5px dashed ${D.gold}`, borderRadius: 9, padding: "8px 12px", fontSize: 11, color: "#8a6a20", marginBottom: 12 }}>📌 {cfg.note}</div>}

          <div style={{ marginTop: 24, display: "flex", justifyContent: "space-between", fontSize: 10.5, color: D.mt }}>
            <div style={{ width: 150, borderTop: "1px dashed #aaa", textAlign: "center", paddingTop: 4 }}>توقيع المستلم</div>
            <div style={{ width: 150, borderTop: "1px dashed #aaa", textAlign: "center", paddingTop: 4 }}>الختم / الإدارة</div>
          </div>
          <div style={{ textAlign: "center", fontSize: 10, color: D.mt, borderTop: "1px solid rgba(201,168,76,.4)", paddingTop: 8, marginTop: 10 }}>
            {s.invoiceFooter || "شكراً لتعاملكم — " + (s.clubName || "نادي النخيل")} — مستند مُولّد آلياً
          </div>
        </div>
      </div>
    </div>
  );
}

function toWaNumber(phone) {
  let d = (phone || "").replace(/\D/g, "");
  if (d.startsWith("0")) d = "218" + d.slice(1);
  return d;
}

/* ---- Shared new-customer modal (WhatsApp mandatory) ---- */
function NewCustomerModal({ ctx, onClose, onCreated }) {
  const { customers, setCustomers, setInvoices, invoices, user, showToast } = ctx;
  const cur = ctx.settings?.currency || "د.ل";
  const [f, setF] = useState({ name: "", phone: "", openingDebt: "", debtDate: todayISO() });
  const save = () => {
    if (!f.name.trim()) { showToast("أدخل اسم الزبون"); return; }
    const wa = toWaNumber(f.phone);
    if (!wa || wa.length < 10) { showToast("رقم الواتساب إلزامي وبصيغة صحيحة"); return; }
    const opening = Math.max(0, parseFloat(f.openingDebt) || 0);
    const c = { id: Math.max(0, ...customers.map(x => x.id)) + 1, name: f.name.trim(), phone: f.phone, wa, invoices: opening > 0 ? 1 : 0, total: opening, debt: opening, points: 0, last: opening > 0 ? f.debtDate : todayISO(), tier: "جديد" };
    setCustomers(cs => [...cs, c]);
    // دين سابق قبل استخدام النظام: يُسجَّل كفاتورة آجلة حقيقية — يدخل تلقائياً ضمن تنبيهات السداد والتحصيل والخزينة عند السداد
    if (opening > 0) {
      const invNum = "INV-OB-" + (invoices.filter(i => i.id.startsWith("INV-OB")).length + 1);
      setInvoices(iv => [{ id: invNum, customer: c.name, date: f.debtDate, source: "رصيد سابق", details: "رصيد افتتاحي — دين سابق قبل استخدام النظام", pay: "آجل", discount: "—", total: opening, cost: 0, status: "معلقة", dueDate: f.debtDate, by: user?.name || "—" }, ...iv]);
    }
    showToast(opening > 0 ? `تمت إضافة الزبون برصيد سابق ${fmt(opening)} ${cur}` : "تمت إضافة الزبون");
    onCreated ? onCreated(c) : onClose();
  };
  return (
    <Modal title="تسجيل زبون جديد" onClose={onClose} width={440}>
      <Field label="اسم الزبون *"><Inp value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></Field>
      <Field label="رقم الواتساب * (إلزامي)"><Inp value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} placeholder="0913-000-000" /></Field>
      {f.phone && <div style={{ fontSize: 11, color: C.mt, marginTop: -6, marginBottom: 10 }}>سيُحفظ كـ: {toWaNumber(f.phone) || "—"}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label={"دين سابق قبل النظام (" + cur + ") — اختياري"}><Inp type="number" min="0" value={f.openingDebt} onChange={e => setF({ ...f, openingDebt: e.target.value })} placeholder="0" /></Field>
        {parseFloat(f.openingDebt) > 0 && <Field label="تاريخ نشوء الدين"><Inp type="date" value={f.debtDate} onChange={e => setF({ ...f, debtDate: e.target.value })} /></Field>}
      </div>
      {parseFloat(f.openingDebt) > 0 && <div style={{ fontSize: 11, color: C.gdd, background: C.gold + "12", borderRadius: 8, padding: ".55rem .75rem", marginBottom: 10, lineHeight: 1.8 }}>سيُسجَّل هذا المبلغ كحساب آجل على الزبون — يظهر في تنبيهات السداد، ويمكن تحصيله جزئياً أو كاملاً لاحقاً من صفحة الزبون تماماً كأي دين آخر.</div>}
      <div style={{ fontSize: 11, color: C.gdd, background: C.gold + "12", borderRadius: 8, padding: ".55rem .75rem", marginBottom: 12 }}>لا يمكن إضافة زبون بدون رقم واتساب — يُستخدم لإرسال الفواتير والتقارير.</div>
      <div style={{ display: "flex", gap: 8 }}><Btn gold onClick={save} style={{ flex: 1, justifyContent: "center" }}>✓ حفظ الزبون</Btn><Btn onClick={onClose}>إلغاء</Btn></div>
    </Modal>
  );
}

/* ============================ CUSTOMERS ============================ */
function Customers({ ctx }) {
  const { customers, setCustomers, invoices, setInvoices, showToast, settings } = ctx;
  const [modal, setModal] = useState(false);
  const [q, setQ] = useState(() => (ctx.searchIntent && ctx.searchIntent.type === "customer") ? ctx.searchIntent.query : "");
  const [filter, setFilter] = useState("all"); // all | debt
  const [detail, setDetail] = useState(() => {
    if (ctx.searchIntent && ctx.searchIntent.type === "customer") {
      return (ctx.customers || []).find(c => c.id === ctx.searchIntent.id) || null;
    }
    return null;
  });
  useEffect(() => { if (ctx.searchIntent && ctx.searchIntent.type === "customer") ctx.setSearchIntent(null); }, []);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;
  const cur = settings?.currency || "د.ل";

  const shown = customers.filter(c => {
    if (!(c.name.includes(q) || c.phone.includes(q))) return false;
    if (filter === "debt") return (c.debt || 0) > 0;
    return true;
  });
  const totalPages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pageRows = shown.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);
  const totalDebt = customers.reduce((s, c) => s + (c.debt || 0), 0);
  const debtorsCount = customers.filter(c => (c.debt || 0) > 0).length;

  // تصنيف تلقائي: يُحسب من سجل مشتريات الزبون الفعلي — بمرور واحد على الفواتير (لا فلترة لكل زبون على حدة)
  const statsByName = useMemo(() => {
    const map = {};
    invoices.forEach(i => {
      if (i.status !== "مدفوعة") return;
      if (!map[i.customer]) map[i.customer] = { count: 0, total: 0 };
      map[i.customer].count++; map[i.customer].total += i.total;
    });
    return map;
  }, [invoices]);
  const custStats = (name) => statsByName[name] || { count: 0, total: 0 };
  const computeTier = (stats) => {
    if (stats.total >= 3000 || stats.count >= 15) return "VIP";
    if (stats.count === 0) return "جديد";
    return "نشط";
  };

  return (
    <>
      <PageTop title="نظام الزبائن" action={<Btn gold onClick={() => setModal(true)}>+ إضافة زبون</Btn>} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 11, marginBottom: "1.1rem" }}>
        <KCard label="إجمالي الزبائن" value={customers.length} sub="زبون مسجّل" bar={C.grl} />
        <KCard label="أصحاب حسابات آجلة" value={debtorsCount} sub="عليهم مستحقات" bar={C.gold} />
        <KCard label="إجمالي الديون الآجلة" value={fmt(totalDebt)} sub={cur} bar={C.red} />
      </div>
      <Card>
        <CardHead title="قائمة الزبائن" sub={`${fmt(shown.length)} زبون مطابق`} right={
          <div style={{ display: "flex", gap: 7 }}>
            <input value={q} onChange={e => { setQ(e.target.value); setPage(1); }} placeholder="بحث بالاسم أو الهاتف..." style={{ ...inputStyle, width: 170 }} />
            <Sel value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }} style={{ width: 150 }}>
              <option value="all">كل الزبائن</option>
              <option value="debt">أصحاب حسابات آجلة</option>
            </Sel>
          </div>
        } />
        <Table cols={[{ h: "الاسم", w: "20%" }, { h: "واتساب", w: "17%" }, { h: "الفواتير", w: "11%" }, { h: "إجمالي الشراء", w: "16%" }, { h: "الرصيد الآجل", w: "15%" }, { h: "التصنيف", w: "11%" }, { h: "عرض", w: "10%" }]}
          rows={pageRows.map(c => {
            const stats = custStats(c.name);
            const tier = computeTier(stats);
            return [
              <span style={{ fontWeight: 600 }}>{c.name}</span>,
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>{c.wa ? <span style={{ color: "#25D366" }}>📱</span> : "—"} {c.phone}</span>,
              stats.count, fmt(stats.total) + " " + cur,
              (c.debt || 0) > 0 ? <Badge tone="a">{fmt(c.debt)} {cur}</Badge> : <Badge tone="g">مسدّد</Badge>,
              <Badge tone={tier === "VIP" ? "gold" : tier === "جديد" ? "b" : "g"}>{tier === "VIP" ? "⭐ VIP" : tier}</Badge>,
              <Btn sm onClick={() => setDetail(c)}>عرض</Btn>,
            ];
          })} />
        {shown.length === 0 && <div style={{ textAlign: "center", color: C.mt, fontSize: 12.5, padding: "1.5rem" }}>لا زبائن مطابقون</div>}
        {totalPages > 1 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 12, paddingTop: 10, borderTop: `0.5px solid ${C.bc}` }}>
            <Btn sm onClick={() => setPage(p => Math.max(1, p - 1))} style={{ opacity: pageSafe === 1 ? .4 : 1 }}>‹ السابق</Btn>
            <span style={{ fontSize: 12, color: C.mt }}>صفحة {pageSafe} من {totalPages}</span>
            <Btn sm onClick={() => setPage(p => Math.min(totalPages, p + 1))} style={{ opacity: pageSafe === totalPages ? .4 : 1 }}>التالي ›</Btn>
          </div>
        )}
      </Card>

      {modal && <NewCustomerModal ctx={ctx} onClose={() => setModal(false)} onCreated={() => setModal(false)} />}
      {detail && <CustomerDetail ctx={ctx} customer={customers.find(c => c.id === detail.id)} onClose={() => setDetail(null)} />}
    </>
  );
}

/* ---- Customer detail: statement, receipt, WhatsApp reports ---- */
function CustomerDetail({ ctx, customer, onClose }) {
  const { invoices, setInvoices, customers, setCustomers, showToast, settings } = ctx;
  const cur = settings?.currency || "د.ل";
  const [payModal, setPayModal] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payVia, setPayVia] = useState("كاش");
  const c = customer;
  const custInvoices = invoices.filter(iv => iv.customer === c.name);
  const deferredInvoices = custInvoices.filter(iv => iv.pay === "آجل" && iv.status === "معلقة");

  /* receive a payment -> issue receipt, reduce debt, settle oldest deferred invoices */
  const receivePayment = () => {
    const amt = parseFloat(payAmount) || 0;
    if (amt <= 0) { showToast("أدخل مبلغاً صحيحاً"); return; }
    if (amt > (c.debt || 0)) { showToast("المبلغ أكبر من الرصيد الآجل"); return; }
    // settle oldest deferred invoices up to amount
    let remaining = amt;
    const sorted = [...deferredInvoices].sort((a, b) => a.date.localeCompare(b.date));
    const settledIds = [];
    for (const inv of sorted) {
      if (remaining >= inv.total) { remaining -= inv.total; settledIds.push(inv.id); }
    }
    setInvoices(iv => iv.map(x => settledIds.includes(x.id) ? { ...x, status: "مدفوعة", paidAt: todayISO(), paidVia: payVia } : x));
    setCustomers(cs => cs.map(x => x.id === c.id ? { ...x, debt: Math.max(0, (x.debt || 0) - amt) } : x));
    // سجّل الدفعة في سجل المدفوعات — تدخل الخزينة بيوم الاستلام وطريقته (تشمل الدفعات الجزئية)
    ctx.setPayments(ps => [{ id: "PY-" + Date.now(), date: todayISO(), kind: "قبض", party: c.name, via: payVia, amount: amt, by: ctx.user?.name || "—" }, ...ps]);
    // build receipt
    printReceipt(amt);
    showToast(`تم استلام ${fmt(amt)} ${cur} وإصدار الوصل`);
    setPayModal(false); setPayAmount("");
  };

  const printReceipt = (amt) => {
    const isThermal = settings?.printer === "xprinter";
    const w = window.open("", "_blank", `width=${isThermal ? 340 : 800},height=600`);
    const newDebt = Math.max(0, (c.debt || 0) - amt);
    w.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>وصل استلام</title>
    <style>@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap');*{box-sizing:border-box;margin:0;padding:0;font-family:${isThermal ? "monospace" : "'Tajawal',sans-serif"}}
    body{padding:${isThermal ? "10px" : "2cm"};direction:rtl;color:#1a1a18;${isThermal ? "width:80mm;" : ""}}
    .ttl{text-align:center;font-size:${isThermal ? "14px" : "18px"};font-weight:700;color:#1a5c2e}.sub{text-align:center;font-size:10px;color:#7a7870;margin-bottom:8px}
    .box{border:1px dashed #c9a84c;border-radius:8px;padding:${isThermal ? "8px" : "16px"};margin-top:10px}
    .r{display:flex;justify-content:space-between;font-size:${isThermal ? "11px" : "13px"};margin-bottom:6px}
    .big{font-size:${isThermal ? "18px" : "26px"};font-weight:700;color:#1a5c2e;text-align:center;margin:10px 0}
    .ft{text-align:center;font-size:10px;color:#7a7870;margin-top:14px;border-top:1px dashed #ccc;padding-top:8px}</style></head><body>
    <div class="ttl">🌴 ${settings?.clubName || "نادي النخيل"}</div><div class="sub">وصل استلام دفعة</div>
    <div class="box">
      <div class="r"><span>التاريخ:</span><span>${new Date().toLocaleDateString("ar-LY")}</span></div>
      <div class="r"><span>الزبون:</span><span>${c.name}</span></div>
      <div class="r"><span>الهاتف:</span><span>${c.phone}</span></div>
      <div class="big">${fmt(amt)} ${cur}</div>
      <div class="r"><span>الرصيد السابق:</span><span>${fmt(c.debt || 0)} ${cur}</span></div>
      <div class="r"><span>الرصيد المتبقي:</span><span>${fmt(newDebt)} ${cur}</span></div>
    </div>
    <div class="ft">${settings?.invoiceFooter || "شكراً لكم — نادي النخيل"}</div>
    <script>window.onload=function(){window.print();}<\/script></body></html>`);
    w.document.close();
  };

  /* WhatsApp: send total-balance report */
  const sendBalanceReport = () => {
    // 1) توليد PDF كشف الرصيد
    openPdfDoc(settings, {
      title: "كشف حساب — تقرير الرصيد",
      recipientLabel: "الزبون", recipientName: c.name, recipientPhone: c.phone,
      docNo: "BAL-" + c.id + "-" + Date.now().toString().slice(-4),
      columns: ["البند", "القيمة"],
      rows: [
        ["إجمالي المشتريات", fmt(c.total) + " " + cur],
        ["عدد الفواتير", c.invoices],
        ["الفواتير الآجلة غير المسددة", deferredInvoices.length],
      ],
      totals: [["الرصيد الآجل المستحق", fmt(c.debt || 0) + " " + cur]],
      note: (c.debt || 0) > 0 ? "نرجو التكرم بتسديد المبلغ المستحق في أقرب وقت ممكن. شكراً لتعاملكم معنا." : "لا توجد مستحقات — شكراً لتعاملكم!",
    });
    showToast("فُتح تقرير الرصيد — احفظه كـ PDF ثم شاركه عبر واتساب الزبون");
  };

  /* PDF + WhatsApp: full invoices report */
  const sendInvoicesReport = () => {
    openPdfDoc(settings, {
      title: "تقرير الفواتير الكامل",
      recipientLabel: "الزبون", recipientName: c.name, recipientPhone: c.phone,
      docNo: "INV-R-" + c.id + "-" + Date.now().toString().slice(-4),
      columns: ["#", "رقم الفاتورة", "التاريخ", "التفاصيل", "الدفع", "المبلغ", "الحالة"],
      rows: custInvoices.length
        ? custInvoices.map((iv, i) => [i + 1, "#" + iv.id, arDate(iv.date), iv.details || "—", iv.pay, fmt(iv.total) + " " + cur, iv.status])
        : [["—", "لا توجد فواتير مسجّلة", "", "", "", "", ""]],
      totals: [
        ["إجمالي المشتريات", fmt(c.total) + " " + cur],
        ["الرصيد الآجل المستحق", fmt(c.debt || 0) + " " + cur],
      ],
      note: "هذا التقرير يشمل كامل الفواتير المسجّلة على حسابكم حتى تاريخه.",
    });
    showToast("فُتح تقرير الفواتير — احفظه كـ PDF ثم شاركه عبر واتساب الزبون");
  };

  const PAY_TONE = { "كاش": "g", "بطاقة": "b", "تحويل": "p", "آجل": "a" };
  return (
    <Modal title={`ملف الزبون — ${c.name}`} onClose={onClose} width={620}>
      {/* header stats */}
      <div style={{ display: "grid", gridTemplateColumns: settings?.loyaltyOn ? "repeat(4,1fr)" : "repeat(3,1fr)", gap: 10, marginBottom: 14 }}>
        <div style={{ background: C.crm, borderRadius: 10, padding: ".7rem", textAlign: "center" }}><div style={{ fontSize: 17, fontWeight: 700, color: C.grn2 }}>{fmt(c.total)}</div><div style={{ fontSize: 10, color: C.mt }}>إجمالي المشتريات ({cur})</div></div>
        <div style={{ background: C.crm, borderRadius: 10, padding: ".7rem", textAlign: "center" }}><div style={{ fontSize: 17, fontWeight: 700 }}>{c.invoices}</div><div style={{ fontSize: 10, color: C.mt }}>عدد الفواتير</div></div>
        <div style={{ background: (c.debt || 0) > 0 ? C.redbg : "#e1f4e8", borderRadius: 10, padding: ".7rem", textAlign: "center" }}><div style={{ fontSize: 17, fontWeight: 700, color: (c.debt || 0) > 0 ? C.red : "#1a5c2e" }}>{fmt(c.debt || 0)}</div><div style={{ fontSize: 10, color: C.mt }}>الرصيد الآجل ({cur})</div></div>
        {settings?.loyaltyOn && <div style={{ background: "#fff7eb", borderRadius: 10, padding: ".7rem", textAlign: "center" }}><div style={{ fontSize: 17, fontWeight: 700, color: C.gdd }}>🎁 {c.points || 0}</div><div style={{ fontSize: 10, color: C.mt }}>نقاط الولاء</div></div>}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.mt, marginBottom: 12 }}>
        <span style={{ color: "#25D366", fontSize: 15 }}>📱</span> واتساب: {c.phone}
      </div>

      {/* actions */}
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 14 }}>
        {(c.debt || 0) > 0 && <Btn gold onClick={() => setPayModal(true)}>💵 استلام دفعة + وصل</Btn>}
        <Btn onClick={sendBalanceReport} style={{ borderColor: "#25D366", color: "#128C4B" }}>📄 تقرير الرصيد PDF</Btn>
        <Btn onClick={sendInvoicesReport} style={{ borderColor: "#25D366", color: "#128C4B" }}>📄 تقرير الفواتير PDF</Btn>
      </div>

      {/* invoices list */}
      <div style={{ fontSize: 12, fontWeight: 700, color: C.mt, marginBottom: 8 }}>سجل فواتير الزبون ({custInvoices.length})</div>
      <div style={{ maxHeight: 220, overflowY: "auto" }}>
        <Table cols={[{ h: "رقم", w: "22%" }, { h: "التاريخ", w: "22%" }, { h: "الدفع", w: "18%" }, { h: "المبلغ", w: "20%" }, { h: "الحالة", w: "18%" }]}
          rows={custInvoices.length ? custInvoices.map(iv => ["#" + iv.id, arDate(iv.date), <Badge tone={PAY_TONE[iv.pay] || "g"}>{iv.pay}</Badge>, fmt(iv.total) + " " + cur, <Badge tone={iv.status === "مدفوعة" ? "g" : iv.status === "ملغاة" ? "r" : "a"}>{iv.status}</Badge>]) : [["—", "لا توجد فواتير", "", "", ""]]} />
      </div>

      {payModal && (
        <Modal title="استلام دفعة من الرصيد الآجل" onClose={() => setPayModal(false)} width={400}>
          <div style={{ textAlign: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: C.mt }}>الرصيد الآجل المستحق</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: C.red }}>{fmt(c.debt || 0)} {cur}</div>
          </div>
          <Field label="المبلغ المستلم"><Inp type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder="0.00" /></Field>
          <Field label="طريقة الاستلام">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
              {["كاش", "بطاقة", "تحويل"].map(m => (
                <div key={m} onClick={() => setPayVia(m)} style={{ border: `1px solid ${payVia === m ? C.gold : C.bc}`, borderRadius: 8, padding: ".4rem", textAlign: "center", cursor: "pointer", fontSize: 12, fontWeight: payVia === m ? 700 : 500, background: payVia === m ? C.gold + "14" : C.crm }}>{m}</div>
              ))}
            </div>
          </Field>
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            <Btn sm onClick={() => setPayAmount(String(c.debt || 0))}>المبلغ كامل</Btn>
            <Btn sm onClick={() => setPayAmount(String(Math.round((c.debt || 0) / 2)))}>النصف</Btn>
          </div>
          <div style={{ fontSize: 11, color: C.mt, marginBottom: 12 }}>سيتم إصدار وصل استلام قابل للطباعة، وتسوية الفواتير الآجلة تلقائياً حسب المبلغ.</div>
          <div style={{ display: "flex", gap: 8 }}><Btn gold onClick={receivePayment} style={{ flex: 1, justifyContent: "center" }}>✓ تأكيد وإصدار الوصل</Btn><Btn onClick={() => setPayModal(false)}>إلغاء</Btn></div>
        </Modal>
      )}
    </Modal>
  );
}

/* ============================ COUPONS ============================ */
/* ============================ ASSETS (موارد النادي) ============================ */
/* ============================ RENTAL DEVICES (تأجير الأجهزة الإلكترونية) ============================ */
function RentalDevices({ ctx }) {
  const { rentalDevices, setRentalDevices, rentals, setRentals, setInvoices, invoices, user, showToast, settings } = ctx;
  const cur = settings?.currency || "د.ل";
  const [, force] = useState(0);
  useEffect(() => { const t = setInterval(() => force(x => x + 1), 30000); return () => clearInterval(t); }, []); // تحديث العدّادات كل 30ث

  const [devModal, setDevModal] = useState(false);
  const [devForm, setDevForm] = useState({ name: "", buyPrice: "", dailyRate: "" });
  const [rentModal, setRentModal] = useState(null); // device being rented
  const nowIso = () => { const d = new Date(); d.setSeconds(0, 0); return d.toISOString().slice(0, 16); };
  const [rentForm, setRentForm] = useState({ customer: "", phone: "", days: 1, startAt: nowIso(), pay: "كاش" });
  const [detail, setDetail] = useState(null); // rental being viewed for return/reminder

  const addDevice = () => {
    if (!devForm.name.trim()) { showToast("أدخل اسم الجهاز"); return; }
    if (!devForm.dailyRate) { showToast("أدخل سعر الإيجار اليومي"); return; }
    setRentalDevices(ds => [...ds, { id: "RD-" + Date.now(), name: devForm.name.trim(), buyPrice: parseFloat(devForm.buyPrice) || 0, dailyRate: parseFloat(devForm.dailyRate) || 0, status: "available", addedAt: todayISO() }]);
    showToast("تمت إضافة الجهاز");
    setDevModal(false); setDevForm({ name: "", buyPrice: "", dailyRate: "" });
  };

  const activeRentalOf = (deviceId) => rentals.find(r => r.deviceId === deviceId && r.status !== "مُرجَع");

  const openRent = (device) => { setRentForm({ customer: "", phone: "", days: 1, startAt: nowIso(), pay: "كاش" }); setRentModal(device); };

  const confirmRent = () => {
    if (!rentForm.customer.trim()) { showToast("أدخل اسم الزبون"); return; }
    const wa = toWaNumber(rentForm.phone);
    if (!wa || wa.length < 10) { showToast("رقم واتساب الزبون إلزامي وبصيغة صحيحة"); return; }
    const days = Math.max(1, parseInt(rentForm.days) || 1);
    const device = rentModal;
    const startAt = new Date(rentForm.startAt);
    const endAt = new Date(startAt.getTime() + days * 86400000);
    const total = Math.round(device.dailyRate * days * 100) / 100;
    const rid = "RT-" + Date.now();

    setRentals(rs => [{
      id: rid, deviceId: device.id, deviceName: device.name, customer: rentForm.customer.trim(), phone: rentForm.phone, wa, days,
      startAt: startAt.toISOString(), endAt: endAt.toISOString(), dailyRate: device.dailyRate, total, status: "نشط",
      returnedAt: null, alertSent: false, by: user?.name || "—",
    }, ...rs]);
    setRentalDevices(ds => ds.map(d => d.id === device.id ? { ...d, status: "rented" } : d));

    // إنشاء فاتورة (بلا تكلفة بضاعة — التأجير ليس استهلاكاً للمخزون)
    const invNum = "INV-RT-" + (invoices.filter(i => i.id.startsWith("INV-RT")).length + 1);
    setInvoices(iv => [{ id: invNum, customer: rentForm.customer.trim(), date: todayISO(), source: "تأجير", details: `تأجير ${device.name} — ${days} يوم`, pay: rentForm.pay, discount: "—", total, cost: 0, status: "مدفوعة", by: user?.name || "—", time: new Date().toTimeString().slice(0, 5) }, ...iv]);

    showToast(`تم تأجير ${device.name} لـ${rentForm.customer.trim()} — ${fmt(total)} ${cur}`);
    setRentModal(null);
  };

  const returnDevice = (rental) => {
    if (!window.confirm(`تأكيد استرجاع «${rental.deviceName}» من ${rental.customer}؟`)) return;
    setRentals(rs => rs.map(r => r.id === rental.id ? { ...r, status: "مُرجَع", returnedAt: new Date().toISOString() } : r));
    setRentalDevices(ds => ds.map(d => d.id === rental.deviceId ? { ...d, status: "available" } : d));
    showToast(`تم استرجاع ${rental.deviceName}`);
    setDetail(null);
  };

  const sendEndReminder = (rental) => {
    const endTime = new Date(rental.endAt).toLocaleString("ar-LY", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });
    const msg = [
      `🌴 *${settings?.clubName || "نادي النخيل"}* — تذكير بموعد إرجاع الجهاز`,
      `عزيزنا ${rental.customer}،`,
      "",
      `نود تذكيركم بأن مدة تأجير جهاز *${rental.deviceName}* تنتهي في ${endTime}.`,
      "نرجو التكرم بإرجاع الجهاز في الموعد المحدد. شكراً لتعاملكم معنا 🌴",
    ].join("\n");
    window.open(`https://wa.me/${rental.wa}?text=${encodeURIComponent(msg)}`, "_blank");
    setRentals(rs => rs.map(r => r.id === rental.id ? { ...r, alertSent: true } : r));
    showToast(`تم فتح واتساب لتذكير ${rental.customer}`);
  };

  const now = Date.now();
  const msLeft = (r) => new Date(r.endAt).getTime() - now;
  const fmtCountdown = (ms) => {
    const over = ms < 0; const abs = Math.abs(ms);
    const h = Math.floor(abs / 3600000), m = Math.floor((abs % 3600000) / 60000);
    return (over ? "-" : "") + h + "س " + m + "د";
  };

  const activeRentals = rentals.filter(r => r.status !== "مُرجَع").sort((a, b) => new Date(a.endAt) - new Date(b.endAt));
  const endingSoon = activeRentals.filter(r => msLeft(r) <= 3600000); // خلال ساعة أو متأخر
  const availableCount = rentalDevices.filter(d => d.status === "available").length;
  const rentedCount = rentalDevices.filter(d => d.status === "rented").length;
  const totalRevenue = rentals.reduce((s, r) => s + r.total, 0);

  return (
    <>
      <PageTop title="🔌 تأجير الأجهزة الإلكترونية" action={<Btn gold onClick={() => { setDevForm({ name: "", buyPrice: "", dailyRate: "" }); setDevModal(true); }}>+ إضافة جهاز</Btn>} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 11, marginBottom: "1.1rem" }}>
        <KCard label="إجمالي الأجهزة" value={rentalDevices.length} sub="جهاز" bar={C.gold} />
        <KCard label="متاحة الآن" value={availableCount} sub="جاهزة للتأجير" bar="#1a8c3e" />
        <KCard label="مؤجَّرة حالياً" value={rentedCount} sub="جهاز" bar="#2a78d6" />
        <KCard label="إجمالي إيراد التأجير" value={fmt(totalRevenue)} sub={cur} bar={C.purp} />
      </div>

      {endingSoon.length > 0 && (
        <Card style={{ marginBottom: "1.1rem", background: "linear-gradient(135deg,#fdeaea,#fff)", border: "1px solid rgba(192,57,43,.3)" }}>
          <CardHead title="⏰ أجهزة تنتهي مدتها قريباً أو متأخرة" sub="أرسل تذكيراً للزبون عبر واتساب قبل انتهاء الموعد" />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {endingSoon.map(r => {
              const ms = msLeft(r); const over = ms < 0;
              return (
                <div key={r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, background: "#fff", borderRadius: 9, padding: ".6rem .85rem" }}>
                  <div style={{ fontSize: 12.5 }}>
                    <b>{r.deviceName}</b> — {r.customer} <span style={{ color: over ? C.red : "#8a6a20", fontWeight: 700, marginRight: 6 }}>{over ? `متأخر ${fmtCountdown(ms)}` : `متبقٍ ${fmtCountdown(ms)}`}</span>
                  </div>
                  <Btn sm gold onClick={() => sendEndReminder(r)}>📱 {r.alertSent ? "إعادة إرسال التذكير" : "إرسال تذكير واتساب"}</Btn>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Card style={{ marginBottom: "1.1rem" }}>
        <CardHead title="الأجهزة" sub={`${rentalDevices.length} جهاز`} />
        {rentalDevices.length === 0 ? (
          <div style={{ textAlign: "center", color: C.mt, padding: "1.5rem" }}>لا أجهزة بعد — أضف أول جهاز للتأجير.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 11 }}>
            {rentalDevices.map(d => {
              const active = activeRentalOf(d.id);
              return (
                <div key={d.id} className="nk-card-hover" style={{ border: `1px solid ${active ? "rgba(42,120,214,.35)" : C.bc}`, borderRadius: 12, padding: ".85rem", background: active ? "#f0f6fd" : C.crm }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700 }}>🔌 {d.name}</div>
                    <Badge tone={active ? "b" : "g"}>{active ? "مؤجَّر" : "متاح"}</Badge>
                  </div>
                  <div style={{ fontSize: 11, color: C.mt, marginBottom: 8 }}>سعر الشراء {fmt(d.buyPrice)} {cur} · إيجار {fmt(d.dailyRate)} {cur}/يوم</div>
                  {active ? (
                    <>
                      <div style={{ fontSize: 12, color: C.k2, marginBottom: 2 }}>👤 {active.customer}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: msLeft(active) < 0 ? C.red : msLeft(active) <= 3600000 ? "#8a6a20" : "#2a78d6", marginBottom: 8 }}>
                        {msLeft(active) < 0 ? "⏰ متأخر " : "⏳ متبقٍ "}{fmtCountdown(msLeft(active))}
                      </div>
                      <Btn sm onClick={() => returnDevice(active)} style={{ width: "100%", justifyContent: "center" }}>↩ استرجاع الجهاز</Btn>
                    </>
                  ) : (
                    <Btn sm gold onClick={() => openRent(d)} style={{ width: "100%", justifyContent: "center" }}>🏷 تأجير الآن</Btn>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card>
        <CardHead title="سجل عمليات التأجير" sub={`${rentals.length} عملية`} />
        {rentals.length === 0 ? <div style={{ textAlign: "center", color: C.mt, padding: "1.5rem" }}>لا عمليات تأجير بعد.</div> : (
          <Table cols={[{ h: "الجهاز", w: "16%" }, { h: "الزبون", w: "16%" }, { h: "الأيام", w: "8%" }, { h: "الاستلام", w: "15%" }, { h: "الانتهاء", w: "15%" }, { h: "الإجمالي", w: "12%" }, { h: "الحالة", w: "10%" }, { h: "", w: "8%" }]}
            rows={rentals.slice(0, 100).map(r => [
              r.deviceName, r.customer, r.days,
              new Date(r.startAt).toLocaleString("ar-LY", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }),
              new Date(r.endAt).toLocaleString("ar-LY", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }),
              fmt(r.total) + " " + cur,
              <Badge tone={r.status === "مُرجَع" ? "g" : msLeft(r) < 0 ? "r" : "b"}>{r.status === "مُرجَع" ? "مُرجَع" : msLeft(r) < 0 ? "متأخر" : "نشط"}</Badge>,
              r.status !== "مُرجَع" ? <Btn sm onClick={() => returnDevice(r)}>إرجاع</Btn> : "—",
            ])} />
        )}
      </Card>

      {/* نافذة إضافة جهاز */}
      {devModal && (
        <Modal title="إضافة جهاز جديد للتأجير" onClose={() => setDevModal(false)} width={440}>
          <Field label="اسم الجهاز *"><Inp value={devForm.name} onChange={e => setDevForm({ ...devForm, name: e.target.value })} placeholder="مثال: جهاز بروجكتور، PS5 محمول..." /></Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label={"سعر الشراء (" + cur + ")"}><Inp type="number" value={devForm.buyPrice} onChange={e => setDevForm({ ...devForm, buyPrice: e.target.value })} placeholder="0" /></Field>
            <Field label={"سعر الإيجار اليومي (" + cur + ") *"}><Inp type="number" value={devForm.dailyRate} onChange={e => setDevForm({ ...devForm, dailyRate: e.target.value })} placeholder="0" /></Field>
          </div>
          <div style={{ display: "flex", gap: 8 }}><Btn gold onClick={addDevice} style={{ flex: 1, justifyContent: "center" }}>✓ إضافة</Btn><Btn onClick={() => setDevModal(false)}>إلغاء</Btn></div>
        </Modal>
      )}

      {/* نافذة تأجير جهاز */}
      {rentModal && (
        <Modal title={`تأجير — ${rentModal.name}`} onClose={() => setRentModal(null)} width={460}>
          <Field label="اسم الزبون *"><Inp value={rentForm.customer} onChange={e => setRentForm({ ...rentForm, customer: e.target.value })} placeholder="الاسم الكامل" /></Field>
          <Field label="رقم واتساب الزبون * (إلزامي)"><Inp value={rentForm.phone} onChange={e => setRentForm({ ...rentForm, phone: e.target.value })} placeholder="0913-000-000" /></Field>
          {rentForm.phone && <div style={{ fontSize: 11, color: C.mt, marginTop: -6, marginBottom: 10 }}>سيُحفظ كـ: {toWaNumber(rentForm.phone) || "—"} — سيُستخدم لإرسال تذكير قبل انتهاء المدة</div>}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="المدة (أيام)"><Inp type="number" min="1" value={rentForm.days} onChange={e => setRentForm({ ...rentForm, days: e.target.value })} /></Field>
            <Field label="تاريخ ووقت الاستلام"><Inp type="datetime-local" value={rentForm.startAt} onChange={e => setRentForm({ ...rentForm, startAt: e.target.value })} /></Field>
          </div>
          <Field label="طريقة الدفع">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
              {["كاش", "بطاقة", "تحويل"].map(m => (
                <div key={m} onClick={() => setRentForm({ ...rentForm, pay: m })} style={{ border: `1px solid ${rentForm.pay === m ? C.gold : C.bc}`, borderRadius: 8, padding: ".4rem", textAlign: "center", cursor: "pointer", fontSize: 12, fontWeight: rentForm.pay === m ? 700 : 500, background: rentForm.pay === m ? C.gold + "14" : C.crm }}>{m}</div>
              ))}
            </div>
          </Field>
          <div style={{ background: "rgba(26,140,62,.07)", border: "0.5px solid rgba(26,140,62,.2)", borderRadius: 9, padding: ".6rem .85rem", margin: ".6rem 0 1rem", display: "flex", justifyContent: "space-between", fontSize: 13 }}>
            <span style={{ color: C.mt, fontWeight: 600 }}>الإجمالي المستحق</span>
            <span style={{ fontWeight: 800, color: C.grn2 }}>{fmt(Math.round(rentModal.dailyRate * (Math.max(1, parseInt(rentForm.days) || 1)) * 100) / 100)} {cur}</span>
          </div>
          <div style={{ fontSize: 10.5, color: C.mt, marginBottom: 10, lineHeight: 1.7 }}>💡 سيصلك تنبيه في جرس الإشعارات قبل ساعة من انتهاء المدة لتذكير الزبون — يبقى إرسال رسالة التذكير الفعلية بضغطة زر (لأن النظام يعمل من المتصفح ولا يرسل رسائل تلقائياً في الخلفية).</div>
          <div style={{ display: "flex", gap: 8 }}><Btn gold onClick={confirmRent} style={{ flex: 1, justifyContent: "center" }}>✓ تأكيد التأجير والدفع</Btn><Btn onClick={() => setRentModal(null)}>إلغاء</Btn></div>
        </Modal>
      )}
    </>
  );
}

function Assets({ ctx }) {
  const { assets, setAssets, suppliers, setSuppliers, user, showToast } = ctx;
  const cur = ctx.settings?.currency || "د.ل";
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [modal, setModal] = useState(false);
  const [supModal, setSupModal] = useState(false);
  const [actionAsset, setActionAsset] = useState(null); // { asset, type }
  const [detail, setDetail] = useState(null);

  const empty = { name: "", cat: "أجهزة ألعاب", qty: 1, addedAt: todayISO(), supplier: "", cost: "" };
  const [f, setF] = useState(empty);
  const [newSup, setNewSup] = useState({ name: "", phone: "", spec: "" });
  const [act, setAct] = useState({ date: todayISO(), note: "", cost: "" });

  const CATS_A = ["أجهزة ألعاب", "معدات رياضية", "أثاث", "إلكترونيات", "أخرى"];
  const counts = {
    all: assets.length,
    active: assets.filter(a => a.status === "active").length,
    maintenance: assets.filter(a => a.status === "maintenance").length,
    damaged: assets.filter(a => a.status === "damaged").length,
    lost: assets.filter(a => a.status === "lost").length,
  };
  const shown = assets.filter(a => (filter === "all" || a.status === filter) && (a.name.includes(q) || a.cat.includes(q)));
  const totalValue = assets.filter(a => a.status !== "lost" && a.status !== "damaged").reduce((s, a) => s + (a.cost || 0) * (a.qty || 1), 0);

  const addAsset = () => {
    if (!f.name.trim()) { showToast("أدخل اسم المورد"); return; }
    setAssets(a => [...a, { id: "a" + Date.now(), name: f.name.trim(), cat: f.cat, qty: parseInt(f.qty) || 1, addedAt: f.addedAt, supplier: f.supplier, cost: parseFloat(f.cost) || 0, status: "active", history: [] }]);
    showToast("تمت إضافة المورد للنادي"); setModal(false); setF(empty);
  };

  // تنفيذ إجراء على مورد: صيانة / تلف / فقد / إرجاع من صيانة
  const applyAction = () => {
    const { asset, type } = actionAsset;
    setAssets(list => list.map(a => {
      if (a.id !== asset.id) return a;
      const hist = [...(a.history || [])];
      const doneBy = user?.name || "—";
      if (type === "maintenance") {
        hist.push({ event: "إرسال للصيانة", date: act.date, note: act.note || "—", by: doneBy });
        return { ...a, status: "maintenance", history: hist, maintStart: act.date };
      }
      if (type === "return") {
        hist.push({ event: "عاد من الصيانة", date: act.date, from: a.maintStart, note: act.note || "تم الإصلاح", cost: parseFloat(act.cost) || 0, by: doneBy });
        return { ...a, status: "active", history: hist, maintStart: null };
      }
      if (type === "damaged") { hist.push({ event: "سُجّل كتالف", date: act.date, note: act.note || "—", by: doneBy }); return { ...a, status: "damaged", history: hist, damagedAt: act.date }; }
      if (type === "lost") { hist.push({ event: "سُجّل كمفقود", date: act.date, note: act.note || "—", by: doneBy }); return { ...a, status: "lost", history: hist, lostAt: act.date }; }
      if (type === "restore") { hist.push({ event: "أُعيد للخدمة", date: act.date, note: act.note || "—", by: doneBy }); return { ...a, status: "active", history: hist }; }
      return a;
    }));
    const labels = { maintenance: "أُرسل للصيانة", return: "عاد من الصيانة", damaged: "سُجّل كتالف", lost: "سُجّل كمفقود", restore: "أُعيد للخدمة" };
    showToast(`${asset.name}: ${labels[type]}`);
    setActionAsset(null); setAct({ date: todayISO(), note: "", cost: "" });
  };

  const actionTitle = (type) => ({ maintenance: "إرسال للصيانة", return: "إرجاع من الصيانة", damaged: "تسجيل كتالف", lost: "تسجيل كمفقود", restore: "إعادة للخدمة" }[type]);

  return (
    <>
      <PageTop title="موارد النادي" action={<Btn gold onClick={() => { setF(empty); setModal(true); }}>+ إضافة مورد</Btn>} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 11, marginBottom: "1.1rem" }}>
        <KCard label="إجمالي الموارد" value={counts.all} sub="عنصر" bar={C.gold} />
        <KCard label="قيمة الموجودات" value={fmt(totalValue)} sub={cur} bar="#1a8c3e" />
        <KCard label="في الصيانة" value={counts.maintenance} sub="حالياً" bar="#2a78d6" />
        <KCard label="تالف / مفقود" value={counts.damaged + counts.lost} sub="عنصر" bar={C.red} />
      </div>

      <Card>
        <CardHead title="سجل الموارد" right={<input value={q} onChange={e => setQ(e.target.value)} placeholder="بحث..." style={{ ...inputStyle, width: 150 }} />} />
        {/* شرائح الفلترة حسب الحالة */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          {[["all", "الكل", C.gold], ["active", "موجود ✅", "#1a8c3e"], ["maintenance", "صيانة 🔧", "#2a78d6"], ["damaged", "تالف ⚠️", "#c0392b"], ["lost", "مفقود ❓", "#8a6a20"]].map(([k, l, c]) => (
            <span key={k} onClick={() => setFilter(k)} style={{ cursor: "pointer", fontSize: 11.5, fontWeight: 600, padding: ".35rem .85rem", borderRadius: 20, background: filter === k ? c : C.crm, color: filter === k ? "#fff" : C.k2, border: `0.5px solid ${filter === k ? c : C.bc}` }}>{l} ({counts[k]})</span>
          ))}
        </div>

        <div className="nk-tbl-wrap">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>{["المورد", "الفئة", "العدد", "تاريخ الإضافة", "التكلفة", "الحالة", "إجراءات"].map((h, i) => <th key={i} style={{ background: C.grn, color: C.gld, padding: "8px 10px", textAlign: "right", fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap" }}>{h}</th>)}</tr></thead>
            <tbody>
              {shown.map(a => {
                const st = ASSET_STATUS[a.status];
                return (
                  <tr key={a.id} style={{ borderBottom: `0.5px solid ${C.bc}` }}>
                    <td style={{ padding: "8px 10px", fontSize: 12.5, fontWeight: 600 }}>{a.name}</td>
                    <td style={{ padding: "8px 10px", fontSize: 12, color: C.mt }}>{a.cat}</td>
                    <td style={{ padding: "8px 10px", fontSize: 12 }}>{a.qty}</td>
                    <td style={{ padding: "8px 10px", fontSize: 11.5, color: C.mt }}>{arDate(a.addedAt)}</td>
                    <td style={{ padding: "8px 10px", fontSize: 12 }}>{a.cost ? fmt(a.cost) + " " + cur : "—"}</td>
                    <td style={{ padding: "8px 10px" }}><Badge tone={st.tone}>{st.icon} {st.label}</Badge></td>
                    <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        <button onClick={() => setDetail(a)} title="السجل" style={actBtn(C.mt)}>📋</button>
                        {a.status === "active" && <>
                          <button onClick={() => { setActionAsset({ asset: a, type: "maintenance" }); setAct({ date: todayISO(), note: "", cost: "" }); }} title="صيانة" style={actBtn("#2a78d6")}>🔧</button>
                          <button onClick={() => { setActionAsset({ asset: a, type: "damaged" }); setAct({ date: todayISO(), note: "", cost: "" }); }} title="تالف" style={actBtn("#c0392b")}>⚠️</button>
                          <button onClick={() => { setActionAsset({ asset: a, type: "lost" }); setAct({ date: todayISO(), note: "", cost: "" }); }} title="مفقود" style={actBtn("#8a6a20")}>❓</button>
                        </>}
                        {a.status === "maintenance" && <button onClick={() => { setActionAsset({ asset: a, type: "return" }); setAct({ date: todayISO(), note: "", cost: "" }); }} title="إرجاع من الصيانة" style={actBtn("#1a8c3e")}>✅ إرجاع</button>}
                        {(a.status === "damaged" || a.status === "lost") && <button onClick={() => { setActionAsset({ asset: a, type: "restore" }); setAct({ date: todayISO(), note: "", cost: "" }); }} title="إعادة للخدمة" style={actBtn("#1a8c3e")}>↩ إرجاع</button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {shown.length === 0 && <div style={{ textAlign: "center", color: C.mt, fontSize: 12.5, padding: "2rem" }}>لا موارد مطابقة</div>}
        </div>
      </Card>

      {/* نافذة الإجراء */}
      {actionAsset && (
        <Modal title={`${actionTitle(actionAsset.type)} — ${actionAsset.asset.name}`} onClose={() => setActionAsset(null)} width={440}>
          <Field label="التاريخ"><Inp type="date" value={act.date} onChange={e => setAct({ ...act, date: e.target.value })} /></Field>
          {actionAsset.type === "return" ? (
            <>
              <Field label="العطل الذي تم إصلاحه"><Inp value={act.note} onChange={e => setAct({ ...act, note: e.target.value })} placeholder="مثال: استبدال زر التحكم" /></Field>
              <Field label={"تكلفة الإصلاح (" + cur + ")"}><Inp type="number" value={act.cost} onChange={e => setAct({ ...act, cost: e.target.value })} placeholder="0" /></Field>
              {actionAsset.asset.maintStart && <div style={{ fontSize: 11.5, color: C.mt, background: C.crm, borderRadius: 8, padding: ".5rem .7rem", marginBottom: 10 }}>مدة الصيانة: من {arDate(actionAsset.asset.maintStart)} إلى {arDate(act.date)} ({daysBetween(actionAsset.asset.maintStart, act.date)} يوم)</div>}
            </>
          ) : (
            <Field label={actionAsset.type === "maintenance" ? "وصف العطل" : "ملاحظة"}><Inp value={act.note} onChange={e => setAct({ ...act, note: e.target.value })} placeholder={actionAsset.type === "maintenance" ? "مثال: لا يستجيب زر X" : "سبب التلف/الفقد"} /></Field>
          )}
          <div style={{ display: "flex", gap: 8 }}><Btn gold onClick={applyAction} style={{ flex: 1, justifyContent: "center" }}>✓ تأكيد</Btn><Btn onClick={() => setActionAsset(null)}>إلغاء</Btn></div>
        </Modal>
      )}

      {/* نافذة سجل المورد */}
      {detail && (
        <Modal title={`سجل — ${detail.name}`} onClose={() => setDetail(null)} width={520}>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", background: C.crm, borderRadius: 10, padding: ".7rem 1rem", marginBottom: 12, fontSize: 12 }}>
            <span>الفئة: <b>{detail.cat}</b></span><span>العدد: <b>{detail.qty}</b></span>
            <span>أُضيف: <b>{arDate(detail.addedAt)}</b></span>
            {detail.supplier && <span>المورّد: <b>{detail.supplier}</b></span>}
            <span>الحالة: <Badge tone={ASSET_STATUS[detail.status].tone}>{ASSET_STATUS[detail.status].icon} {ASSET_STATUS[detail.status].label}</Badge></span>
          </div>
          {(!detail.history || detail.history.length === 0) ? <div style={{ textAlign: "center", color: C.mt, fontSize: 12.5, padding: "1.5rem" }}>لا أحداث مسجّلة — المورد بحالته الأصلية.</div> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {detail.history.map((h, i) => (
                <div key={i} style={{ borderRight: `3px solid ${C.gold}`, background: C.crm, borderRadius: 8, padding: ".55rem .8rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, fontWeight: 700 }}><span>{h.event}</span><span style={{ color: C.mt, fontWeight: 500 }}>{arDate(h.date)}</span></div>
                  {h.note && h.note !== "—" && <div style={{ fontSize: 11.5, color: C.k2, marginTop: 3 }}>📝 {h.note}</div>}
                  {h.from && <div style={{ fontSize: 11, color: C.mt, marginTop: 2 }}>مدة الصيانة: {daysBetween(h.from, h.date)} يوم</div>}
                  {h.cost > 0 && <div style={{ fontSize: 11, color: "#c0392b", marginTop: 2 }}>تكلفة الإصلاح: {fmt(h.cost)} {cur}</div>}
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}

      {/* نافذة إضافة مورد */}
      {modal && (
        <Modal title="إضافة مورد جديد للنادي" onClose={() => setModal(false)} width={480}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="اسم المورد *" full><Inp value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="مثال: يد تحكم PS5" /></Field>
            <Field label="الفئة"><Sel value={f.cat} onChange={e => setF({ ...f, cat: e.target.value })}>{CATS_A.map(c => <option key={c}>{c}</option>)}</Sel></Field>
            <Field label="العدد"><Inp type="number" value={f.qty} onChange={e => setF({ ...f, qty: e.target.value })} min="1" /></Field>
            <Field label="تاريخ الإضافة"><Inp type="date" value={f.addedAt} onChange={e => setF({ ...f, addedAt: e.target.value })} /></Field>
            <Field label={"التكلفة للوحدة (" + cur + ")"}><Inp type="number" value={f.cost} onChange={e => setF({ ...f, cost: e.target.value })} placeholder="0" /></Field>
            <Field label="المورّد (اختياري)" full>
              <div style={{ display: "flex", gap: 6 }}>
                <Sel value={f.supplier} onChange={e => setF({ ...f, supplier: e.target.value })} style={{ flex: 1 }}><option value="">— بدون —</option>{suppliers.map(s => <option key={s.id}>{s.name}</option>)}</Sel>
                <Btn sm gold onClick={() => { setNewSup({ name: "", phone: "", spec: "" }); setSupModal(true); }} style={{ whiteSpace: "nowrap" }}>+ مورّد</Btn>
              </div>
            </Field>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}><Btn gold onClick={addAsset} style={{ flex: 1, justifyContent: "center" }}>✓ إضافة</Btn><Btn onClick={() => setModal(false)}>إلغاء</Btn></div>
        </Modal>
      )}

      {/* نافذة إضافة مورّد سريع */}
      {supModal && (
        <Modal title="إضافة مورّد جديد" onClose={() => setSupModal(false)} width={420}>
          <Field label="اسم المورّد *"><Inp value={newSup.name} onChange={e => setNewSup({ ...newSup, name: e.target.value })} /></Field>
          <Field label="الهاتف / الواتساب"><Inp value={newSup.phone} onChange={e => setNewSup({ ...newSup, phone: e.target.value })} placeholder="0913-000-000" /></Field>
          <Field label="التخصص"><Inp value={newSup.spec} onChange={e => setNewSup({ ...newSup, spec: e.target.value })} placeholder="أجهزة ألعاب" /></Field>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn gold style={{ flex: 1, justifyContent: "center" }} onClick={() => {
              if (!newSup.name.trim()) { showToast("أدخل اسم المورّد"); return; }
              let d = (newSup.phone || "").replace(/\D/g, ""); if (d.startsWith("0")) d = "218" + d.slice(1);
              const s = { id: Math.max(0, ...suppliers.map(x => x.id)) + 1, name: newSup.name.trim(), phone: newSup.phone, wa: d, spec: newSup.spec || "عام", total: 0, due: 0, status: "نشط" };
              setSuppliers(list => [...list, s]); setF(ff => ({ ...ff, supplier: s.name }));
              showToast("تمت إضافة المورّد واختياره"); setSupModal(false);
            }}>✓ حفظ واختيار</Btn>
            <Btn onClick={() => setSupModal(false)}>إلغاء</Btn>
          </div>
        </Modal>
      )}
    </>
  );
}
const actBtn = (color) => ({ background: color + "18", border: "none", borderRadius: 6, color, fontSize: 12, fontWeight: 700, padding: "4px 8px", cursor: "pointer", fontFamily: "inherit" });

/* ---------- الدوريات والمسابقات: أدوات القرعة والتقدّم ---------- */
const nextPow2 = (n) => { let p = 2; while (p < n) p *= 2; return p; };
const shuffleArr = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; } return a; };
const ROUND_LABELS = {
  1: ["النهائي"],
  2: ["نصف النهائي", "النهائي"],
  3: ["ربع النهائي", "نصف النهائي", "النهائي"],
  4: ["دور الـ16", "ربع النهائي", "نصف النهائي", "النهائي"],
};
const roundLabels = (n) => ROUND_LABELS[n] || Array.from({ length: n }, (_, i) => `الدور ${i + 1}`);

// بناء القرعة الأولى: تقسيم عشوائي + تمرير تلقائي (Bye) عند عدم اكتمال العدد
function buildBracket(participants, size) {
  const shuffled = shuffleArr(participants);
  const totalRounds = Math.log2(size);
  const rounds = [];
  const r0count = size / 2;
  const r0 = [];
  for (let i = 0; i < r0count; i++) {
    const p1 = shuffled[i * 2] || null;
    const p2 = shuffled[i * 2 + 1] || null;
    let winner = null, status = "pending";
    if (p1 && !p2) { winner = p1.id; status = "bye"; }
    else if (!p1 && p2) { winner = p2.id; status = "bye"; }
    r0.push({ id: `r0m${i}`, p1: p1 ? p1.id : null, p2: p2 ? p2.id : null, score1: null, score2: null, winner, status });
  }
  rounds.push(r0);
  for (let r = 1; r < totalRounds; r++) {
    const count = size / Math.pow(2, r + 1);
    const round = [];
    for (let i = 0; i < count; i++) round.push({ id: `r${r}m${i}`, p1: null, p2: null, score1: null, score2: null, winner: null, status: "pending" });
    rounds.push(round);
  }
  // مرّر الفائزين التلقائيين (bye) للدور التالي
  for (let r = 0; r < rounds.length - 1; r++) {
    rounds[r].forEach((m, i) => {
      if (m.winner) {
        const next = rounds[r + 1][Math.floor(i / 2)];
        if (i % 2 === 0) next.p1 = m.winner; else next.p2 = m.winner;
      }
    });
  }
  return rounds;
}

// تسجيل فائز مباراة وتمريره تلقائياً للدور التالي؛ يعيد { rounds, champion, runnerUp }
function setMatchWinner(rounds, roundIdx, matchIdx, winnerId, s1, s2) {
  const cloned = rounds.map(r => r.map(m => ({ ...m })));
  const match = cloned[roundIdx][matchIdx];
  match.winner = winnerId; match.status = "done";
  match.score1 = s1 === "" || s1 == null ? null : Number(s1);
  match.score2 = s2 === "" || s2 == null ? null : Number(s2);
  if (roundIdx + 1 < cloned.length) {
    const next = cloned[roundIdx + 1][Math.floor(matchIdx / 2)];
    if (matchIdx % 2 === 0) next.p1 = winnerId; else next.p2 = winnerId;
  }
  let champion = null, runnerUp = null;
  const last = cloned[cloned.length - 1];
  if (last.length === 1 && last[0].winner) {
    champion = last[0].winner;
    runnerUp = last[0].p1 === champion ? last[0].p2 : last[0].p1;
  }
  return { rounds: cloned, champion, runnerUp };
}

/* ============================ TOURNAMENTS (الدوريات والمسابقات) ============================ */
function Tournaments({ ctx }) {
  const { tournaments, setTournaments, showToast } = ctx;
  const [selected, setSelected] = useState(null);
  const [modal, setModal] = useState(false);
  const GAME_TYPES = ["تنس طاولة", "بلايستيشن — FIFA", "بلايستيشن — مصارعة", "بلياردو", "أخرى"];
  const [f, setF] = useState({ name: "", game: "تنس طاولة", size: "8", startDate: todayISO(), prize: "" });
  const [pf, setPf] = useState({ name: "", phone: "" });

  const t = tournaments.find(x => x.id === selected);
  const pName = (id) => t?.participants.find(p => p.id === id)?.name || (id ? "؟" : "—");

  const createTournament = () => {
    if (!f.name.trim()) { showToast("أدخل اسم الدوري"); return; }
    const nt = { id: "TN-" + Date.now(), name: f.name.trim(), game: f.game, size: parseInt(f.size), startDate: f.startDate, prize: f.prize.trim(), status: "تسجيل", participants: [], rounds: null, champion: null, runnerUp: null, createdAt: todayISO() };
    setTournaments(ts => [nt, ...ts]);
    showToast("تم إنشاء الدوري — ابدأ بتسجيل المشتركين");
    setModal(false); setF({ name: "", game: "تنس طاولة", size: "8", startDate: todayISO(), prize: "" });
    setSelected(nt.id);
  };

  const addParticipant = () => {
    if (!pf.name.trim()) { showToast("أدخل اسم المشترك"); return; }
    if (t.participants.length >= t.size) { showToast(`الحد الأقصى ${t.size} مشتركين لهذا الدوري`); return; }
    const p = { id: "pt" + Date.now(), name: pf.name.trim(), phone: pf.phone.trim() };
    setTournaments(ts => ts.map(x => x.id === t.id ? { ...x, participants: [...x.participants, p] } : x));
    setPf({ name: "", phone: "" });
  };
  const removeParticipant = (pid) => setTournaments(ts => ts.map(x => x.id === t.id ? { ...x, participants: x.participants.filter(p => p.id !== pid) } : x));

  const startDraw = () => {
    if (t.participants.length < 2) { showToast("يلزم مشتركان على الأقل لبدء القرعة"); return; }
    const rounds = buildBracket(t.participants, t.size);
    setTournaments(ts => ts.map(x => x.id === t.id ? { ...x, rounds, status: "جارٍ" } : x));
    showToast("🎲 تمّت القرعة — الدور الأول جاهز!");
  };

  const [scoreInputs, setScoreInputs] = useState({}); // matchKey -> {s1,s2}
  const decideWinner = (roundIdx, matchIdx, winnerId) => {
    const key = `${roundIdx}-${matchIdx}`;
    const sc = scoreInputs[key] || {};
    const { rounds, champion, runnerUp } = setMatchWinner(t.rounds, roundIdx, matchIdx, winnerId, sc.s1, sc.s2);
    setTournaments(ts => ts.map(x => x.id === t.id ? { ...x, rounds, champion, runnerUp, status: champion ? "منتهية" : "جارٍ" } : x));
    if (champion) showToast(`🏆 انتهى الدوري — البطل: ${pName(champion)}`);
  };

  const deleteTournament = (id) => {
    const removed = tournaments.find(x => x.id === id);
    if (!removed) return;
    setTournaments(ts => ts.filter(x => x.id !== id));
    if (selected === id) setSelected(null);
    showToast(`حُذف الدوري «${removed.name}»`, { onUndo: () => setTournaments(ts => [...ts, removed]) });
  };

  // طباعة سجل المشتركين (متاحة بعد انتهاء التسجيل)
  const printParticipants = () => {
    openPdfDoc(ctx.settings, {
      title: `سجل مشتركي الدوري — ${t.name}`,
      recipientLabel: "الدوري", recipientName: t.name,
      docNo: t.id,
      columns: ["#", "الاسم", "الهاتف"],
      rows: t.participants.map((p, i) => [i + 1, p.name, p.phone || "—"]),
      totals: [["إجمالي المشتركين", t.participants.length + " مشترك"]],
      note: `نوع اللعبة: ${t.game} — حجم القرعة: ${t.size} — تاريخ البدء: ${arDate(t.startDate)}`,
    });
  };

  // طباعة قائمة الدوري إلى المباريات (جدول كل الأدوار والنتائج)
  const printMatches = () => {
    const lbls = roundLabels(t.rounds.length);
    const rows = [];
    t.rounds.forEach((round, ri) => {
      round.forEach((m, mi) => {
        const score = (m.score1 != null && m.score2 != null) ? `${m.score1} - ${m.score2}` : "—";
        const winner = m.winner ? pName(m.winner) : "لم تُلعب بعد";
        rows.push([lbls[ri], `مباراة ${mi + 1}`, pName(m.p1), score, pName(m.p2), winner]);
      });
    });
    openPdfDoc(ctx.settings, {
      title: `قائمة مباريات الدوري — ${t.name}`,
      recipientLabel: "الدوري", recipientName: t.name,
      docNo: t.id,
      columns: ["الدور", "المباراة", "اللاعب الأول", "النتيجة", "اللاعب الثاني", "الفائز"],
      rows,
      totals: [["إجمالي المشتركين", t.participants.length + " مشترك"], ["الحالة", t.status], ...(t.champion ? [["🏆 البطل", pName(t.champion)]] : [])],
      note: `نوع اللعبة: ${t.game}${t.prize ? " — الجائزة: " + t.prize : ""} — تاريخ البدء: ${arDate(t.startDate)}`,
    });
  };

  const STATUS_TONE = { "تسجيل": "gold", "جارٍ": "b", "منتهية": "g" };

  /* ---------- قائمة الدوريات ---------- */
  if (!t) {
    return (
      <>
        <PageTop title="🏆 الدوريات والمسابقات" action={<Btn gold onClick={() => setModal(true)}>+ إنشاء دوري جديد</Btn>} />
        {tournaments.length === 0 ? (
          <Card><div style={{ textAlign: "center", color: C.mt, padding: "2rem" }}>لا دوريات بعد — أنشئ أول دوري لناديك (تنس طاولة، بلايستيشن FIFA...).</div></Card>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 12 }}>
            {tournaments.map(tt => (
              <Card key={tt.id} className="nk-card-hover" style={{ cursor: "pointer" }}>
                <div onClick={() => setSelected(tt.id)}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: C.grn2 }}>{tt.name}</div>
                    <Badge tone={STATUS_TONE[tt.status]}>{tt.status}</Badge>
                  </div>
                  <div style={{ fontSize: 12, color: C.mt, marginBottom: 6 }}>{tt.game} · {tt.size} مقاعد</div>
                  <div style={{ fontSize: 12, color: C.k2, marginBottom: 6 }}>👥 {tt.participants.length} مشترك مسجَّل</div>
                  {tt.status === "منتهية" && tt.champion && (
                    <div style={{ background: "linear-gradient(135deg,#fff7eb,#fff)", border: `1px solid ${C.gold}66`, borderRadius: 8, padding: ".4rem .6rem", fontSize: 12, fontWeight: 700, color: C.gdd, marginTop: 6 }}>🏆 البطل: {tt.participants.find(p => p.id === tt.champion)?.name || "—"}</div>
                  )}
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                  <button onClick={() => deleteTournament(tt.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.mt, fontSize: 12.5 }}>🗑 حذف</button>
                </div>
              </Card>
            ))}
          </div>
        )}
        {modal && (
          <Modal title="إنشاء دوري / مسابقة جديدة" onClose={() => setModal(false)} width={460}>
            <Field label="اسم الدوري *" full><Inp value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="مثال: دوري فيفا الشتوي" /></Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label="نوع اللعبة"><Sel value={f.game} onChange={e => setF({ ...f, game: e.target.value })}>{GAME_TYPES.map(g => <option key={g}>{g}</option>)}</Sel></Field>
              <Field label="حجم القرعة"><Sel value={f.size} onChange={e => setF({ ...f, size: e.target.value })}><option value="4">4 مشتركين</option><option value="8">8 مشتركين</option><option value="16">16 مشتركاً</option></Sel></Field>
              <Field label="تاريخ البدء"><Inp type="date" value={f.startDate} onChange={e => setF({ ...f, startDate: e.target.value })} /></Field>
              <Field label="الجائزة (اختياري)"><Inp value={f.prize} onChange={e => setF({ ...f, prize: e.target.value })} placeholder="مثال: كأس + 100 د.ل" /></Field>
            </div>
            <div style={{ fontSize: 11, color: C.mt, margin: "4px 0 12px", lineHeight: 1.7 }}>بعد الإنشاء، سجّل المشتركين ثم اضغط «إجراء القرعة» لبدء الدوري تلقائياً بأدوار عشوائية (ربع نهائي/نصف نهائي/نهائي حسب العدد).</div>
            <div style={{ display: "flex", gap: 8 }}><Btn gold onClick={createTournament} style={{ flex: 1, justifyContent: "center" }}>✓ إنشاء</Btn><Btn onClick={() => setModal(false)}>إلغاء</Btn></div>
          </Modal>
        )}
      </>
    );
  }

  /* ---------- تفاصيل دوري محدد ---------- */
  const labels = t.rounds ? roundLabels(t.rounds.length) : [];
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "1rem", flexWrap: "wrap" }}>
        <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: C.mt, display: "flex", alignItems: "center", gap: 4 }}>→ رجوع للدوريات</button>
      </div>
      <PageTop title={t.name} action={
        <div style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap" }}>
          {t.status !== "تسجيل" && <>
            <Btn sm onClick={printParticipants}>🖨 سجل المشتركين</Btn>
            <Btn sm onClick={printMatches}>🖨 قائمة المباريات</Btn>
          </>}
          <Badge tone={STATUS_TONE[t.status]}>{t.status}</Badge>
        </div>
      } />
      <div style={{ fontSize: 12.5, color: C.mt, marginBottom: 14 }}>{t.game} · بدأ {arDate(t.startDate)} · {t.size} مقاعد{t.prize ? ` · 🎁 ${t.prize}` : ""}</div>

      {t.status === "منتهية" && t.champion && (
        <div style={{ background: "linear-gradient(135deg,#fff7eb,#fffdf5)", border: `1.5px solid ${C.gold}`, borderRadius: 16, padding: "1.4rem", textAlign: "center", marginBottom: "1.2rem" }}>
          <div style={{ fontSize: 42 }}>🏆</div>
          <div style={{ fontSize: 12, color: C.mt, marginTop: 4 }}>بطل الدوري</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: C.grn2, marginTop: 2 }}>{pName(t.champion)}</div>
          {t.runnerUp && <div style={{ fontSize: 12.5, color: C.mt, marginTop: 8 }}>🥈 الوصيف: <b>{pName(t.runnerUp)}</b></div>}
        </div>
      )}

      {t.status === "تسجيل" && (
        <div style={{ display: "grid", gridTemplateColumns: ctx.scr?.isTab ? "1fr" : "1fr 1.3fr", gap: 12 }}>
          <Card>
            <CardHead title="تسجيل مشترك جديد" sub={`${t.participants.length} / ${t.size}`} />
            <Field label="اسم المشترك"><Inp value={pf.name} onChange={e => setPf({ ...pf, name: e.target.value })} onKeyDown={e => e.key === "Enter" && addParticipant()} placeholder="الاسم الكامل" /></Field>
            <Field label="رقم الهاتف (اختياري)"><Inp value={pf.phone} onChange={e => setPf({ ...pf, phone: e.target.value })} placeholder="0913-000-000" /></Field>
            <Btn gold onClick={addParticipant} style={{ width: "100%", justifyContent: "center", marginBottom: 10 }}>+ إضافة للقائمة</Btn>
            <Btn onClick={startDraw} style={{ width: "100%", justifyContent: "center", background: "linear-gradient(135deg,#1a8c3e,#146830)", color: "#fff", border: "none" }}>🎲 إجراء القرعة وبدء الدوري</Btn>
          </Card>
          <Card>
            <CardHead title="المشتركون المسجَّلون" sub={`${t.participants.length} مشترك`} />
            {t.participants.length === 0 ? <div style={{ textAlign: "center", color: C.mt, fontSize: 12.5, padding: "1.5rem" }}>لا مشتركون بعد.</div> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {t.participants.map((p, i) => (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: C.crm, borderRadius: 8, padding: ".5rem .75rem" }}>
                    <span style={{ fontSize: 12.5 }}>{i + 1}. {p.name} {p.phone && <span style={{ color: C.mt, fontSize: 11 }}>— {p.phone}</span>}</span>
                    <button onClick={() => removeParticipant(p.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.red, fontSize: 12 }}>حذف</button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {t.rounds && (t.status === "جارٍ" || t.status === "منتهية") && (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {t.rounds.map((round, ri) => (
            <div key={ri}>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.grn2, marginBottom: 9, display: "flex", alignItems: "center", gap: 7 }}>
                <span>{ri === t.rounds.length - 1 ? "🏆" : ri === t.rounds.length - 2 ? "🥈" : "⚔️"}</span>{labels[ri]}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 10 }}>
                {round.map((m, mi) => {
                  const key = `${ri}-${mi}`;
                  const p1Name = pName(m.p1), p2Name = pName(m.p2);
                  const ready = m.p1 && m.p2 && m.status === "pending";
                  const sc = scoreInputs[key] || {};
                  return (
                    <div key={m.id} style={{ border: `1px solid ${m.status === "done" || m.status === "bye" ? "rgba(26,140,62,.3)" : C.bc}`, borderRadius: 12, padding: ".7rem .85rem", background: m.status === "done" || m.status === "bye" ? "#f4faf5" : C.cd }}>
                      {[["p1", m.p1, p1Name], ["p2", m.p2, p2Name]].map(([side, pid, nm]) => (
                        <div key={side} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 0", opacity: pid ? 1 : .5 }}>
                          <span style={{ fontSize: 12.5, fontWeight: m.winner === pid ? 800 : 500, color: m.winner === pid ? C.grn2 : C.k2 }}>{m.winner === pid && "✓ "}{nm}</span>
                          {ready ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                              <input type="number" placeholder="-" value={side === "p1" ? (sc.s1 ?? "") : (sc.s2 ?? "")} onChange={e => setScoreInputs(s => ({ ...s, [key]: { ...sc, [side === "p1" ? "s1" : "s2"]: e.target.value } }))} style={{ width: 34, fontSize: 11, textAlign: "center", border: `0.5px solid ${C.bc}`, borderRadius: 5, padding: "2px" }} />
                              <button onClick={() => decideWinner(ri, mi, pid)} style={{ fontSize: 10.5, fontWeight: 700, background: C.grl, color: "#fff", border: "none", borderRadius: 6, padding: "3px 7px", cursor: "pointer" }}>فوز</button>
                            </div>
                          ) : m.status !== "pending" && m.winner === pid ? <span style={{ fontSize: 10.5, color: "#1a8c3e" }}>{m.status === "bye" ? "تأهّل تلقائياً" : "فائز"}</span> : null}
                        </div>
                      ))}
                      {(!m.p1 || !m.p2) && m.status === "pending" && <div style={{ fontSize: 10.5, color: C.mt, textAlign: "center", marginTop: 4 }}>بانتظار نتيجة الدور السابق...</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 16 }}><button onClick={() => deleteTournament(t.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.red, fontSize: 12 }}>🗑 حذف هذا الدوري</button></div>
    </>
  );
}

function Coupons({ ctx }) {
  const { coupons, setCoupons, showToast } = ctx;
  const [modal, setModal] = useState(false);
  const [f, setF] = useState({ code: "", desc: "", pct: "", limit: "", exp: "" });
  const save = () => {
    if (!f.code.trim() || !f.pct) { showToast("أدخل الكود ونسبة الخصم"); return; }
    setCoupons(c => [...c, { id: c.length + 1, code: f.code.toUpperCase(), desc: f.desc, pct: parseInt(f.pct), used: 0, limit: parseInt(f.limit) || 100, exp: f.exp, status: "نشط" }]);
    showToast("تم إنشاء الكوبون"); setModal(false); setF({ code: "", desc: "", pct: "", limit: "", exp: "" });
  };
  return (
    <>
      <PageTop title="كوبونات الخصم" action={<Btn gold onClick={() => setModal(true)}>+ إنشاء كوبون</Btn>} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(290px,1fr))", gap: 11 }}>
        {coupons.map(c => (
          <div key={c.id} style={{ background: C.crm, border: `1.5px dashed ${C.gold}`, borderRadius: 12, padding: ".9rem 1rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div><div style={{ fontFamily: "monospace", fontSize: 15, fontWeight: 700, letterSpacing: 2, color: C.grn2 }}>{c.code}</div><div style={{ fontSize: 11, color: C.mt, marginTop: 3 }}>{c.desc}</div><div style={{ fontSize: 10, color: C.k2, marginTop: 4 }}>استُخدم {c.used} / {c.limit} مرة</div></div>
            <div style={{ textAlign: "left" }}><Badge tone={c.status === "نشط" ? "g" : "r"}>{c.status}</Badge><div style={{ fontSize: 10, color: C.mt, marginTop: 5 }}>ينتهي {arDate(c.exp)}</div></div>
          </div>
        ))}
      </div>
      {modal && <Modal title="إنشاء كوبون جديد" onClose={() => setModal(false)} width={440}>
        <Field label="كود الكوبون"><Inp value={f.code} onChange={e => setF({ ...f, code: e.target.value })} placeholder="GAME25" /></Field>
        <Field label="الوصف"><Inp value={f.desc} onChange={e => setF({ ...f, desc: e.target.value })} placeholder="خصم على الألعاب" /></Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="نسبة الخصم %"><Inp type="number" value={f.pct} onChange={e => setF({ ...f, pct: e.target.value })} /></Field>
          <Field label="حد الاستخدام"><Inp type="number" value={f.limit} onChange={e => setF({ ...f, limit: e.target.value })} /></Field>
        </div>
        <Field label="تاريخ الانتهاء"><Inp type="date" value={f.exp} onChange={e => setF({ ...f, exp: e.target.value })} /></Field>
        <div style={{ display: "flex", gap: 8 }}><Btn gold onClick={save} style={{ flex: 1, justifyContent: "center" }}>✓ حفظ</Btn><Btn onClick={() => setModal(false)}>إلغاء</Btn></div>
      </Modal>}
    </>
  );
}

/* ============================ EXPENSES ============================ */
/* ============================ TREASURY (الخزينة والإغلاق اليومي) ============================ */
function Treasury({ ctx }) {
  const { invoices, purchases, expenses, payments, closings, setClosings, users, user, showToast } = ctx;
  const cur = ctx.settings?.currency || "د.ل";
  const [period, setPeriod] = useState("today"); // today | 7 | 30
  const [actual, setActual] = useState({ cash: "", card: "", transfer: "" });
  const [assignTo, setAssignTo] = useState("");
  const [note, setNote] = useState("");

  const payDay = (i) => i.paidAt || i.date;
  const payMethod = (i) => i.paidVia || i.pay;
  const normPay = (p) => p === "نقداً" ? "كاش" : p;
  const today = todayISO();
  // يوم العمل المُغلَق: افتراضياً اليوم، لكن قبل الساعة 6 صباحاً يُفترض أن الإغلاق لليوم السابق (نوبات تعمل بعد منتصف الليل)
  const [closeDate, setCloseDate] = useState(() => {
    const h = new Date().getHours();
    if (h < 6) { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().split("T")[0]; }
    return today;
  });

  // مجاميع فترة (إيراد مقبوض فقط) حسب الطريقة
  const sumsFor = (days) => {
    const from = new Date(); from.setDate(from.getDate() - (days - 1));
    const fromISO = from.toISOString().split("T")[0];
    const inRange = (d) => days === 1 ? d === today : (d >= fromISO && d <= today);
    const out = { cash: 0, card: 0, transfer: 0, total: 0 };
    const add = (m, v) => { if (m === "كاش") out.cash += v; else if (m === "بطاقة") out.card += v; else if (m === "تحويل") out.transfer += v; out.total += v; };
    // مبيعات مدفوعة فوراً (غير الآجلة — الآجلة تدخل عبر سجل القبض بيوم استلامها)
    invoices.filter(i => i.status === "مدفوعة" && i.pay !== "آجل" && inRange(i.date)).forEach(i => add(i.pay, i.total));
    // قبض ديون الزبائن (يشمل الدفعات الجزئية)
    payments.filter(p => p.kind === "قبض" && inRange(p.date)).forEach(p => add(p.via, p.amount));
    return out;
  };
  const periodDays = period === "today" ? 1 : period === "7" ? 7 : 30;
  const sums = sumsFor(periodDays);

  // متوقع يوم الإغلاق المختار بالتفصيل: إيراد − مصاريف مدفوعة − مشتريات كاش (خرجت من الدرج)
  const expected = useMemo(() => {
    const rev = { cash: 0, card: 0, transfer: 0 };
    const addRev = (m, v) => { if (m === "كاش") rev.cash += v; else if (m === "بطاقة") rev.card += v; else if (m === "تحويل") rev.transfer += v; };
    invoices.filter(i => i.status === "مدفوعة" && i.pay !== "آجل" && i.date === closeDate).forEach(i => addRev(i.pay, i.total));
    payments.filter(p => p.kind === "قبض" && p.date === closeDate).forEach(p => addRev(p.via, p.amount));
    const expOut = { cash: 0, card: 0, transfer: 0 };
    expenses.filter(e => e.date === closeDate).forEach(e => {
      const m = normPay(e.pay);
      if (m === "كاش") expOut.cash += e.amount; else if (m === "بطاقة") expOut.card += e.amount; else if (m === "تحويل") expOut.transfer += e.amount;
    });
    const purchOut = { cash: 0, card: 0, transfer: 0 };
    purchases.filter(p => p.date === closeDate && p.pay === "كاش").forEach(p => { purchOut.cash += p.total; });
    // سداد الموردين يوم الإغلاق — يُخصم من الخزينة حسب طريقته
    const supPay = { cash: 0, card: 0, transfer: 0 };
    payments.filter(p => p.kind === "صرف" && p.date === closeDate).forEach(p => {
      if (p.via === "كاش") supPay.cash += p.amount; else if (p.via === "بطاقة") supPay.card += p.amount; else if (p.via === "تحويل") supPay.transfer += p.amount;
    });
    const net = {
      cash: rev.cash - expOut.cash - purchOut.cash - supPay.cash,
      card: rev.card - expOut.card - supPay.card,
      transfer: rev.transfer - expOut.transfer - supPay.transfer,
    };
    return { rev, expOut, purchOut, supPay, net, netTotal: net.cash + net.card + net.transfer };
  }, [invoices, expenses, purchases, payments, closeDate]);

  const todayClosing = closings.find(c => c.date === closeDate);
  const actualNum = { cash: parseFloat(actual.cash) || 0, card: parseFloat(actual.card) || 0, transfer: parseFloat(actual.transfer) || 0 };
  const actualTotal = actualNum.cash + actualNum.card + actualNum.transfer;
  const diff = Math.round((actualTotal - expected.netTotal) * 100) / 100;

  const saveClosing = () => {
    if (actual.cash === "" && actual.card === "" && actual.transfer === "") { showToast("أدخل المبالغ الفعلية المعدودة"); return; }
    if (diff < 0 && !assignTo) { showToast("يوجد عجز — اختر المستخدم المسؤول لتسجيله عليه"); return; }
    const status = diff === 0 ? "match" : diff < 0 ? "shortage" : "surplus";
    setClosings(cs => [{
      id: "CL-" + Date.now(), date: closeDate,
      expected: { ...expected.net, total: expected.netTotal },
      actual: { ...actualNum, total: actualTotal },
      diff, status,
      assignedTo: diff < 0 ? assignTo : null,
      note: note.trim() || null,
      closedBy: user.name, closedAt: new Date().toISOString(),
    }, ...cs]);
    DB.flush("closings");
    showToast(diff === 0 ? "تم الإغلاق — مطابقة تامة ✓" : diff < 0 ? `تم تسجيل عجز ${fmt(Math.abs(diff))} ${cur} على ${assignTo}` : `تم حفظ زيادة ${fmt(diff)} ${cur} في النظام`);
    setActual({ cash: "", card: "", transfer: "" }); setAssignTo(""); setNote("");
  };

  const deleteClosing = (id) => {
    const removed = closings.find(c => c.id === id);
    if (!removed) return;
    setClosings(cs => cs.filter(c => c.id !== id));
    showToast("حُذف الإغلاق — يمكن إعادة العد الآن", { onUndo: () => setClosings(cs => [removed, ...cs]) });
  };

  // ملخص العجوزات حسب المستخدم
  const shortByUser = {};
  closings.filter(c => c.status === "shortage" && c.assignedTo).forEach(c => { shortByUser[c.assignedTo] = (shortByUser[c.assignedTo] || 0) + Math.abs(c.diff); });
  const surplusTotal = closings.filter(c => c.status === "surplus").reduce((s, c) => s + c.diff, 0);

  const ST = { match: { l: "مطابقة ✓", t: "g" }, shortage: { l: "عجز", t: "r" }, surplus: { l: "زيادة", t: "b" } };
  const mLabel = { cash: "💵 كاش", card: "💳 بطاقة", transfer: "🏦 تحويل" };
  const rowStyle = { display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0" };

  return (
    <>
      <PageTop title="الخزينة والإغلاق اليومي" action={<Badge tone="gold">{arDate(today)}</Badge>} />

      {/* ملخص الفترة */}
      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
        {[["today", "اليوم"], ["7", "آخر 7 أيام"], ["30", "آخر 30 يوم"]].map(([k, l]) => (
          <span key={k} onClick={() => setPeriod(k)} style={{ cursor: "pointer", fontSize: 12, fontWeight: 600, padding: ".4rem 1rem", borderRadius: 20, background: period === k ? C.grn : C.crm, color: period === k ? C.gld : C.k2, border: `0.5px solid ${period === k ? C.grn : C.bc}` }}>{l}</span>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 11, marginBottom: "1.1rem" }}>
        <KCard label="💵 نقدي (كاش)" value={fmt(sums.cash)} sub={cur} bar="#1a8c3e" />
        <KCard label="💳 بطاقة" value={fmt(sums.card)} sub={cur} bar="#2a78d6" />
        <KCard label="🏦 تحويل مصرفي" value={fmt(sums.transfer)} sub={cur} bar={C.purp} />
        <KCard label="الإجمالي المقبوض" value={fmt(sums.total)} sub={cur} bar={C.gold} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: ctx.scr?.isTab ? "1fr" : "1.2fr 1fr", gap: 12, marginBottom: "1.1rem" }}>
        {/* الإغلاق اليومي */}
        <Card className="nk-card-hover">
          <CardHead title="🔒 الإغلاق اليومي" sub={todayClosing ? `تم إغلاق يوم ${arDate(closeDate)}` : "عُدّ ما في الدرج وطابقه مع النظام"} />
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, background: closeDate !== today ? "#FFF7EB" : C.crm, borderRadius: 9, padding: ".55rem .75rem" }}>
            <span style={{ fontSize: 11.5, color: C.mt, fontWeight: 600, whiteSpace: "nowrap" }}>يوم الإغلاق:</span>
            <Inp type="date" value={closeDate} onChange={e => setCloseDate(e.target.value)} style={{ flex: 1 }} />
            {closeDate !== today && <Badge tone="gold">ليس اليوم الحالي</Badge>}
          </div>
          {closeDate !== today && <div style={{ fontSize: 10.5, color: C.gdd, marginTop: -8, marginBottom: 10, lineHeight: 1.7 }}>💡 إن أغلقت النادي بعد منتصف الليل، اختر هنا تاريخ يوم العمل الفعلي (وليس التاريخ الذي تغيّر إليه التقويم) — النظام اقترح لك تلقائياً اليوم السابق لأن الوقت الحالي قبل الساعة 6 صباحاً.</div>}
          {todayClosing ? (
            <div>
              <div style={{ background: todayClosing.status === "match" ? "#e8f8ee" : todayClosing.status === "shortage" ? "#fdeaea" : C.bluebg, borderRadius: 12, padding: "1rem", textAlign: "center", marginBottom: 10 }}>
                <div style={{ fontSize: 30 }}>{todayClosing.status === "match" ? "✅" : todayClosing.status === "shortage" ? "⚠️" : "➕"}</div>
                <div style={{ fontSize: 15, fontWeight: 800, marginTop: 4 }}>{ST[todayClosing.status].l}{todayClosing.diff !== 0 && ` — ${fmt(Math.abs(todayClosing.diff))} ${cur}`}</div>
                {todayClosing.assignedTo && <div style={{ fontSize: 12, color: "#922", marginTop: 4 }}>سُجّل العجز على: <b>{todayClosing.assignedTo}</b></div>}
                <div style={{ fontSize: 11, color: C.mt, marginTop: 4 }}>أُغلق بواسطة {todayClosing.closedBy} · متوقع {fmt(todayClosing.expected.total)} / فعلي {fmt(todayClosing.actual.total)} {cur}</div>
              </div>
              <Btn sm danger onClick={() => deleteClosing(todayClosing.id)}>↩ إلغاء الإغلاق وإعادة العد</Btn>
            </div>
          ) : (
            <>
              {/* المتوقع من النظام */}
              <div style={{ background: C.crm, borderRadius: 10, padding: ".7rem .9rem", marginBottom: 12, fontSize: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 6, color: C.grn2 }}>المتوقع في الدرج حسب النظام ({closeDate === today ? "اليوم" : arDate(closeDate)}):</div>
                {["cash", "card", "transfer"].map(m => (
                  <div key={m} style={rowStyle}>
                    <span>{mLabel[m]}</span>
                    <span style={{ fontWeight: 700 }}>{fmt(expected.net[m])} {cur} <span style={{ color: C.mt, fontWeight: 400, fontSize: 10.5 }}>(إيراد {fmt(expected.rev[m])}{(expected.expOut[m] + expected.supPay[m] + (m === "cash" ? expected.purchOut.cash : 0)) ? ` − مدفوعات ${fmt(expected.expOut[m] + expected.supPay[m] + (m === "cash" ? expected.purchOut.cash : 0))}` : ""})</span></span>
                  </div>
                ))}
                <div style={{ ...rowStyle, borderTop: `0.5px solid ${C.bc}`, marginTop: 5, paddingTop: 7, fontWeight: 800, fontSize: 13 }}><span>الإجمالي المتوقع</span><span style={{ color: C.grn2 }}>{fmt(expected.netTotal)} {cur}</span></div>
              </div>

              {/* العد الفعلي */}
              <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6 }}>المعدود فعلياً:</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 10 }}>
                <Field label="💵 نقود الدرج"><Inp type="number" value={actual.cash} onChange={e => setActual({ ...actual, cash: e.target.value })} placeholder="0" /></Field>
                <Field label="💳 إيصالات بطاقة"><Inp type="number" value={actual.card} onChange={e => setActual({ ...actual, card: e.target.value })} placeholder="0" /></Field>
                <Field label="🏦 تحويلات"><Inp type="number" value={actual.transfer} onChange={e => setActual({ ...actual, transfer: e.target.value })} placeholder="0" /></Field>
              </div>

              {/* الفرق الحي */}
              <div style={{ background: diff === 0 ? "#e8f8ee" : diff < 0 ? "#fdeaea" : C.bluebg, border: `1px solid ${diff === 0 ? "rgba(26,140,62,.3)" : diff < 0 ? "rgba(192,57,43,.3)" : "rgba(42,120,214,.3)"}`, borderRadius: 10, padding: ".65rem .9rem", marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12.5, fontWeight: 700 }}>{diff === 0 ? "✅ مطابقة تامة" : diff < 0 ? "⚠️ عجز في الخزينة" : "➕ زيادة في الخزينة"}</span>
                <span style={{ fontSize: 17, fontWeight: 800, color: diff === 0 ? "#1a8c3e" : diff < 0 ? "#c0392b" : "#2a78d6" }}>{diff > 0 ? "+" : ""}{fmt(diff)} {cur}</span>
              </div>

              {diff < 0 && (
                <Field label="تسجيل العجز على المستخدم *">
                  <Sel value={assignTo} onChange={e => setAssignTo(e.target.value)}>
                    <option value="">اختر المستخدم المسؤول...</option>
                    {users.filter(u => u.active).map(u => <option key={u.id} value={u.name}>{u.name} — {u.role}</option>)}
                  </Sel>
                </Field>
              )}
              <Field label="ملاحظة (اختياري)"><Inp value={note} onChange={e => setNote(e.target.value)} placeholder={diff > 0 ? "مصدر الزيادة إن عُرف" : "أي ملاحظات على الإغلاق"} /></Field>
              <Btn gold onClick={saveClosing} style={{ width: "100%", justifyContent: "center" }}>🔒 تأكيد الإغلاق اليومي</Btn>
            </>
          )}
        </Card>

        {/* ملخصات جانبية */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Card className="nk-card-hover">
            <CardHead title="⚠️ عجوزات المستخدمين" sub="التراكمي المسجّل" />
            {Object.keys(shortByUser).length === 0 ? <div style={{ textAlign: "center", color: C.mt, fontSize: 12, padding: "1rem" }}>لا عجوزات مسجّلة ✓</div> :
              Object.entries(shortByUser).sort((a, b) => b[1] - a[1]).map(([n, v]) => (
                <div key={n} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: ".45rem .2rem", borderBottom: `0.5px solid ${C.bc}` }}><span>👤 {n}</span><span style={{ fontWeight: 700, color: "#c0392b" }}>{fmt(v)} {cur}</span></div>
              ))}
          </Card>
          <Card className="nk-card-hover">
            <CardHead title="➕ الزيادات المحفوظة" sub="مجموع فوائض الإغلاقات" />
            <div style={{ textAlign: "center", fontSize: 24, fontWeight: 800, color: "#2a78d6", padding: ".4rem 0" }}>{fmt(surplusTotal)} <span style={{ fontSize: 12 }}>{cur}</span></div>
          </Card>
        </div>
      </div>

      {/* سجل الإغلاقات */}
      <Card>
        <CardHead title="سجل الإغلاقات اليومية" sub={`${closings.length} إغلاق`} />
        {closings.length === 0 ? <div style={{ textAlign: "center", color: C.mt, fontSize: 12.5, padding: "1.5rem" }}>لا إغلاقات بعد — أول إغلاق يظهر هنا.</div> : (
          <Table cols={[{ h: "التاريخ", w: "13%" }, { h: "المتوقع", w: "14%" }, { h: "الفعلي", w: "14%" }, { h: "الفرق", w: "13%" }, { h: "الحالة", w: "12%" }, { h: "على المستخدم", w: "14%" }, { h: "أغلقه", w: "12%" }, { h: "", w: "8%" }]}
            rows={closings.map(c => [arDate(c.date), fmt(c.expected.total) + " " + cur, fmt(c.actual.total) + " " + cur,
              <span style={{ fontWeight: 700, color: c.diff === 0 ? "#1a8c3e" : c.diff < 0 ? "#c0392b" : "#2a78d6" }}>{c.diff > 0 ? "+" : ""}{fmt(c.diff)}</span>,
              <Badge tone={ST[c.status].t}>{ST[c.status].l}</Badge>, c.assignedTo || "—", c.closedBy,
              <button onClick={() => deleteClosing(c.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.mt, fontSize: 13 }}>🗑</button>])} />
        )}
      </Card>
    </>
  );
}

function Expenses({ ctx }) {
  const { expenses, setExpenses, employees, user, showToast, cats } = ctx;
  const cur = ctx.settings?.currency || "د.ل";
  const [modal, setModal] = useState(false);
  const [empFilter, setEmpFilter] = useState("all");
  const [f, setF] = useState({ date: todayISO(), cat: "أجار", desc: "", amount: "", pay: "نقداً", empId: "", dept: "" });
  const save = () => {
    if (!f.desc.trim() || !f.amount) { showToast("أدخل الوصف والمبلغ"); return; }
    const isEmp = f.cat === "سلفة موظف" && f.empId;
    const emp = isEmp ? employees.find(e => e.id == f.empId) : null;
    setExpenses(e => [{ id: Math.max(0, ...e.map(x => x.id)) + 1, date: f.date, cat: f.cat, desc: f.desc, amount: parseFloat(f.amount), pay: f.pay, by: user.name.split(" ")[0], empId: isEmp ? parseInt(f.empId) : null, empName: emp ? emp.name : null, dept: f.dept || null }, ...e]);
    showToast(isEmp ? `تم تسجيل سلفة ${fmt(parseFloat(f.amount))} ${cur} على ${emp.name}` : "تمت إضافة المصروف");
    setModal(false); setF({ date: todayISO(), cat: "أجار", desc: "", amount: "", pay: "نقداً", empId: "", dept: "" });
  };
  const byCat = (c) => expenses.filter(e => e.cat === c).reduce((s, e) => s + e.amount, 0);
  const CAT_TONE = { "أجار": "b", "مرتبات": "gold", "كهرباء": "r", "صيانة": "g", "سلفة موظف": "p", "أخرى": "a" };
  const shown = empFilter === "all" ? expenses : empFilter === "none" ? expenses.filter(e => !e.empId) : expenses.filter(e => e.empId == empFilter);

  return (
    <>
      <PageTop title="نظام المصاريف" action={<Btn gold onClick={() => setModal(true)}>+ إضافة مصروف</Btn>} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 11, marginBottom: "1.1rem" }}>
        <KCard label="أجار الموقع" value={fmt(byCat("أجار"))} sub="شهري" bar="#2a78d6" />
        <KCard label="سلف الموظفين" value={fmt(byCat("سلفة موظف"))} sub={cur} bar={C.purp} />
        <KCard label="الصيانة" value={fmt(byCat("صيانة"))} bar={C.red} />
        <KCard label="إجمالي المصاريف" value={fmt(expenses.reduce((s, e) => s + e.amount, 0))} sub={cur} bar={C.gold} />
      </div>
      <Card>
        <CardHead title="سجل المصاريف" right={
          <Sel value={empFilter} onChange={e => setEmpFilter(e.target.value)} style={{ width: 175 }}>
            <option value="all">كل المصاريف</option>
            <option value="none">مصاريف عامة فقط</option>
            <option disabled>── سلف موظف معيّن ──</option>
            {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </Sel>
        } />
        <Table cols={[{ h: "التاريخ", w: "12%" }, { h: "الفئة", w: "13%" }, { h: "الوصف", w: "21%" }, { h: "القسم", w: "11%" }, { h: "الموظف", w: "13%" }, { h: "المبلغ", w: "12%" }, { h: "الدفع", w: "8%" }, { h: "بواسطة", w: "8%" }]}
          rows={shown.map(e => [arDate(e.date), <Badge tone={CAT_TONE[e.cat] || "g"}>{e.cat}</Badge>, e.desc, e.dept ? <Badge tone="a">{cats[e.dept] || e.dept}</Badge> : <span style={{ color: C.mt, fontSize: 11 }}>عام</span>, e.empName || "—", fmt(e.amount) + " " + cur, e.pay, e.by])} />
        {shown.length === 0 && <div style={{ textAlign: "center", color: C.mt, fontSize: 12, padding: "1.5rem" }}>لا مصاريف مطابقة</div>}
      </Card>
      {modal && <Modal title="إضافة مصروف" onClose={() => setModal(false)} width={470}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="التاريخ"><Inp type="date" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} /></Field>
          <Field label="الفئة"><Sel value={f.cat} onChange={e => setF({ ...f, cat: e.target.value, empId: "" })}>{["أجار", "مرتبات", "كهرباء", "صيانة", "سلفة موظف", "أخرى"].map(c => <option key={c}>{c}</option>)}</Sel></Field>
          {f.cat === "سلفة موظف" && (
            <Field label="الموظف (تُخصم من مرتبه)" full>
              <Sel value={f.empId} onChange={e => setF({ ...f, empId: e.target.value })}>
                <option value="">اختر الموظف...</option>
                {employees.filter(e => e.status === "نشط").map(e => <option key={e.id} value={e.id}>{e.name} — راتب {fmt(e.salary)} {cur}</option>)}
              </Sel>
            </Field>
          )}
          <Field label="الوصف" full><Inp value={f.desc} onChange={e => setF({ ...f, desc: e.target.value })} placeholder={f.cat === "سلفة موظف" ? "سلفة على الراتب" : "وصف المصروف"} /></Field>
          <Field label={"المبلغ (" + cur + ")"}><Inp type="number" value={f.amount} onChange={e => setF({ ...f, amount: e.target.value })} /></Field>
          <Field label="طريقة الدفع"><Sel value={f.pay} onChange={e => setF({ ...f, pay: e.target.value })}>{["نقداً", "تحويل", "بطاقة"].map(p => <option key={p}>{p}</option>)}</Sel></Field>
          <Field label="القسم المرتبط (اختياري)" full>
            <Sel value={f.dept} onChange={e => setF({ ...f, dept: e.target.value })}>
              <option value="">عام — غير مرتبط بقسم مبيعات معيّن</option>
              {Object.entries(cats).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </Sel>
          </Field>
        </div>
        <div style={{ fontSize: 10.5, color: C.mt, marginTop: -6, marginBottom: 10, lineHeight: 1.7 }}>💡 اربط مصاريف التشغيل المباشرة (بن، أكواب، حليب لقسم الكافيه مثلاً) بقسمها — سيُحتسب هذا تلقائياً في تقرير «صافي ربح الأقسام» لمعرفة الربح الحقيقي لكل قسم شاملاً تكاليف تشغيله.</div>
        {f.cat === "سلفة موظف" && f.empId && (() => {
          const emp = employees.find(e => e.id == f.empId);
          const taken = expenses.filter(e => e.empId == f.empId && e.cat === "سلفة موظف").reduce((s, e) => s + e.amount, 0);
          const remain = emp.salary - taken - (parseFloat(f.amount) || 0);
          return <div style={{ background: remain < 0 ? "#fdeaea" : "rgba(26,140,62,.07)", border: `0.5px solid ${remain < 0 ? "rgba(192,57,43,.3)" : "rgba(26,140,62,.2)"}`, borderRadius: 9, padding: ".6rem .85rem", marginBottom: 12, fontSize: 12, lineHeight: 1.9 }}>
            الراتب: <b>{fmt(emp.salary)} {cur}</b> · سلف سابقة: <b>{fmt(taken)} {cur}</b><br />
            المتبقي بعد هذه السلفة: <b style={{ color: remain < 0 ? C.red : C.grn2 }}>{fmt(remain)} {cur}</b>{remain < 0 && " ⚠ تجاوز الراتب!"}
          </div>;
        })()}
        <div style={{ display: "flex", gap: 8 }}><Btn gold onClick={save} style={{ flex: 1, justifyContent: "center" }}>✓ حفظ</Btn><Btn onClick={() => setModal(false)}>إلغاء</Btn></div>
      </Modal>}
    </>
  );
}

/* ============================ SALARIES ============================ */
/* ============================ CAPITAL LEDGER (رأس المال والسيولة) ============================ */
function CapitalLedger({ ctx }) {
  const { invoices, expenses, purchases, payments, capitalMoves, setCapitalMoves, user, showToast, settings } = ctx;
  const cur = settings?.currency || "د.ل";
  const [modal, setModal] = useState(false);
  const [f, setF] = useState({ type: "ضخ رأس مال", amount: "", method: "كاش", date: todayISO(), note: "" });
  const [from, setFrom] = useState("");
  const [to, setTo] = useState(todayISO());
  const [methodFilter, setMethodFilter] = useState("all");
  const normPay = (p) => p === "نقداً" ? "كاش" : p;
  const MOVE_TYPES = ["ضخ رأس مال", "سحب مالك"];
  const TYPE_TONE = { "بيع": "g", "تحصيل دين": "g", "ضخ رأس مال": "b", "مصروف": "r", "توريد": "a", "سداد مورد": "a", "سحب مالك": "r" };

  const saveMove = () => {
    const amt = parseFloat(f.amount);
    if (!amt || amt <= 0) { showToast("أدخل مبلغاً صحيحاً"); return; }
    setCapitalMoves(cm => [{ id: "CM-" + Date.now(), date: f.date, type: f.type, amount: amt, method: f.method, note: f.note.trim(), by: user?.name || "—" }, ...cm]);
    DB.flush("capitalMoves");
    showToast(`تم تسجيل ${f.type} بمبلغ ${fmt(amt)} ${cur}`);
    setModal(false); setF({ type: "ضخ رأس مال", amount: "", method: "كاش", date: todayISO(), note: "" });
  };

  // ------- بناء كشف الحساب: كل حركة أثّرت على السيولة الفعلية، مجمَّعة من كل مصادر النظام -------
  const allEvents = useMemo(() => {
    const ev = [];
    (capitalMoves || []).forEach(m => {
      ev.push({ date: m.date, type: m.type, desc: m.note || m.type, method: m.method, amount: m.type === "سحب مالك" ? -m.amount : m.amount, by: m.by, sortKey: m.id });
    });
    invoices.filter(i => i.status === "مدفوعة" && i.pay !== "آجل").forEach(i => {
      ev.push({ date: i.date, type: "بيع", desc: `فاتورة #${i.id} — ${i.customer}`, method: i.pay, amount: i.total, by: i.by, sortKey: String(i.id) });
    });
    payments.filter(p => p.kind === "قبض").forEach(p => {
      ev.push({ date: p.date, type: "تحصيل دين", desc: `من ${p.party}`, method: p.via, amount: p.amount, by: p.by, sortKey: p.id });
    });
    expenses.forEach(e => {
      ev.push({ date: e.date, type: "مصروف", desc: `${e.cat} — ${e.desc}`, method: normPay(e.pay), amount: -e.amount, by: e.by, sortKey: "EX" + e.id });
    });
    purchases.filter(p => p.pay !== "آجل").forEach(p => {
      ev.push({ date: p.date, type: "توريد", desc: `${p.supplier} — ${p.id}`, method: normPay(p.pay), amount: -p.total, by: p.by, sortKey: String(p.id) });
    });
    payments.filter(p => p.kind === "صرف").forEach(p => {
      ev.push({ date: p.date, type: "سداد مورد", desc: `إلى ${p.party}`, method: p.via, amount: -p.amount, by: p.by, sortKey: p.id });
    });
    return ev.sort((a, b) => a.date === b.date ? String(a.sortKey).localeCompare(String(b.sortKey)) : a.date.localeCompare(b.date));
  }, [capitalMoves, invoices, payments, expenses, purchases]);

  // رصيد تراكمي لكل طريقة + إجمالي، محسوب بمرور واحد تصاعدي زمنياً
  const withBalance = useMemo(() => {
    const bal = { "كاش": 0, "بطاقة": 0, "تحويل": 0 };
    return allEvents.map(e => {
      const m = bal[e.method] !== undefined ? e.method : "كاش"; // احتياط لأي قيمة طريقة غير متوقعة
      bal[m] = Math.round((bal[m] + e.amount) * 100) / 100;
      return { ...e, balances: { ...bal }, totalAfter: Math.round((bal["كاش"] + bal["بطاقة"] + bal["تحويل"]) * 100) / 100 };
    });
  }, [allEvents]);

  const current = withBalance.length ? withBalance[withBalance.length - 1] : null;
  const currentBalance = current ? current.balances : { "كاش": 0, "بطاقة": 0, "تحويل": 0 };
  const totalBalance = current ? current.totalAfter : 0;

  const shown = withBalance.filter(e =>
    (!from || e.date >= from) && e.date <= to &&
    (methodFilter === "all" || e.method === methodFilter)
  ).slice().reverse();

  return (
    <>
      <PageTop title="🏦 رأس المال والسيولة" action={<Btn gold onClick={() => setModal(true)}>+ حركة رأس مال</Btn>} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 11, marginBottom: "1.1rem" }}>
        <KCard label="💵 الرصيد الحالي — كاش" value={fmt(currentBalance["كاش"])} sub={cur} bar="#1a8c3e" />
        <KCard label="💳 الرصيد الحالي — بطاقة" value={fmt(currentBalance["بطاقة"])} sub={cur} bar="#2a78d6" />
        <KCard label="🏦 الرصيد الحالي — تحويل" value={fmt(currentBalance["تحويل"])} sub={cur} bar={C.purp} />
        <KCard label="الإجمالي" value={fmt(totalBalance)} sub={cur} bar={C.gold} />
      </div>

      <Card style={{ marginBottom: "1.1rem" }}>
        <CardHead title="كشف الحساب الكامل" sub={`${fmt(shown.length)} حركة — كل عملية أثّرت على سيولتك منذ البداية`} right={
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            <Inp type="date" value={from} onChange={e => setFrom(e.target.value)} title="من (اتركه فارغاً لعرض كل التاريخ)" style={{ width: 135 }} />
            <Inp type="date" value={to} onChange={e => setTo(e.target.value)} style={{ width: 135 }} />
            <Sel value={methodFilter} onChange={e => setMethodFilter(e.target.value)} style={{ width: 110 }}>
              <option value="all">كل الطرق</option><option value="كاش">كاش</option><option value="بطاقة">بطاقة</option><option value="تحويل">تحويل</option>
            </Sel>
          </div>
        } />
        {shown.length === 0 ? <div style={{ textAlign: "center", color: C.mt, padding: "1.5rem" }}>لا حركات ضمن الفترة المختارة — سجّل رأس مالك الافتتاحي من «+ حركة رأس مال» للبدء</div> : (
          <Table cols={[{ h: "التاريخ", w: "11%" }, { h: "النوع", w: "13%" }, { h: "الوصف", w: "26%" }, { h: "الطريقة", w: "9%" }, { h: "المبلغ", w: "13%" }, { h: "رصيد الطريقة بعدها", w: "14%" }, { h: "الإجمالي بعدها", w: "14%" }]}
            rows={shown.map(e => [
              arDate(e.date), <Badge tone={TYPE_TONE[e.type] || "b"}>{e.type}</Badge>, e.desc, e.method,
              <span style={{ fontWeight: 700, color: e.amount >= 0 ? "#1a8c3e" : C.red }}>{e.amount >= 0 ? "+" : ""}{fmt(e.amount)} {cur}</span>,
              fmt(e.balances[e.method] !== undefined ? e.balances[e.method] : e.balances["كاش"]) + " " + cur,
              <b>{fmt(e.totalAfter)} {cur}</b>,
            ])} />
        )}
      </Card>

      {/* نافذة إضافة حركة رأس مال */}
      {modal && (
        <Modal title="حركة رأس مال" onClose={() => setModal(false)} width={440}>
          <Field label="نوع الحركة">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {MOVE_TYPES.map(t => (
                <div key={t} onClick={() => setF({ ...f, type: t })} style={{ border: `1.5px solid ${f.type === t ? C.gold : C.bc}`, borderRadius: 9, padding: ".6rem", textAlign: "center", cursor: "pointer", fontWeight: f.type === t ? 700 : 500, background: f.type === t ? C.gold + "14" : C.crm, fontSize: 13 }}>{t === "ضخ رأس مال" ? "➕ ضخ سيولة" : "➖ سحب مالك"}</div>
              ))}
            </div>
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label={"المبلغ (" + cur + ")"}><Inp type="number" min="0" value={f.amount} onChange={e => setF({ ...f, amount: e.target.value })} /></Field>
            <Field label="التاريخ"><Inp type="date" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} /></Field>
          </div>
          <Field label="الطريقة">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
              {["كاش", "بطاقة", "تحويل"].map(m => (
                <div key={m} onClick={() => setF({ ...f, method: m })} style={{ border: `1px solid ${f.method === m ? C.gold : C.bc}`, borderRadius: 8, padding: ".4rem", textAlign: "center", cursor: "pointer", fontSize: 12, fontWeight: f.method === m ? 700 : 500, background: f.method === m ? C.gold + "14" : C.crm }}>{m}</div>
              ))}
            </div>
          </Field>
          <Field label="ملاحظة (اختياري)"><Inp value={f.note} onChange={e => setF({ ...f, note: e.target.value })} placeholder={f.type === "ضخ رأس مال" ? "مثال: رأس مال افتتاحي" : "مثال: سحب أرباح شخصية"} /></Field>
          <div style={{ fontSize: 10.5, color: C.mt, margin: "4px 0 12px", lineHeight: 1.7 }}>💡 استخدم «ضخ سيولة» عند إضافة أموال جديدة للنادي (رأس مال افتتاحي أو دعم إضافي)، و«سحب مالك» عند سحب أرباح لنفسك — كلاهما يُحتسب في كشف الحساب والرصيد الحالي فوراً.</div>
          <div style={{ display: "flex", gap: 8 }}><Btn gold onClick={saveMove} style={{ flex: 1, justifyContent: "center" }}>✓ تسجيل الحركة</Btn><Btn onClick={() => setModal(false)}>إلغاء</Btn></div>
        </Modal>
      )}
    </>
  );
}

function Salaries({ ctx }) {
  const { employees, setEmployees, expenses, setExpenses, leaves, setLeaves, deductions, setDeductions, invoices, setInvoices, showToast } = ctx;
  const cur = ctx.settings?.currency || "د.ل";
  const [modal, setModal] = useState(false);
  const [detail, setDetail] = useState(null); // employee id being viewed
  const [f, setF] = useState({ name: "", role: "", salary: "", salaryStart: todayISO() });

  const save = () => {
    if (!f.name.trim() || !f.salary) { showToast("أدخل الاسم والراتب"); return; }
    setEmployees(e => [...e, { id: Math.max(0, ...e.map(x => x.id)) + 1, name: f.name, role: f.role || "موظف", hired: f.salaryStart, salaryStart: f.salaryStart, salary: parseFloat(f.salary), status: "نشط" }]);
    showToast("تمت إضافة الموظف"); setModal(false); setF({ name: "", role: "", salary: "", salaryStart: todayISO() });
  };

  // سلف الموظف من المصاريف
  const advancesOf = (id) => expenses.filter(e => e.empId == id && e.cat === "سلفة موظف");
  const takenOf = (id) => advancesOf(id).reduce((s, e) => s + e.amount, 0);
  // خصومات العطلات والإجازات
  const leavesOf = (id) => (leaves || []).filter(l => l.empId == id);
  const leaveDeductOf = (id) => leavesOf(id).reduce((s, l) => s + l.deduction, 0);
  // خصومات وجزاءات (تأخير، مخالفات...)
  const deductionsOf = (id) => (deductions || []).filter(d => d.empId == id);
  const deductionAmountOf = (id) => deductionsOf(id).reduce((s, d) => s + d.amount, 0);
  // مشتريات من نقطة البيع على حساب الراتب (لم تُسوَّ بعد في دورة راتب سابقة)
  const purchasesOf = (id) => invoices.filter(i => i.empId == id && i.pay === "موظف" && !i.salarySettled);
  const purchasesAmountOf = (id) => purchasesOf(id).reduce((s, i) => s + i.total, 0);
  const remainOf = (emp) => emp.salary - takenOf(emp.id) - leaveDeductOf(emp.id) - deductionAmountOf(emp.id) - purchasesAmountOf(emp.id);

  // تصفية راتب الموظف (نهاية الشهر): صرف المتبقي كمصروف وتصفير السلف والعطلات والخصومات ومشتريات نقطة البيع
  const settle = (emp) => {
    const remain = remainOf(emp);
    const leaveDed = leaveDeductOf(emp.id);
    const penaltyDed = deductionAmountOf(emp.id);
    const purchDed = purchasesAmountOf(emp.id);
    if (!window.confirm(`تصفية راتب ${emp.name}؟\nالراتب: ${fmt(emp.salary)} ${cur}\nالسلف المسحوبة: ${fmt(takenOf(emp.id))} ${cur}\nخصم العطلات: ${fmt(leaveDed)} ${cur}\nخصومات وجزاءات: ${fmt(penaltyDed)} ${cur}\nمشتريات نقطة البيع: ${fmt(purchDed)} ${cur}\nالمتبقي للصرف: ${fmt(remain)} ${cur}\n\nسيُسجّل المتبقي كمصروف مرتب وتبدأ دورة جديدة.`)) return;
    // سجّل صرف باقي الراتب كمصروف
    if (remain > 0) {
      setExpenses(ex => [{ id: Math.max(0, ...ex.map(x => x.id)) + 1, date: todayISO(), cat: "مرتبات", desc: `صرف باقي راتب ${emp.name}`, amount: remain, pay: "نقداً", by: "المدير", empId: null, empName: null }, ...ex]);
    }
    // احذف سلف هذا الموظف وعطلاته وخصوماته المسجّلة (تصفير الدورة)، وعلِّم مشترياته كمُسوّاة (تبقى الفواتير نفسها بلا حذف — سجلات بيع حقيقية)
    setExpenses(ex => ex.filter(e => !(e.empId == emp.id && e.cat === "سلفة موظف")));
    setLeaves(ls => ls.filter(l => l.empId != emp.id));
    setDeductions(ds => ds.filter(d => d.empId != emp.id));
    setInvoices(iv => iv.map(i => (i.empId == emp.id && i.pay === "موظف" && !i.salarySettled) ? { ...i, salarySettled: true } : i));
    setEmployees(es => es.map(e => e.id === emp.id ? { ...e, salaryStart: todayISO() } : e));
    showToast(`تمت تصفية راتب ${emp.name} وبدء دورة جديدة`);
    setDetail(null);
  };

  const totalSalaries = employees.reduce((s, e) => s + e.salary, 0);
  const totalRemain = employees.reduce((s, e) => s + remainOf(e), 0);

  return (
    <>
      <PageTop title="مرتبات العمال" action={<Btn gold onClick={() => setModal(true)}>+ إضافة موظف</Btn>} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 11, marginBottom: "1.1rem" }}>
        <KCard label="عدد الموظفين" value={employees.length} sub="نشط" bar="#2a78d6" />
        <KCard label="إجمالي الرواتب" value={fmt(totalSalaries)} sub={cur + " شهرياً"} bar={C.gold} />
        <KCard label="المتبقي للصرف" value={fmt(totalRemain)} sub="بعد السلف" bar="#1a8c3e" />
      </div>

      {/* بطاقات الموظفين */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(270px,1fr))", gap: 12 }}>
        {employees.length === 0 && <Card><div style={{ textAlign: "center", color: C.mt, padding: "1.5rem" }}>لا موظفون بعد — أضف أول موظف.</div></Card>}
        {employees.map(emp => {
          const taken = takenOf(emp.id);
          const remain = remainOf(emp);
          const pct = emp.salary ? Math.max(0, Math.min(100, Math.round(remain / emp.salary * 100))) : 0;
          return (
            <Card key={emp.id} className="nk-card-hover">
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: C.grl, color: "#fff", fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{emp.name.slice(0, 2)}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{emp.name}</div>
                  <div style={{ fontSize: 11, color: C.mt }}>{emp.role} · منذ {arDate(emp.salaryStart)}</div>
                </div>
              </div>

              {/* شريط الراتب المتبقي */}
              <div style={{ marginBottom: 6, display: "flex", justifyContent: "space-between", fontSize: 11.5 }}>
                <span style={{ color: C.mt }}>المتبقي من الراتب</span>
                <span style={{ fontWeight: 700, color: remain < 0 ? C.red : C.grn2 }}>{fmt(remain)} / {fmt(emp.salary)} {cur}</span>
              </div>
              <div style={{ height: 9, borderRadius: 5, background: "#eee", overflow: "hidden", marginBottom: 10 }}>
                <div style={{ width: pct + "%", height: "100%", background: pct < 25 ? "#e34948" : pct < 60 ? C.gold : "#1a8c3e", transition: "width .3s" }} />
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, marginBottom: 4 }}><span style={{ color: C.mt }}>الراتب الأساسي</span><span style={{ fontWeight: 600 }}>{fmt(emp.salary)} {cur}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, marginBottom: 4 }}><span style={{ color: C.mt }}>السلف المسحوبة</span><span style={{ fontWeight: 600, color: C.purp }}>− {fmt(taken)} {cur}</span></div>
              {leaveDeductOf(emp.id) > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, marginBottom: 4 }}><span style={{ color: C.mt }}>خصم العطلات ({leavesOf(emp.id).reduce((s, l) => s + l.days, 0)} يوم)</span><span style={{ fontWeight: 600, color: "#8a6a20" }}>− {fmt(leaveDeductOf(emp.id))} {cur}</span></div>}
              {deductionAmountOf(emp.id) > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, marginBottom: 4 }}><span style={{ color: C.mt }}>خصومات وجزاءات ({deductionsOf(emp.id).length})</span><span style={{ fontWeight: 600, color: C.red }}>− {fmt(deductionAmountOf(emp.id))} {cur}</span></div>}
              {purchasesAmountOf(emp.id) > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, marginBottom: 4 }}><span style={{ color: C.mt }}>مشتريات نقطة البيع ({purchasesOf(emp.id).length})</span><span style={{ fontWeight: 600, color: C.blue }}>− {fmt(purchasesAmountOf(emp.id))} {cur}</span></div>}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, paddingTop: 6, borderTop: `0.5px solid ${C.bc}`, marginTop: 4 }}><span style={{ fontWeight: 700 }}>الصافي المتبقي</span><span style={{ fontWeight: 800, color: remain < 0 ? C.red : C.grn2 }}>{fmt(remain)} {cur}</span></div>

              <div style={{ display: "flex", gap: 7, marginTop: 12 }}>
                <Btn sm onClick={() => setDetail(emp.id)} style={{ flex: 1, justifyContent: "center" }}>📋 التفاصيل ({advancesOf(emp.id).length + leavesOf(emp.id).length + deductionsOf(emp.id).length + purchasesOf(emp.id).length})</Btn>
                <Btn sm gold onClick={() => settle(emp)} style={{ flex: 1, justifyContent: "center" }}>💰 تصفية</Btn>
              </div>
            </Card>
          );
        })}
      </div>

      {/* نافذة تفاصيل السلف والعطلات والخصومات */}
      {detail && (() => {
        const emp = employees.find(e => e.id === detail);
        const advs = advancesOf(detail);
        const lvs = leavesOf(detail);
        const dds = deductionsOf(detail);
        const purchs = purchasesOf(detail);
        return (
          <Modal title={`تفاصيل الراتب — ${emp.name}`} onClose={() => setDetail(null)} width={580}>
            <div style={{ background: C.crm, borderRadius: 10, padding: ".8rem 1rem", marginBottom: 12, display: "flex", justifyContent: "space-around", textAlign: "center", flexWrap: "wrap", gap: 8 }}>
              <div><div style={{ fontSize: 16, fontWeight: 800, color: C.grn2 }}>{fmt(emp.salary)}</div><div style={{ fontSize: 10.5, color: C.mt }}>الراتب</div></div>
              <div><div style={{ fontSize: 16, fontWeight: 800, color: C.purp }}>{fmt(takenOf(detail))}</div><div style={{ fontSize: 10.5, color: C.mt }}>السلف</div></div>
              <div><div style={{ fontSize: 16, fontWeight: 800, color: "#8a6a20" }}>{fmt(leaveDeductOf(detail))}</div><div style={{ fontSize: 10.5, color: C.mt }}>خصم العطلات</div></div>
              <div><div style={{ fontSize: 16, fontWeight: 800, color: C.red }}>{fmt(deductionAmountOf(detail))}</div><div style={{ fontSize: 10.5, color: C.mt }}>خصومات وجزاءات</div></div>
              <div><div style={{ fontSize: 16, fontWeight: 800, color: C.blue }}>{fmt(purchasesAmountOf(detail))}</div><div style={{ fontSize: 10.5, color: C.mt }}>مشتريات نقطة البيع</div></div>
              <div><div style={{ fontSize: 16, fontWeight: 800, color: remainOf(emp) < 0 ? C.red : "#1a8c3e" }}>{fmt(remainOf(emp))}</div><div style={{ fontSize: 10.5, color: C.mt }}>المتبقي</div></div>
            </div>

            <div style={{ fontSize: 12.5, fontWeight: 700, color: C.grn2, marginBottom: 6 }}>💰 السلف</div>
            {advs.length === 0 ? <div style={{ textAlign: "center", color: C.mt, fontSize: 12, padding: "1rem" }}>لا سلف مسجّلة.</div> : (
              <Table cols={[{ h: "التاريخ", w: "25%" }, { h: "الوصف", w: "45%" }, { h: "المبلغ", w: "30%" }]}
                rows={advs.map(a => [arDate(a.date), a.desc, fmt(a.amount) + " " + cur])} />
            )}

            <div style={{ fontSize: 12.5, fontWeight: 700, color: C.grn2, margin: "1rem 0 6px" }}>🏖 العطلات والإجازات</div>
            {lvs.length === 0 ? <div style={{ textAlign: "center", color: C.mt, fontSize: 12, padding: "1rem" }}>لا عطلات مسجّلة لهذه الدورة.</div> : (
              <Table cols={[{ h: "التاريخ", w: "20%" }, { h: "الأيام", w: "12%" }, { h: "السبب", w: "38%" }, { h: "الخصم", w: "30%" }]}
                rows={lvs.map(l => [arDate(l.date), l.days, l.reason, fmt(l.deduction) + " " + cur])} />
            )}

            <div style={{ fontSize: 12.5, fontWeight: 700, color: C.red, margin: "1rem 0 6px" }}>⚠️ خصومات وجزاءات</div>
            {dds.length === 0 ? <div style={{ textAlign: "center", color: C.mt, fontSize: 12, padding: "1rem" }}>لا خصومات مسجّلة لهذه الدورة.</div> : (
              <Table cols={[{ h: "التاريخ", w: "20%" }, { h: "السبب", w: "38%" }, { h: "ملاحظة", w: "22%" }, { h: "المبلغ", w: "20%" }]}
                rows={dds.map(d => [arDate(d.date), d.reason, d.note || "—", fmt(d.amount) + " " + cur])} />
            )}

            <div style={{ fontSize: 12.5, fontWeight: 700, color: C.blue, margin: "1rem 0 6px" }}>🛍 مشتريات من نقطة البيع</div>
            {purchs.length === 0 ? <div style={{ textAlign: "center", color: C.mt, fontSize: 12, padding: "1rem" }}>لا مشتريات مسجّلة لهذه الدورة.</div> : (
              <Table cols={[{ h: "التاريخ", w: "18%" }, { h: "رقم الفاتورة", w: "20%" }, { h: "التفاصيل", w: "42%" }, { h: "المبلغ", w: "20%" }]}
                rows={purchs.map(i => [arDate(i.date), "#" + i.id, i.details, fmt(i.total) + " " + cur])} />
            )}

            <div style={{ marginTop: 12, fontSize: 11, color: C.mt, background: "rgba(201,168,76,.08)", borderRadius: 8, padding: ".6rem .8rem", lineHeight: 1.7 }}>💡 السلف تُسجَّل من قسم المصاريف (فئة «سلفة موظف»). العطلات والخصومات تُسجَّلان من «سجل حركات الموظفين». مشتريات نقطة البيع تُسجَّل عند اختيار «آجل — موظف» أثناء البيع. الأربعة تُخصم تلقائياً من رصيد الراتب، وتُصفَّر معاً عند تصفية الراتب (تبقى الفواتير نفسها محفوظة كسجل مبيعات دائم).</div>
          </Modal>
        );
      })()}

      {modal && <Modal title="إضافة موظف" onClose={() => setModal(false)} width={460}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="الاسم" full><Inp value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="محمد علي" /></Field>
          <Field label="المنصب"><Inp value={f.role} onChange={e => setF({ ...f, role: e.target.value })} placeholder="كاشير" /></Field>
          <Field label={"الراتب الشهري (" + cur + ")"}><Inp type="number" value={f.salary} onChange={e => setF({ ...f, salary: e.target.value })} /></Field>
          <Field label="تاريخ بداية العمل/الراتب" full><Inp type="date" value={f.salaryStart} onChange={e => setF({ ...f, salaryStart: e.target.value })} /></Field>
        </div>
        <div style={{ fontSize: 11, color: C.mt, marginBottom: 10, lineHeight: 1.7 }}>يبدأ احتساب الراتب من التاريخ المحدد. عند نهاية الشهر استخدم زر «تصفية» لصرف المتبقي وبدء دورة جديدة.</div>
        <div style={{ display: "flex", gap: 8 }}><Btn gold onClick={save} style={{ flex: 1, justifyContent: "center" }}>✓ حفظ</Btn><Btn onClick={() => setModal(false)}>إلغاء</Btn></div>
      </Modal>}
    </>
  );
}

/* ============================ INSIGHTS (لوحة الرؤى والتحليلات البيانية) ============================ */

// شريط أعمدة مزدوج للمقارنة (الشهر الحالي مقابل الشهر الماضي)
function CompareBarChart({ data, labelA, labelB, colorA, colorB, cur }) {
  const max = Math.max(1, ...data.map(d => Math.max(d.a, d.b)));
  const H = 190, barW = 22, gap = 10, groupGap = 34;
  const W = data.length * (barW * 2 + gap + groupGap) + 20;
  return (
    <div style={{ overflowX: "auto" }}>
      <svg viewBox={`0 0 ${Math.max(W, 320)} ${H + 46}`} style={{ width: "100%", minWidth: 320, height: H + 46 }}>
        {[0, 0.25, 0.5, 0.75, 1].map((f, i) => (
          <line key={i} x1={10} x2={W - 10} y1={H - f * (H - 30) + 6} y2={H - f * (H - 30) + 6} stroke={C.bc} strokeWidth="1" />
        ))}
        {data.map((d, i) => {
          const gx = 20 + i * (barW * 2 + gap + groupGap);
          const ha = (d.a / max) * (H - 30), hb = (d.b / max) * (H - 30);
          return (
            <g key={i}>
              <rect x={gx} y={H - ha + 6} width={barW} height={Math.max(ha, 1)} rx={4} fill={colorA} className="nk-bar-grow" style={{ transformOrigin: `${gx + barW / 2}px ${H + 6}px`, animationDelay: `${i * 70}ms` }} />
              <rect x={gx + barW + gap} y={H - hb + 6} width={barW} height={Math.max(hb, 1)} rx={4} fill={colorB} className="nk-bar-grow" style={{ transformOrigin: `${gx + barW + gap + barW / 2}px ${H + 6}px`, animationDelay: `${i * 70 + 40}ms` }} />
              <text x={gx + barW + gap / 2} y={H + 26} textAnchor="middle" fontSize="11" fill={C.mt} fontFamily="Tajawal,sans-serif">{d.label}</text>
            </g>
          );
        })}
      </svg>
      <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 6 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: C.k2 }}><i style={{ width: 10, height: 10, borderRadius: 3, background: colorA, display: "inline-block" }} />{labelA}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: C.k2 }}><i style={{ width: 10, height: 10, borderRadius: 3, background: colorB, display: "inline-block" }} />{labelB}</span>
      </div>
    </div>
  );
}

// خط اتجاه مزدوج (الشهر الحالي مقابل الماضي) — مساحة مملوءة للحالي وخط متقطع للماضي
function TrendChart({ curSeries, prevSeries, colorA, colorB }) {
  const W = 640, H = 190, pad = 8;
  const allVals = [...curSeries, ...prevSeries].filter(v => v != null);
  const max = Math.max(1, ...allVals);
  const n = Math.max(curSeries.length, prevSeries.length);
  const x = (i) => pad + (i / (n - 1)) * (W - pad * 2);
  const y = (v) => H - pad - (v / max) * (H - pad * 2 - 10);

  const pathFor = (series, close) => {
    const pts = series.map((v, i) => (v == null ? null : [x(i), y(v)])).filter(Boolean);
    if (pts.length === 0) return "";
    let d = `M ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) d += ` L ${pts[i][0]} ${pts[i][1]}`;
    if (close && pts.length) d += ` L ${pts[pts.length - 1][0]} ${H - pad} L ${pts[0][0]} ${H - pad} Z`;
    return d;
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: H }}>
      {[0.25, 0.5, 0.75, 1].map((f, i) => <line key={i} x1={pad} x2={W - pad} y1={pad + f * (H - pad * 2 - 10)} y2={pad + f * (H - pad * 2 - 10)} stroke={C.bc} strokeWidth="1" />)}
      <path d={pathFor(curSeries, true)} fill={colorA + "22"} stroke="none" />
      <path d={pathFor(prevSeries, false)} fill="none" stroke={colorB} strokeWidth="2" strokeDasharray="5 4" opacity=".85" />
      <path d={pathFor(curSeries, false)} fill="none" stroke={colorA} strokeWidth="2.5" className="nk-trend-draw" style={{ strokeDasharray: 2000, "--nk-tlen": "2000px" }} />
    </svg>
  );
}

// أعمدة أفقية مرتّبة (تصنيف)
function RankBarChart({ data, color, cur }) {
  const max = Math.max(1, ...data.map(d => d.value));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {data.map((d, i) => (
        <div key={i}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
            <span style={{ fontWeight: 600 }}>{i === 0 ? "🥇 " : i === 1 ? "🥈 " : i === 2 ? "🥉 " : ""}{d.label}</span>
            <span style={{ color: C.mt }}>{fmt(d.value)} {cur}</span>
          </div>
          <div style={{ height: 8, borderRadius: 4, background: C.crm, overflow: "hidden" }}>
            <div className="nk-bar-grow-x" style={{ width: (d.value / max * 100) + "%", height: "100%", background: color, transformOrigin: "right", animationDelay: `${i * 80}ms` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Insights({ ctx }) {
  const { invoices, expenses, cats, products, employees, rentals } = ctx;
  const cur = ctx.settings?.currency || "د.ل";

  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  const curStart = new Date(y, m, 1);
  const prevStart = new Date(y, m - 1, 1);
  const daysElapsed = now.getDate();
  const daysInPrevMonth = new Date(y, m, 0).getDate();
  const daysInCurMonth = new Date(y, m + 1, 0).getDate();
  const iso = (d) => d.toISOString().slice(0, 10);
  const dateOf = (base, day) => iso(new Date(base.getFullYear(), base.getMonth(), day));

  const paid = useMemo(() => invoices.filter(i => i.status === "مدفوعة"), [invoices]);

  // إيراد يوم بعينه من شهر بعينه
  const revOnDay = (base, day) => paid.filter(i => i.date === dateOf(base, day)).reduce((s, i) => s + i.total, 0);

  // ------- 1) مقارنة KPI: نفس عدد الأيام من كل شهر (مقارنة عادلة) -------
  const sumRange = (base, fromDay, toDay) => {
    let rev = 0, count = 0, cost = 0;
    for (let d = fromDay; d <= toDay; d++) {
      const dISO = dateOf(base, d);
      paid.filter(i => i.date === dISO).forEach(i => { rev += i.total; count++; cost += i.cost || 0; });
    }
    return { rev, count, cost };
  };
  const curPeriod = sumRange(curStart, 1, daysElapsed);
  const prevPeriod = sumRange(prevStart, 1, Math.min(daysElapsed, daysInPrevMonth));
  const expInRange = (base, fromDay, toDay) => expenses.filter(e => e.date >= dateOf(base, fromDay) && e.date <= dateOf(base, toDay)).reduce((s, e) => s + e.amount, 0);
  const curExp = expInRange(curStart, 1, daysElapsed);
  const prevExp = expInRange(prevStart, 1, Math.min(daysElapsed, daysInPrevMonth));
  const curProfit = curPeriod.rev - curPeriod.cost - curExp;
  const prevProfit = prevPeriod.rev - prevPeriod.cost - prevExp;
  const pctDelta = (a, b) => b === 0 ? (a > 0 ? 100 : 0) : Math.round(((a - b) / b) * 100);
  // نسبة التغيّر مضلِّلة رياضياً عند تقاطع الصفر أو القيم السالبة (كصافي الربح) — نعرض فرقاً بالعملة عندها بدل نسبة مربكة
  const deltaLabel = (a, b, suffix = "") => {
    if (a >= 0 && b >= 0) return `${pctDelta(a, b)}%${suffix}`;
    const diff = Math.round(a - b);
    return `${diff >= 0 ? "+" : ""}${fmt(diff)} ${cur}${suffix}`;
  };

  // ------- 2) الرؤية المستقبلية: توقّع نهاية الشهر بمعدل الأداء الحالي -------
  const dailyAvg = daysElapsed ? curPeriod.rev / daysElapsed : 0;
  const projectedMonthTotal = Math.round(dailyAvg * daysInCurMonth);
  const prevMonthFullTotal = paid.filter(i => i.date >= iso(prevStart) && i.date < iso(curStart)).reduce((s, i) => s + i.total, 0);
  const projDelta = pctDelta(projectedMonthTotal, prevMonthFullTotal);

  // ------- 3) المبيعات حسب الأقسام: الشهر الحالي مقابل الماضي (نفس عدد الأيام) -------
  const catRevInRange = (base, fromDay, toDay) => {
    const map = {};
    for (let d = fromDay; d <= toDay; d++) {
      const dISO = dateOf(base, d);
      paid.filter(i => i.date === dISO).forEach(i => {
        if (i.items) i.items.forEach(it => { map[it.cat] = (map[it.cat] || 0) + it.lineTotal; });
      });
    }
    return map;
  };
  const curCat = catRevInRange(curStart, 1, daysElapsed);
  const prevCat = catRevInRange(prevStart, 1, Math.min(daysElapsed, daysInPrevMonth));
  const catKeys = Object.keys(cats);
  const catData = catKeys.map(k => ({ label: cats[k], a: curCat[k] || 0, b: prevCat[k] || 0 })).filter(d => d.a + d.b > 0);

  // ------- 4) اتجاه الإيراد اليومي: الشهر الحالي مقابل الماضي (كامل) -------
  const curSeries = Array.from({ length: daysInCurMonth }, (_, i) => i < daysElapsed ? revOnDay(curStart, i + 1) : null);
  const prevSeries = Array.from({ length: daysInPrevMonth }, (_, i) => revOnDay(prevStart, i + 1));

  // ------- 5) إيراد الحجوزات حسب المورد -------
  const resRevInRange = (base, fromDay, toDay) => {
    const map = {};
    for (let d = fromDay; d <= toDay; d++) {
      const dISO = dateOf(base, d);
      paid.filter(i => i.date === dISO && i.source === "حجز").forEach(i => {
        const t = i.resType || Object.keys(TYPE_NAME).find(k => i.details && i.details.includes(TYPE_NAME[k]));
        if (t) map[t] = (map[t] || 0) + i.total;
      });
    }
    return map;
  };
  const curRes = resRevInRange(curStart, 1, daysElapsed);
  const prevRes = resRevInRange(prevStart, 1, Math.min(daysElapsed, daysInPrevMonth));
  const resData = Object.keys(TYPE_NAME).map(k => ({ label: TYPE_NAME[k], a: curRes[k] || 0, b: prevRes[k] || 0 })).filter(d => d.a + d.b > 0);

  // ------- 6) أفضل 5 موظفين هذا الشهر -------
  const empRev = {};
  paid.filter(i => i.date >= iso(curStart) && i.by).forEach(i => { empRev[i.by] = (empRev[i.by] || 0) + i.total; });
  const topEmployees = Object.entries(empRev).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([label, value]) => ({ label, value }));

  const hasCatData = catData.length > 0, hasResData = resData.length > 0, hasEmpData = topEmployees.length > 0;

  return (
    <>
      <PageTop title="📈 الرؤى والتحليلات البيانية" action={<Badge tone="gold">حتى يوم {daysElapsed} من {daysInCurMonth}</Badge>} />

      {/* KPI: الشهر الحالي مقابل نفس الفترة من الشهر الماضي */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 11, marginBottom: "1.1rem" }}>
        <KCard label="الإيراد (حتى الآن)" value={fmt(curPeriod.rev)} sub={cur} bar="#1a8c3e" delta={{ up: curPeriod.rev >= prevPeriod.rev, text: `${pctDelta(curPeriod.rev, prevPeriod.rev)}% عن نفس فترة الشهر الماضي` }} />
        <KCard label="عدد الفواتير" value={curPeriod.count} bar="#2a78d6" delta={{ up: curPeriod.count >= prevPeriod.count, text: `${pctDelta(curPeriod.count, prevPeriod.count)}%` }} />
        <KCard label="متوسط الفاتورة" value={fmt(curPeriod.count ? Math.round(curPeriod.rev / curPeriod.count) : 0)} sub={cur} bar={C.gold} />
        <KCard label="صافي الربح التقديري" value={fmt(curProfit)} sub={cur} bar={C.purp} delta={{ up: curProfit >= prevProfit, text: deltaLabel(curProfit, prevProfit) + " عن نفس الفترة الماضية" }} />
      </div>

      {/* الرؤية المستقبلية — العنصر المميّز بالصفحة */}
      <Card className="nk-card-hover" style={{ marginBottom: "1.1rem", background: "linear-gradient(135deg,#14431f,#1a5c2e)", border: "none", color: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 18 }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 12, color: C.gld, fontWeight: 700, marginBottom: 6 }}>🔮 الرؤية المستقبلية — توقّع نهاية الشهر</div>
            <div style={{ fontSize: 26, fontWeight: 900 }}>{fmt(projectedMonthTotal)} <span style={{ fontSize: 13, fontWeight: 500, color: C.gld }}>{cur}</span></div>
            <div style={{ fontSize: 11.5, color: "rgba(255,255,255,.75)", marginTop: 4 }}>بمعدل الأداء الحالي ({fmt(Math.round(dailyAvg))} {cur}/يوم) — تقدير تقريبي وليس تنبؤاً دقيقاً</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: projDelta >= 0 ? "#8ee6a8" : "#ff9b9b" }}>{projDelta >= 0 ? "▲" : "▼"} {Math.abs(projDelta)}%</div>
            <div style={{ fontSize: 10.5, color: "rgba(255,255,255,.7)" }}>مقارنة بالشهر الماضي كاملاً<br />({fmt(prevMonthFullTotal)} {cur})</div>
          </div>
          <div style={{ minWidth: 140 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: "rgba(255,255,255,.75)", marginBottom: 4 }}><span>اكتمل الشهر</span><span>{Math.round(daysElapsed / daysInCurMonth * 100)}%</span></div>
            <div style={{ height: 8, borderRadius: 4, background: "rgba(255,255,255,.2)", overflow: "hidden" }}><div style={{ width: (daysElapsed / daysInCurMonth * 100) + "%", height: "100%", background: C.gold }} /></div>
          </div>
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: ctx.scr?.isTab ? "1fr" : "1.3fr 1fr", gap: 12, marginBottom: 12 }}>
        <Card className="nk-card-hover">
          <CardHead title="اتجاه الإيراد اليومي" sub="الشهر الحالي (مساحة) مقابل الشهر الماضي (متقطّع)" />
          <TrendChart curSeries={curSeries} prevSeries={prevSeries} colorA={C.grl} colorB={C.gold} />
          <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 4 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: C.k2 }}><i style={{ width: 14, height: 3, borderRadius: 2, background: C.grl, display: "inline-block" }} />هذا الشهر</span>
            <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: C.k2 }}><i style={{ width: 14, height: 3, borderRadius: 2, background: C.gold, display: "inline-block" }} />الشهر الماضي</span>
          </div>
        </Card>
        <Card className="nk-card-hover">
          <CardHead title="🏆 أفضل الموظفين هذا الشهر" sub="حسب إيراد المبيعات المسجَّلة" />
          {hasEmpData ? <RankBarChart data={topEmployees} color={C.grl} cur={cur} /> : <div style={{ textAlign: "center", color: C.mt, fontSize: 12, padding: "2rem 0" }}>لا بيانات كافية بعد هذا الشهر</div>}
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: ctx.scr?.isTab ? "1fr" : "1fr 1fr", gap: 12 }}>
        <Card className="nk-card-hover">
          <CardHead title="المبيعات حسب الأقسام" sub="هذا الشهر مقابل نفس الفترة من الشهر الماضي" />
          {hasCatData ? <CompareBarChart data={catData} labelA="هذا الشهر" labelB="الشهر الماضي" colorA={C.grl} colorB={C.gold} cur={cur} /> : <div style={{ textAlign: "center", color: C.mt, fontSize: 12, padding: "2rem 0" }}>لا بيانات أقسام كافية (تنطبق على الفواتير المُصدرة بعد تفعيل هذه الميزة)</div>}
        </Card>
        <Card className="nk-card-hover">
          <CardHead title="إيراد الحجوزات حسب المورد" sub="هذا الشهر مقابل نفس الفترة من الشهر الماضي" />
          {hasResData ? <CompareBarChart data={resData} labelA="هذا الشهر" labelB="الشهر الماضي" colorA="#2a78d6" colorB={C.gold} cur={cur} /> : <div style={{ textAlign: "center", color: C.mt, fontSize: 12, padding: "2rem 0" }}>لا حجوزات كافية للمقارنة بعد</div>}
        </Card>
      </div>
    </>
  );
}

/* ============================ REPORTS ============================ */
function Reports({ ctx }) {
  const { invoices, purchases, expenses, products, totals, assets, waste, cats, rentals, rentalDevices } = ctx;
  const [type, setType] = useState("sales");
  const [cat, setCat] = useState("");       // فلتر القسم (منتجات / تتبع مبيعات قسم)
  const [source, setSource] = useState(""); // فلتر المصدر لتقرير المبيعات العام
  const [resType, setResType] = useState(""); // فلتر نوع الجهاز/الطاولة لتقرير الحجوزات
  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split("T")[0]; });
  const [to, setTo] = useState(todayISO());
  const printRef = useRef(null);
  const inRange = (d) => d >= from && d <= to;

  const cfg = useMemo(() => {
    const cur = ctx.settings?.currency || "د.ل";

    if (type === "sales") {
      const rows = invoices.filter(i => inRange(i.date) && (!source || i.source === source));
      const paid = rows.filter(i => i.status === "مدفوعة");
      const rev = paid.reduce((s, i) => s + i.total, 0);
      const avg = paid.length ? Math.round(rev / paid.length) : 0;
      return { title: "تقرير المبيعات", summary: [["إجمالي المبيعات", fmt(rev) + " " + cur], ["عدد الفواتير", rows.length], ["متوسط الفاتورة", fmt(avg) + " " + cur]],
        thead: ["رقم", "الزبون", "المصدر", "التفاصيل", "الدفع", "الإجمالي"], tbody: rows.map(i => ["#" + i.id, i.customer, i.source, i.details, i.paidVia ? `آجل ← ${i.paidVia}` : i.pay, fmt(i.total) + " " + cur]) };
    }

    if (type === "purchases") {
      const rows = purchases.filter(p => inRange(p.date));
      return { title: "تقرير المشتريات", summary: [["إجمالي المشتريات", fmt(rows.reduce((s, p) => s + p.total, 0)) + " " + cur], ["عدد الطلبات", rows.length], ["الموردون", ctx.suppliers.length]], thead: ["رقم", "المورد", "المنتجات", "الدفع", "الإجمالي"], tbody: rows.map(p => ["#" + p.id, p.supplier, p.items, p.pay, fmt(p.total) + " " + cur]) };
    }

    if (type === "profit") {
      const paidR = invoices.filter(i => i.status === "مدفوعة" && inRange(i.date));
      const revenue = paidR.reduce((s, i) => s + i.total, 0);
      const cogs = paidR.reduce((s, i) => s + (i.cost || 0), 0);
      const expR = expenses.filter(e => inRange(e.date)).reduce((s, e) => s + e.amount, 0);
      const wasteR = (waste || []).filter(w => inRange(w.date)).reduce((s, w) => s + w.cost, 0);
      const profit = revenue - cogs - wasteR - expR;
      return { title: "تقرير الأرباح والخسائر", summary: [["الإيرادات", fmt(revenue) + " " + cur], ["المصاريف", fmt(expR) + " " + cur], ["صافي الربح", fmt(profit) + " " + cur]],
        thead: ["البند", "القيمة"], tbody: [["إجمالي الإيرادات", fmt(revenue) + " " + cur], ["تكلفة البضاعة المباعة", fmt(cogs) + " " + cur], ["خسائر الإتلاف", fmt(wasteR) + " " + cur], ["إجمالي المصاريف", fmt(expR) + " " + cur], ["صافي الربح", fmt(profit) + " " + cur], ["هامش الربح", (revenue ? (profit / revenue * 100).toFixed(1) : 0) + "%"]] };
    }

    if (type === "expenses") {
      const rows = expenses.filter(e => inRange(e.date));
      const byCat = {};
      rows.forEach(e => { byCat[e.cat] = (byCat[e.cat] || 0) + e.amount; });
      const top = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
      const total = rows.reduce((s, e) => s + e.amount, 0);
      return { title: "تقرير المصاريف", summary: [["إجمالي المصاريف", fmt(total) + " " + cur], ["عدد البنود", rows.length], ["أكبر فئة", top ? top[0] : "—"]], thead: ["التاريخ", "الفئة", "الوصف", "المبلغ"], tbody: rows.map(e => [arDate(e.date), e.cat, e.desc, fmt(e.amount) + " " + cur]) };
    }

    if (type === "assets") {
      const active = assets.filter(a => a.status === "active").length;
      const maint = assets.filter(a => a.status === "maintenance").length;
      const damaged = assets.filter(a => a.status === "damaged").length;
      const lost = assets.filter(a => a.status === "lost").length;
      const val = assets.filter(a => a.status === "active" || a.status === "maintenance").reduce((s, a) => s + (a.cost || 0) * (a.qty || 1), 0);
      return { title: "تقرير موارد النادي", summary: [["قيمة الموجودات", fmt(val) + " " + cur], ["موجود / صيانة", active + " / " + maint], ["تالف / مفقود", damaged + " / " + lost]],
        thead: ["المورد", "الفئة", "العدد", "تاريخ الإضافة", "التكلفة", "الحالة"],
        tbody: assets.map(a => [a.name, a.cat, a.qty, arDate(a.addedAt), a.cost ? fmt(a.cost) + " " + cur : "—", ASSET_STATUS[a.status].label]) };
    }

    if (type === "waste") {
      const rows = (waste || []).filter(w => inRange(w.date));
      const total = rows.reduce((s, w) => s + w.cost, 0);
      const byReason = {};
      rows.forEach(w => { byReason[w.reason] = (byReason[w.reason] || 0) + w.cost; });
      const topReason = Object.entries(byReason).sort((a, b) => b[1] - a[1])[0];
      return { title: "تقرير الإتلاف والهالك", summary: [["إجمالي الخسائر", fmt(total) + " " + cur], ["عدد الحوادث", rows.length], ["أكثر سبب", topReason ? topReason[0] : "—"]],
        thead: ["التاريخ", "الصنف", "الكمية", "السبب", "الخسارة", "بواسطة"], tbody: rows.map(w => [arDate(w.date), w.name, w.qty, w.reason, fmt(w.cost) + " " + cur, w.by]) };
    }

    if (type === "leaderboard") {
      // تصنيف الموظفين حسب إيراد المبيعات والحجوزات المسجَّلة باسمهم ضمن الفترة
      const byEmp = {};
      invoices.filter(i => i.status === "مدفوعة" && i.by && inRange(i.date)).forEach(i => {
        if (!byEmp[i.by]) byEmp[i.by] = { count: 0, total: 0 };
        byEmp[i.by].count++; byEmp[i.by].total += i.total;
      });
      const ranked = Object.entries(byEmp).sort((a, b) => b[1].total - a[1].total);
      const grand = ranked.reduce((s, [, v]) => s + v.total, 0);
      const top = ranked[0];
      return { title: "تصنيف الموظفين حسب المبيعات", summary: [["إجمالي المبيعات المسجَّلة", fmt(grand) + " " + cur], ["عدد الموظفين النشطين", ranked.length], ["المتصدّر", top ? top[0] : "—"]],
        thead: ["الترتيب", "الموظف", "عدد الفواتير", "إجمالي المبيعات", "متوسط الفاتورة"],
        tbody: ranked.length ? ranked.map(([name, v], i) => [i === 0 ? "🥇 1" : i === 1 ? "🥈 2" : i === 2 ? "🥉 3" : i + 1, name, v.count, fmt(v.total) + " " + cur, fmt(Math.round(v.total / v.count)) + " " + cur]) : [["لا بيانات مبيعات مرتبطة بموظفين ضمن الفترة", "", "", "", ""]] };
    }

    if (type === "utilization") {
      // معدل إشغال الطاولات/الأجهزة: الساعات والإيراد لكل مورد ضمن الفترة
      const rows = invoices.filter(i => i.status === "مدفوعة" && i.source === "حجز" && inRange(i.date));
      const byRes = {};
      rows.forEach(i => {
        const key = i.resName || (i.details ? i.details.split(" — ")[1] : "—");
        const mins = parseBookingMinutes(i.details);
        if (!byRes[key]) byRes[key] = { count: 0, minutes: 0, revenue: 0, type: i.resType };
        byRes[key].count++; byRes[key].minutes += mins; byRes[key].revenue += i.total;
      });
      const ranked = Object.entries(byRes).sort((a, b) => b[1].revenue - a[1].revenue);
      const totalHours = ranked.reduce((s, [, v]) => s + v.minutes, 0) / 60;
      const totalRev = ranked.reduce((s, [, v]) => s + v.revenue, 0);
      const top = ranked[0];
      return { title: "معدل إشغال الموارد", summary: [["إجمالي ساعات الاستخدام", (Math.round(totalHours * 10) / 10) + " ساعة"], ["إجمالي الإيراد", fmt(totalRev) + " " + cur], ["الأكثر استخداماً", top ? top[0] : "—"]],
        thead: ["المورد", "النوع", "عدد الحجوزات", "إجمالي الساعات", "الإيراد", "متوسط الإيراد/ساعة"],
        tbody: ranked.length ? ranked.map(([name, v]) => [name, TYPE_NAME[v.type] || v.type || "—", v.count, (Math.round(v.minutes / 6) / 10) + " س", fmt(v.revenue) + " " + cur, v.minutes > 0 ? fmt(Math.round(v.revenue / (v.minutes / 60))) + " " + cur : "—"]) : [["لا حجوزات مسجَّلة ضمن الفترة المختارة", "", "", "", "", ""]] };
    }

    if (type === "peakHours") {
      // ساعات الذروة: توزيع الفواتير على ساعات اليوم (يعتمد على وقت الفاتورة — الفواتير القديمة قبل هذا التحديث لا تحمل وقتاً وتُستثنى)
      const rows = invoices.filter(i => i.status === "مدفوعة" && i.time && inRange(i.date));
      const byHour = Array.from({ length: 24 }, () => ({ count: 0, revenue: 0 }));
      rows.forEach(i => { const h = parseInt(i.time.split(":")[0]); if (!isNaN(h)) { byHour[h].count++; byHour[h].revenue += i.total; } });
      const withData = byHour.map((v, h) => ({ h, ...v })).filter(x => x.count > 0);
      const top = [...withData].sort((a, b) => b.count - a.count)[0];
      const fmtHour = (h) => `${String(h).padStart(2, "0")}:00 - ${String((h + 1) % 24).padStart(2, "0")}:00`;
      return { title: "ساعات الذروة", summary: [["إجمالي الفواتير المؤرَّخة بالوقت", rows.length], ["ساعة الذروة", top ? fmtHour(top.h) : "—"], ["فواتير ساعة الذروة", top ? top.count : 0]],
        thead: ["الساعة", "عدد الفواتير", "الإيراد"], tbody: withData.length ? withData.sort((a, b) => b.count - a.count).map(x => [fmtHour(x.h), x.count, fmt(x.revenue) + " " + cur]) : [["لا فواتير تحمل بيانات وقت ضمن الفترة (تنطبق فقط على العمليات بعد تفعيل هذه الميزة)", "", ""]] };
    }

    if (type === "rentals") {
      // تقرير تأجير الأجهزة: حسب تاريخ الاستلام ضمن الفترة المختارة
      const rows = (rentals || []).filter(r => inRange(r.startAt.slice(0, 10)));
      const byDevice = {};
      rows.forEach(r => {
        if (!byDevice[r.deviceName]) byDevice[r.deviceName] = { count: 0, days: 0, revenue: 0 };
        byDevice[r.deviceName].count++; byDevice[r.deviceName].days += r.days; byDevice[r.deviceName].revenue += r.total;
      });
      const ranked = Object.entries(byDevice).sort((a, b) => b[1].revenue - a[1].revenue);
      const totalRevenue = rows.reduce((s, r) => s + r.total, 0);
      const totalDays = rows.reduce((s, r) => s + r.days, 0);
      const topDevice = ranked[0];
      return { title: "تقرير تأجير الأجهزة", summary: [["إجمالي الإيراد", fmt(totalRevenue) + " " + cur], ["عدد عمليات التأجير", rows.length], ["إجمالي أيام التأجير", totalDays], ["الأكثر تأجيراً", topDevice ? topDevice[0] : "—"]],
        thead: ["الجهاز", "الزبون", "الأيام", "تاريخ الاستلام", "تاريخ الانتهاء", "الإجمالي", "الحالة"],
        tbody: rows.length ? rows.map(r => [r.deviceName, r.customer, r.days, arDate(r.startAt.slice(0, 10)), arDate(r.endAt.slice(0, 10)), fmt(r.total) + " " + cur, r.status]) : [["لا عمليات تأجير ضمن الفترة المختارة", "", "", "", "", "", ""]],
        thead2: ["الجهاز", "عدد مرات التأجير", "إجمالي الأيام", "الإيراد"], tbody2: ranked.map(([name, v]) => [name, v.count, v.days, fmt(v.revenue) + " " + cur]), title2: "الإجمالي حسب كل جهاز" };
    }

    if (type === "deptProfit") {
      // صافي ربح كل قسم = مبيعات القسم − تكلفة البضاعة المباعة (COGS) − مصاريف التشغيل المرتبطة مباشرة بالقسم
      const catKeys = Object.keys(cats);
      const stats = {};
      catKeys.forEach(k => { stats[k] = { revenue: 0, cogs: 0, expenses: 0 }; });
      let legacyRev = 0; // فواتير قديمة بلا items[] تفصيلية — لا يمكن ربطها بدقة بقسم فتُستثنى من الحساب وتُذكر للشفافية
      invoices.filter(i => i.status === "مدفوعة" && inRange(i.date)).forEach(i => {
        if (i.items && i.items.length) {
          i.items.forEach(it => {
            if (!stats[it.cat]) return;
            stats[it.cat].revenue += it.lineTotal;
            const prod = products.find(p => p.id === it.pid);
            if (prod) stats[it.cat].cogs += (prod.buy || 0) * it.qty;
          });
        } else if (i.source === "منتج") legacyRev += i.total;
      });
      let unlinkedExp = 0;
      expenses.filter(e => inRange(e.date)).forEach(e => {
        if (e.dept && stats[e.dept]) stats[e.dept].expenses += e.amount;
        else unlinkedExp += e.amount;
      });
      const rows = catKeys.map(k => {
        const s = stats[k];
        return { key: k, label: cats[k], ...s, net: s.revenue - s.cogs - s.expenses };
      }).filter(r => r.revenue > 0 || r.expenses > 0);
      const totalNet = rows.reduce((s, r) => s + r.net, 0);
      const best = [...rows].sort((a, b) => b.net - a.net)[0];
      return { title: "صافي ربح الأقسام", summary: [["إجمالي صافي ربح الأقسام", fmt(totalNet) + " " + cur], ["الأكثر ربحية", best ? best.label : "—"], ["مصاريف عامة غير مرتبطة بقسم", fmt(unlinkedExp) + " " + cur]],
        thead: ["القسم", "المبيعات", "تكلفة البضاعة", "مصاريف تشغيل مباشرة", "صافي الربح"],
        tbody: rows.length ? rows.sort((a, b) => b.net - a.net).map(r => [r.label, fmt(r.revenue) + " " + cur, fmt(r.cogs) + " " + cur, fmt(r.expenses) + " " + cur, fmt(r.net) + " " + cur]) : [["لا بيانات كافية ضمن الفترة المختارة — تأكد من ربط تفاصيل الفواتير بالأقسام", "", "", "", ""]],
        note: legacyRev > 0 ? `تنبيه: ${fmt(legacyRev)} ${cur} من فواتير قديمة (قبل تفعيل تفاصيل الأصناف) لم يمكن ربطها بدقة بقسم مُعيّن، فاستُثنيت من هذا التقرير للحفاظ على دقته.` : undefined };
    }

    if (type === "catSales") {
      const catKey = cat || Object.keys(cats)[0] || "";
      const catLabel = cats[catKey] || catKey;
      const dayMap = {}; const prodRev = {}; let totalRev = 0;
      invoices.filter(i => i.status === "مدفوعة" && inRange(i.date)).forEach(i => {
        let lineRev = 0;
        if (i.items) {
          i.items.filter(it => it.cat === catKey).forEach(it => { lineRev += it.lineTotal; prodRev[it.name] = (prodRev[it.name] || 0) + it.lineTotal; });
        } else if (i.source !== "حجز") {
          // فواتير أقدم بلا بيانات مفصّلة — أفضل تخمين بمطابقة اسم المنتج ضمن نص الفاتورة
          const names = products.filter(p => p.cat === catKey).map(p => p.name);
          if (names.some(n => i.details && i.details.includes(n))) lineRev = i.total;
        }
        if (lineRev > 0) { dayMap[i.date] = (dayMap[i.date] || 0) + lineRev; totalRev += lineRev; }
      });
      const days = Object.keys(dayMap).sort();
      const avgDaily = days.length ? totalRev / days.length : 0;
      const topProducts = Object.entries(prodRev).sort((a, b) => b[1] - a[1]).slice(0, 6);
      return { title: `تتبع مبيعات قسم — ${catLabel}`,
        summary: [["إجمالي مبيعات القسم", fmt(totalRev) + " " + cur], ["أيام نشطة", days.length], ["متوسط يومي", fmt(Math.round(avgDaily)) + " " + cur], ["الأكثر مبيعاً", topProducts.length ? topProducts[0][0] : "—"]],
        thead: ["التاريخ", "إيراد القسم"], tbody: days.length ? days.map(d => [arDate(d), fmt(dayMap[d]) + " " + cur]) : [["لا حركة مبيعات لهذا القسم ضمن الفترة المختارة", ""]],
        thead2: ["المنتج", "الإيراد"], tbody2: topProducts.map(([n, v]) => [n, fmt(v) + " " + cur]), title2: "الأكثر مبيعاً بالقسم" };
    }

    if (type === "bookingRev") {
      const dayMap = {}; const tableMap = {}; let totalRev = 0, cnt = 0;
      invoices.filter(i => i.status === "مدفوعة" && i.source === "حجز" && inRange(i.date)).forEach(i => {
        const t = i.resType || Object.keys(TYPE_NAME).find(k => i.details && i.details.includes(TYPE_NAME[k]));
        if (resType && t !== resType) return;
        const tName = i.resName || (i.details ? i.details.split(" — ")[1] : "—");
        dayMap[i.date] = (dayMap[i.date] || 0) + i.total;
        tableMap[tName] = (tableMap[tName] || 0) + i.total;
        totalRev += i.total; cnt++;
      });
      const days = Object.keys(dayMap).sort();
      const tables = Object.entries(tableMap).sort((a, b) => b[1] - a[1]);
      return { title: `تتبع إيراد الحجوزات${resType ? " — " + TYPE_NAME[resType] : ""}`,
        summary: [["إجمالي الإيراد", fmt(totalRev) + " " + cur], ["عدد الحجوزات", cnt], ["متوسط الحجز", cnt ? fmt(Math.round(totalRev / cnt)) + " " + cur : "—"], ["الأكثر نشاطاً", tables.length ? tables[0][0] : "—"]],
        thead: ["التاريخ", "الإيراد"], tbody: days.length ? days.map(d => [arDate(d), fmt(dayMap[d]) + " " + cur]) : [["لا حجوزات ضمن الفترة المختارة", ""]],
        thead2: ["الطاولة / الجهاز", "الإيراد"], tbody2: tables.map(([n, v]) => [n, fmt(v) + " " + cur]), title2: "الإيراد حسب الطاولة/الجهاز" };
    }

    // products — قائمة المنتجات مع لمحة عن إيراد الأقسام (حالة حالية، بلا فلترة تاريخ)
    const rows = products.filter(p => !cat || p.cat === cat);
    const catRevenue = {};
    invoices.filter(i => i.status === "مدفوعة" && i.items).forEach(i => { i.items.forEach(it => { catRevenue[it.cat] = (catRevenue[it.cat] || 0) + it.lineTotal; }); });
    const topCat = Object.entries(catRevenue).sort((a, b) => b[1] - a[1])[0];
    return { title: "تقرير مبيعات المنتجات", summary: [["عدد المنتجات", rows.length], ["الأكثر إيراداً", topCat ? (cats[topCat[0]] || topCat[0]) : "—"], ["إيراده", topCat ? fmt(topCat[1]) + " " + cur : "—"]],
      thead: ["المنتج", "القسم", "الباركود", "سعر البيع", "المخزون"], tbody: rows.map(p => [p.name, cats[p.cat] || p.cat, p.bc, fmt(p.sell) + " " + cur, p.stock !== null ? p.stock : "خدمة"]) };
  }, [type, cat, source, resType, from, to, invoices, purchases, expenses, products, totals, assets, waste, cats, rentals, ctx.suppliers.length]);

  const rangeless = type === "assets" || type === "products";

  // تصدير التقرير الحالي كملف CSV (يفتح مباشرة في Excel)
  const downloadCSV = () => {
    const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
    let csv = cfg.thead.map(esc).join(",") + "\n";
    cfg.tbody.forEach(r => { csv += r.map(esc).join(",") + "\n"; });
    if (cfg.tbody2 && cfg.tbody2.length) {
      csv += "\n" + esc(cfg.title2 || "") + "\n";
      csv += cfg.thead2.map(esc).join(",") + "\n";
      cfg.tbody2.forEach(r => { csv += r.map(esc).join(",") + "\n"; });
    }
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${cfg.title.replace(/\s+/g, "-")}-${todayISO()}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const doPrint = () => {
    const w = window.open("", "_blank", "width=900,height=650");
    w.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>تقرير نادي النخيل</title>
    <style>@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap');*{box-sizing:border-box;margin:0;padding:0;font-family:'Tajawal',sans-serif}body{padding:2cm;direction:rtl;font-size:13px;color:#1a1a18}
    .hd{display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #c9a84c;padding-bottom:.75rem;margin-bottom:1rem}.nm{font-size:15px;font-weight:700;color:#1a5c2e}.sub{font-size:10px;color:#7a7870}.info{text-align:left;font-size:10px;color:#7a7870}
    h3{font-size:15px;font-weight:700;color:#1a5c2e;text-align:center}h4{font-size:13px;font-weight:700;color:#1a5c2e;margin:1.2rem 0 .4rem}p.range{text-align:center;font-size:11px;color:#7a7870;margin:2px 0 1rem}
    .sum{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-bottom:1rem}.sc{background:#f5f2ea;border-radius:7px;padding:.6rem;text-align:center}.sv{font-size:16px;font-weight:700;color:#1a5c2e}.sl{font-size:10px;color:#7a7870;margin-top:2px}
    table{width:100%;border-collapse:collapse;margin-top:.5rem}th{background:#1a5c2e;color:#f0d080;padding:.45rem .6rem;text-align:right;font-size:11px}td{padding:.45rem .6rem;border-bottom:0.5px solid #e8e4d8;font-size:12px}tr:nth-child(even) td{background:#faf8f2}
    .ft{text-align:center;font-size:10px;color:#7a7870;margin-top:1.5rem;padding-top:.75rem;border-top:0.5px solid #c9a84c}</style></head><body>
    <div class="hd"><div><div class="nm">🌴 نادي النخيل</div><div class="sub">النادي الرياضي الترفيهي</div></div><div class="info">مصراتة، ليبيا<br>تاريخ الطباعة: ${new Date().toLocaleDateString("ar-LY")}</div></div>
    <h3>${cfg.title}${cat && (type === "products") ? " — قسم " + (cats[cat] || cat) : ""}</h3>${rangeless ? "" : `<p class="range">الفترة: ${arDate(from)} — ${arDate(to)}</p>`}
    <div class="sum">${cfg.summary.map(s => `<div class="sc"><div class="sv">${s[1]}</div><div class="sl">${s[0]}</div></div>`).join("")}</div>
    ${cfg.note ? `<p style="background:#FFF7EB;border:0.5px dashed #c9a84c;border-radius:8px;padding:8px 12px;font-size:11px;color:#8a6a20;margin:10px 0">📌 ${cfg.note}</p>` : ""}
    <table><thead><tr>${cfg.thead.map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>${cfg.tbody.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>
    ${cfg.tbody2 ? `<h4>${cfg.title2 || ""}</h4><table><thead><tr>${cfg.thead2.map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>${cfg.tbody2.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>` : ""}
    <div class="ft">نادي النخيل — ${cfg.title} — جميع الأرقام بالدينار الليبي</div>
    <script>window.onload=function(){window.print();}<\/script></body></html>`);
    w.document.close();
  };

  return (
    <>
      <PageTop title="التقارير والإحصاء" />
      <div style={{ background: C.cd, border: `0.5px solid ${C.bc}`, borderRadius: 12, padding: ".9rem 1rem", marginBottom: "1rem", display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap" }}>
        <Field label="نوع التقرير">
          <Sel value={type} onChange={e => setType(e.target.value)} style={{ minWidth: 175 }}>
            <option value="sales">تقرير المبيعات</option>
            <option value="catSales">تتبع مبيعات قسم</option>
            <option value="bookingRev">تتبع إيراد الحجوزات</option>
            <option value="purchases">تقرير المشتريات</option>
            <option value="profit">الأرباح والخسائر</option>
            <option value="products">مبيعات المنتجات</option>
            <option value="expenses">تقرير المصاريف</option>
            <option value="waste">الإتلاف والهالك</option>
            <option value="leaderboard">تصنيف الموظفين</option>
            <option value="utilization">معدل إشغال الموارد</option>
            <option value="peakHours">ساعات الذروة</option>
            <option value="rentals">تأجير الأجهزة</option>
            <option value="deptProfit">صافي ربح الأقسام</option>
            <option value="assets">موارد النادي</option>
          </Sel>
        </Field>
        {type === "sales" && <Field label="المصدر"><Sel value={source} onChange={e => setSource(e.target.value)} style={{ minWidth: 130 }}><option value="">كل المصادر</option><option value="منتج">مبيعات منتجات</option><option value="حجز">حجوزات</option><option value="تأجير">تأجير أجهزة</option><option value="رصيد سابق">أرصدة سابقة</option></Sel></Field>}
        {(type === "products" || type === "catSales") && <Field label="القسم"><Sel value={cat} onChange={e => setCat(e.target.value)} style={{ minWidth: 140 }}>{type === "products" && <option value="">كل الأقسام</option>}{Object.entries(cats).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Sel></Field>}
        {type === "bookingRev" && <Field label="النوع"><Sel value={resType} onChange={e => setResType(e.target.value)} style={{ minWidth: 140 }}><option value="">كل الأنواع</option>{Object.entries(TYPE_NAME).map(([k, l]) => <option key={k} value={k}>{TYPE_ICON[k]} {l}</option>)}</Sel></Field>}
        {!rangeless && <>
          <Field label="من تاريخ"><Inp type="date" value={from} onChange={e => setFrom(e.target.value)} /></Field>
          <Field label="إلى تاريخ"><Inp type="date" value={to} onChange={e => setTo(e.target.value)} /></Field>
        </>}
        <Btn onClick={downloadCSV} style={{ marginBottom: ".75rem" }}>⬇ تصدير CSV</Btn>
        <Btn gold onClick={doPrint} style={{ marginBottom: ".75rem" }}>🖨 طباعة PDF</Btn>
      </div>
      <div ref={printRef} style={{ background: C.cd, border: `0.5px solid ${C.bc}`, borderRadius: 12, padding: "1.1rem 1.2rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem", paddingBottom: ".75rem", borderBottom: `1px solid ${C.bc}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Crest size={32} /><div><div style={{ fontSize: 14, fontWeight: 700, color: C.grn2 }}>نادي النخيل</div><div style={{ fontSize: 10, color: C.mt }}>النادي الرياضي الترفيهي</div></div></div>
          <div style={{ textAlign: "left", fontSize: 11, color: C.mt }}>مصراتة، ليبيا<br />{new Date().toLocaleDateString("ar-LY")}</div>
        </div>
        <div style={{ textAlign: "center", marginBottom: "1rem" }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: C.grn2 }}>{cfg.title}{cat && type === "products" ? " — قسم " + (cats[cat] || cat) : ""}</h3>
          {!rangeless && <p style={{ fontSize: 11, color: C.mt, marginTop: 2 }}>الفترة: {arDate(from)} — {arDate(to)}</p>}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10, marginBottom: "1rem" }}>
          {cfg.summary.map((s, i) => <div key={i} style={{ background: C.crm, borderRadius: 8, padding: ".65rem", textAlign: "center" }}><div style={{ fontSize: 16, fontWeight: 700, color: C.grn2 }}>{s[1]}</div><div style={{ fontSize: 10, color: C.mt, marginTop: 2 }}>{s[0]}</div></div>)}
        </div>
        {cfg.note && <div style={{ background: "#FFF7EB", border: `0.5px dashed ${C.gold}`, borderRadius: 9, padding: "8px 12px", fontSize: 11, color: "#8a6a20", marginBottom: 12 }}>📌 {cfg.note}</div>}
        <Table cols={cfg.thead.map(h => ({ h, w: (100 / cfg.thead.length) + "%" }))} rows={cfg.tbody} />
        {cfg.tbody2 && cfg.tbody2.length > 0 && (
          <>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.grn2, margin: "1.2rem 0 .5rem" }}>{cfg.title2}</div>
            <Table cols={cfg.thead2.map(h => ({ h, w: (100 / cfg.thead2.length) + "%" }))} rows={cfg.tbody2} />
          </>
        )}
        <div style={{ marginTop: ".85rem", paddingTop: ".6rem", borderTop: `0.5px solid ${C.bc}`, fontSize: 10.5, color: C.mt, textAlign: "center" }}>نادي النخيل — تقرير آلي — جميع الأرقام بالدينار الليبي</div>
      </div>
    </>
  );
}

/* ============================ EMPLOYEE ACTIVITY LOG (سجل حركات الموظفين) ============================ */
function EmployeeActivity({ ctx }) {
  const { invoices, purchases, expenses, waste, payments, closings, assets, users, employees, leaves, setLeaves, deductions, setDeductions, auditLog, cancellations, user, showToast } = ctx;
  const cur = ctx.settings?.currency || "د.ل";
  const [emp, setEmp] = useState("");
  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split("T")[0]; });
  const [to, setTo] = useState(todayISO());
  const [typeFilter, setTypeFilter] = useState("");
  const [leaveModal, setLeaveModal] = useState(false);
  const LEAVE_REASONS = ["عطلة سنوية", "إجازة مرضية", "ظرف طارئ", "إجازة بدون راتب", "أخرى"];
  const [leaveForm, setLeaveForm] = useState({ empId: "", date: todayISO(), days: 1, reason: "عطلة سنوية", note: "" });
  const [deductModal, setDeductModal] = useState(false);
  const DEDUCT_REASONS = ["تأخير عن الدوام", "التسبب في مشكلة/ضرر", "مخالفة سياسة النادي", "غياب بدون إذن", "أخرى"];
  const [deductForm, setDeductForm] = useState({ empId: "", date: todayISO(), amount: "", reason: "تأخير عن الدوام", note: "" });

  const leaveEmp = employees.find(e => e.id == leaveForm.empId);
  const leaveDaily = leaveEmp ? Math.round((leaveEmp.salary / 30) * 100) / 100 : 0;
  const leaveDeduction = Math.round(leaveDaily * (parseInt(leaveForm.days) || 0) * 100) / 100;

  const saveLeave = () => {
    if (!leaveForm.empId) { showToast("اختر الموظف"); return; }
    const days = Math.max(1, parseInt(leaveForm.days) || 1);
    const emp2 = employees.find(e => e.id == leaveForm.empId);
    setLeaves(ls => [{ id: "LV-" + Date.now(), empId: emp2.id, empName: emp2.name, date: leaveForm.date, days, reason: leaveForm.reason, note: leaveForm.note.trim(), dailyRate: leaveDaily, deduction: Math.round(leaveDaily * days * 100) / 100, by: user?.name || "—" }, ...ls]);
    showToast(`سُجّلت عطلة ${days} يوم لـ${emp2.name} — خصم ${fmt(Math.round(leaveDaily * days * 100) / 100)} ${cur} من راتبه`);
    setLeaveModal(false); setLeaveForm({ empId: "", date: todayISO(), days: 1, reason: "عطلة سنوية", note: "" });
  };

  const deductEmp = employees.find(e => e.id == deductForm.empId);
  const saveDeduction = () => {
    if (!deductForm.empId) { showToast("اختر الموظف"); return; }
    const amount = parseFloat(deductForm.amount);
    if (!amount || amount <= 0) { showToast("أدخل مبلغاً صحيحاً"); return; }
    const emp2 = employees.find(e => e.id == deductForm.empId);
    setDeductions(ds => [{ id: "DD-" + Date.now(), empId: emp2.id, empName: emp2.name, date: deductForm.date, amount: Math.round(amount * 100) / 100, reason: deductForm.reason, note: deductForm.note.trim(), by: user?.name || "—" }, ...ds]);
    showToast(`سُجّل خصم ${fmt(amount)} ${cur} على ${emp2.name} — ${deductForm.reason}`);
    setDeductModal(false); setDeductForm({ empId: "", date: todayISO(), amount: "", reason: "تأخير عن الدوام", note: "" });
  };

  const TYPE_META = {
    "بيع منتج": { icon: "🛍", tone: "g" },
    "حجز طاولة": { icon: "📅", tone: "b" },
    "توريد مشتريات": { icon: "🛒", tone: "p" },
    "مصروف": { icon: "💵", tone: "a" },
    "سلفة موظف": { icon: "🪪", tone: "a" },
    "عطلة موظف": { icon: "🏖", tone: "a" },
    "خصم/جزاء": { icon: "⚠️", tone: "r" },
    "تأجير جهاز": { icon: "🔌", tone: "p" },
    "رصيد سابق": { icon: "📜", tone: "a" },
    "إتلاف منتج": { icon: "🗑", tone: "r" },
    "قبض من زبون": { icon: "💰", tone: "g" },
    "صرف لمورد": { icon: "💸", tone: "r" },
    "إغلاق يومي": { icon: "🔒", tone: "b" },
    "مورد النادي": { icon: "🏛", tone: "p" },
    "تعديل سعر": { icon: "💲", tone: "a" },
    "تعديل إعدادات": { icon: "⚙", tone: "b" },
    "إلغاء حجز": { icon: "✕", tone: "r" },
  };

  const activities = useMemo(() => {
    const list = [];
    (invoices || []).forEach(i => {
      if (!i.by) return;
      list.push({ date: i.date, by: i.by, type: i.source === "حجز" ? "حجز طاولة" : i.source === "تأجير" ? "تأجير جهاز" : i.source === "رصيد سابق" ? "رصيد سابق" : "بيع منتج", detail: `#${i.id} — ${i.details}`, amount: i.total });
    });
    (purchases || []).forEach(p => {
      if (!p.by) return;
      list.push({ date: p.date, by: p.by, type: "توريد مشتريات", detail: `#${p.id} — من ${p.supplier}`, amount: p.total });
    });
    (expenses || []).forEach(e => {
      list.push({ date: e.date, by: e.by, type: e.cat === "سلفة موظف" ? "سلفة موظف" : "مصروف", detail: e.desc + (e.empName ? ` — ${e.empName}` : ""), amount: e.amount });
    });
    (waste || []).forEach(w => {
      list.push({ date: w.date, by: w.by, type: "إتلاف منتج", detail: `${w.name} ×${w.qty} — ${w.reason}`, amount: w.cost });
    });
    (payments || []).forEach(p => {
      list.push({ date: p.date, by: p.by, type: p.kind === "قبض" ? "قبض من زبون" : "صرف لمورد", detail: `${p.party} — ${p.via}`, amount: p.amount });
    });
    (closings || []).forEach(c => {
      list.push({ date: c.date, by: c.closedBy, type: "إغلاق يومي", detail: c.status === "match" ? "مطابقة تامة ✓" : c.status === "shortage" ? `عجز ${fmt(Math.abs(c.diff))} ${cur}` : `زيادة ${fmt(c.diff)} ${cur}`, amount: c.actual?.total || null });
    });
    (assets || []).forEach(a => (a.history || []).forEach(h => {
      if (!h.by) return;
      list.push({ date: h.date, by: h.by, type: "مورد النادي", detail: `${h.event} — ${a.name}${h.note && h.note !== "—" ? " (" + h.note + ")" : ""}`, amount: h.cost || null });
    }));
    (leaves || []).forEach(l => {
      list.push({ date: l.date, by: l.by, type: "عطلة موظف", detail: `${l.empName} — ${l.days} يوم (${l.reason})${l.note ? " — " + l.note : ""}`, amount: l.deduction });
    });
    (deductions || []).forEach(d => {
      list.push({ date: d.date, by: d.by, type: "خصم/جزاء", detail: `${d.empName} — ${d.reason}${d.note ? " — " + d.note : ""}`, amount: d.amount });
    });
    (auditLog || []).forEach(a => {
      list.push({ date: a.date, by: a.by, type: a.type, detail: a.detail, amount: null });
    });
    (cancellations || []).forEach(c => {
      list.push({ date: c.date, by: c.by, type: "إلغاء حجز", detail: `${c.customer} — ${TYPE_NAME[c.resType] || c.resType} — ${c.reason}${c.note ? " (" + c.note + ")" : ""}`, amount: null });
    });
    return list.filter(x => x.by).sort((a, b) => b.date.localeCompare(a.date));
  }, [invoices, purchases, expenses, waste, payments, closings, assets, leaves, deductions, auditLog, cancellations]);

  const inRange = (d) => d >= from && d <= to;
  const shown = activities.filter(a => inRange(a.date) && (!emp || a.by === emp) && (!typeFilter || a.type === typeFilter));

  const byEmpCount = {};
  activities.filter(a => inRange(a.date)).forEach(a => { byEmpCount[a.by] = (byEmpCount[a.by] || 0) + 1; });
  const activeDays = new Set(shown.map(a => a.date)).size;
  const totalAmount = shown.reduce((s, a) => s + (a.amount || 0), 0);
  const activityTypes = [...new Set(activities.map(a => a.type))];

  return (
    <>
      <PageTop title="سجل حركات الموظفين" action={
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
          <Btn danger onClick={() => { setDeductForm({ empId: "", date: todayISO(), amount: "", reason: "تأخير عن الدوام", note: "" }); setDeductModal(true); }}>⚠️ خصم من موظف</Btn>
          <Btn gold onClick={() => { setLeaveForm({ empId: "", date: todayISO(), days: 1, reason: "عطلة سنوية", note: "" }); setLeaveModal(true); }}>🏖 + إضافة عطلة</Btn>
        </div>
      } />

      <div style={{ background: C.cd, border: `0.5px solid ${C.bc}`, borderRadius: 12, padding: ".9rem 1rem", marginBottom: "1rem", display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap" }}>
        <Field label="الموظف">
          <Sel value={emp} onChange={e => setEmp(e.target.value)} style={{ minWidth: 150 }}>
            <option value="">كل الموظفين</option>
            {users.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
          </Sel>
        </Field>
        <Field label="نوع الحركة">
          <Sel value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ minWidth: 150 }}>
            <option value="">كل الحركات</option>
            {activityTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </Sel>
        </Field>
        <Field label="من تاريخ"><Inp type="date" value={from} onChange={e => setFrom(e.target.value)} /></Field>
        <Field label="إلى تاريخ"><Inp type="date" value={to} onChange={e => setTo(e.target.value)} /></Field>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 11, marginBottom: "1.1rem" }}>
        <KCard label="عدد الحركات" value={shown.length} sub={emp || "كل الموظفين"} bar={C.gold} />
        <KCard label="أيام النشاط" value={activeDays} sub="ضمن الفترة" bar="#2a78d6" />
        <KCard label="القيمة الإجمالية" value={fmt(totalAmount)} sub={cur} bar="#1a8c3e" />
      </div>

      {/* لمحة سريعة: عدد الحركات لكل موظف */}
      {!emp && Object.keys(byEmpCount).length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          {Object.entries(byEmpCount).sort((a, b) => b[1] - a[1]).map(([n, c]) => (
            <span key={n} onClick={() => setEmp(n)} style={{ cursor: "pointer", fontSize: 11.5, fontWeight: 600, padding: ".35rem .85rem", borderRadius: 20, background: C.crm, color: C.k2, border: `0.5px solid ${C.bc}` }}>👤 {n} ({c})</span>
          ))}
        </div>
      )}

      <Card>
        <CardHead title="سجل الحركات" sub={`${shown.length} حركة — من الأحدث`} />
        {shown.length === 0 ? (
          <div style={{ textAlign: "center", color: C.mt, fontSize: 12.5, padding: "2rem" }}>لا حركات مطابقة ضمن الفلاتر المختارة.</div>
        ) : (
          <Table cols={[{ h: "التاريخ", w: "12%" }, { h: "الموظف", w: "16%" }, { h: "نوع الحركة", w: "17%" }, { h: "التفاصيل", w: "38%" }, { h: "القيمة", w: "17%" }]}
            rows={shown.map((a, i) => {
              const meta = TYPE_META[a.type] || { icon: "•", tone: "g" };
              return [arDate(a.date), <span style={{ display: "flex", alignItems: "center", gap: 5 }}>👤 {a.by}</span>, <Badge tone={meta.tone}>{meta.icon} {a.type}</Badge>, a.detail, a.amount != null ? fmt(a.amount) + " " + cur : "—"];
            })} />
        )}
      </Card>

      {/* نافذة إضافة عطلة */}
      {leaveModal && (
        <Modal title="إضافة عطلة لموظف" onClose={() => setLeaveModal(false)} width={460}>
          <Field label="الموظف *">
            <Sel value={leaveForm.empId} onChange={e => setLeaveForm({ ...leaveForm, empId: e.target.value })}>
              <option value="">اختر الموظف...</option>
              {employees.filter(e => e.status === "نشط").map(e => <option key={e.id} value={e.id}>{e.name} — راتب {fmt(e.salary)} {cur}</option>)}
            </Sel>
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="عدد أيام العطلة"><Inp type="number" min="1" value={leaveForm.days} onChange={e => setLeaveForm({ ...leaveForm, days: e.target.value })} /></Field>
            <Field label="تاريخ العطلة"><Inp type="date" value={leaveForm.date} onChange={e => setLeaveForm({ ...leaveForm, date: e.target.value })} /></Field>
          </div>
          <Field label="السبب"><Sel value={leaveForm.reason} onChange={e => setLeaveForm({ ...leaveForm, reason: e.target.value })}>{LEAVE_REASONS.map(r => <option key={r}>{r}</option>)}</Sel></Field>
          <Field label="ملاحظة (اختياري)"><Inp value={leaveForm.note} onChange={e => setLeaveForm({ ...leaveForm, note: e.target.value })} placeholder="أي تفاصيل إضافية" /></Field>
          {leaveEmp && (
            <div style={{ background: "rgba(201,168,76,.1)", border: "0.5px solid rgba(201,168,76,.3)", borderRadius: 9, padding: ".6rem .85rem", margin: ".4rem 0 1rem", fontSize: 12.5, lineHeight: 1.9 }}>
              الأجر اليومي: <b>{fmt(leaveDaily)} {cur}</b> (الراتب ÷ 30)<br />
              خصم هذه العطلة: <b style={{ color: C.red }}>{fmt(leaveDeduction)} {cur}</b> من راتب {leaveEmp.name}
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}><Btn gold onClick={saveLeave} style={{ flex: 1, justifyContent: "center" }}>✓ تسجيل العطلة والخصم</Btn><Btn onClick={() => setLeaveModal(false)}>إلغاء</Btn></div>
        </Modal>
      )}

      {/* نافذة خصم/جزاء */}
      {deductModal && (
        <Modal title="خصم من راتب موظف" onClose={() => setDeductModal(false)} width={460}>
          <Field label="الموظف *">
            <Sel value={deductForm.empId} onChange={e => setDeductForm({ ...deductForm, empId: e.target.value })}>
              <option value="">اختر الموظف...</option>
              {employees.filter(e => e.status === "نشط").map(e => <option key={e.id} value={e.id}>{e.name} — راتب {fmt(e.salary)} {cur}</option>)}
            </Sel>
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label={"مبلغ الخصم (" + cur + ") *"}><Inp type="number" min="0" value={deductForm.amount} onChange={e => setDeductForm({ ...deductForm, amount: e.target.value })} placeholder="0" /></Field>
            <Field label="التاريخ"><Inp type="date" value={deductForm.date} onChange={e => setDeductForm({ ...deductForm, date: e.target.value })} /></Field>
          </div>
          <Field label="السبب"><Sel value={deductForm.reason} onChange={e => setDeductForm({ ...deductForm, reason: e.target.value })}>{DEDUCT_REASONS.map(r => <option key={r}>{r}</option>)}</Sel></Field>
          <Field label="ملاحظة (اختياري)"><Inp value={deductForm.note} onChange={e => setDeductForm({ ...deductForm, note: e.target.value })} placeholder="أي تفاصيل إضافية" /></Field>
          {deductEmp && deductForm.amount > 0 && (
            <div style={{ background: "#fdeaea", border: "0.5px solid rgba(192,57,43,.3)", borderRadius: 9, padding: ".6rem .85rem", margin: ".4rem 0 1rem", fontSize: 12.5, lineHeight: 1.9 }}>
              سيُخصم <b style={{ color: C.red }}>{fmt(parseFloat(deductForm.amount) || 0)} {cur}</b> من راتب <b>{deductEmp.name}</b> فوراً.
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}><Btn danger onClick={saveDeduction} style={{ flex: 1, justifyContent: "center" }}>✓ تسجيل الخصم</Btn><Btn onClick={() => setDeductModal(false)}>إلغاء</Btn></div>
        </Modal>
      )}
    </>
  );
}

/* ============================ USERS ============================ */
function Users({ ctx }) {
  const { users, setUsers, employees, setEmployees, showToast } = ctx;
  const [sel, setSel] = useState(users.find(u => u.role === "بائع")?.id || users[0]?.id || null);
  const [modal, setModal] = useState(false);
  const [f, setF] = useState({ name: "", username: "", password: "", role: "بائع", shift: "صباحي", salary: "", salaryStart: todayISO() });
  const [newPwd, setNewPwd] = useState("");
  const current = users.find(u => u.id === sel) || users[0];
  if (!current) return <><PageTop title="المستخدمون والصلاحيات" /><Card><div style={{ textAlign: "center", padding: "2rem", color: C.mt }}>لا مستخدمون بعد.</div></Card></>;
  const togglePerm = (k) => setUsers(us => us.map(u => u.id === sel ? { ...u, perms: { ...u.perms, [k]: !u.perms[k] } } : u));
  const toggleActive = () => setUsers(us => us.map(u => u.id === sel ? { ...u, active: !u.active } : u));
  // page visibility: page مرئية إلا إذا كانت pages[id] === false
  const pageVisible = (id) => !(current.pages && current.pages[id] === false);
  const togglePage = (id) => setUsers(us => us.map(u => {
    if (u.id !== sel) return u;
    const pages = { ...(u.pages || {}) };
    pages[id] = pages[id] === false ? true : false; // بدّل بين مرئي/مخفي
    return { ...u, pages };
  }));
  const setAllPages = (visible) => setUsers(us => us.map(u => {
    if (u.id !== sel) return u;
    const pages = {};
    PAGE_LIST.forEach(p => { if (!visible) pages[p.id] = false; }); // إخفاء الكل = وضع false للجميع
    return { ...u, pages };
  }));
  const addUser = () => {
    if (!f.name.trim() || !f.username.trim()) { showToast("أدخل الاسم واسم المستخدم"); return; }
    if (!f.password || f.password.length < 4) { showToast("أدخل رمز دخول من 4 خانات على الأقل"); return; }
    const perms = { invoices: true, discounts: false, cancel: false, reports: false, customers: true, prices: false, purchases: false, inventory: false, salaries: false };
    const newId = Math.max(0, ...users.map(x => x.id)) + 1;
    let linkedEmployeeId = null;
    // ربط تلقائي بسجل موظف — يُنشأ فور إضافة راتب لحساب غير إداري، لتفادي إدخال مزدوج أو خطأ تطابق بالاسم
    if (f.role !== "مدير" && f.salary && parseFloat(f.salary) > 0) {
      const empId = Math.max(0, ...employees.map(x => x.id)) + 1;
      setEmployees(es => [...es, { id: empId, name: f.name.trim(), role: f.role, hired: f.salaryStart, salaryStart: f.salaryStart, salary: parseFloat(f.salary), status: "نشط" }]);
      linkedEmployeeId = empId;
    }
    setUsers(us => [...us, { id: newId, name: f.name.trim(), username: f.username, password: f.password, role: f.role, shift: f.shift, active: true, perms, pages: {}, linkedEmployeeId }]);
    showToast(linkedEmployeeId ? "تمت إضافة المستخدم وربطه تلقائياً بسجل موظف براتبه" : "تمت إضافة المستخدم");
    setModal(false); setF({ name: "", username: "", password: "", role: "بائع", shift: "صباحي", salary: "", salaryStart: todayISO() });
  };
  const visibleCount = PAGE_LIST.filter(p => pageVisible(p.id)).length;

  return (
    <>
      <PageTop title="المستخدمون والصلاحيات" action={<Btn gold onClick={() => setModal(true)}>+ إضافة مستخدم</Btn>} />
      <div style={{ display: "grid", gridTemplateColumns: ctx.scr?.isTab ? "1fr" : "1fr 1.8fr", gap: 11 }}>
        <Card>
          <CardHead title="المستخدمون" />
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {users.map(u => (
              <div key={u.id} onClick={() => setSel(u.id)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: ".55rem .75rem", border: `0.5px solid ${sel === u.id ? "rgba(201,168,76,.5)" : C.bc}`, borderRadius: 9, cursor: "pointer", background: sel === u.id ? "rgba(201,168,76,.08)" : C.crm }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}><div style={{ width: 29, height: 29, borderRadius: "50%", background: u.role === "مدير" ? C.gold : C.grl, color: "#fff", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{u.name.slice(0, 2)}</div><div><div style={{ fontSize: 12.5, fontWeight: 600 }}>{u.name}{u.linkedEmployeeId && <span title="مرتبط بسجل موظف براتب" style={{ marginRight: 4 }}>🔗</span>}</div><div style={{ fontSize: 10, color: C.mt }}>{u.role}{u.shift !== "—" ? " — " + u.shift : ""}{!u.active && " · موقوف"}</div></div></div>
                <Badge tone={u.role === "مدير" ? "gold" : "g"}>{u.role}</Badge>
              </div>
            ))}
          </div>
        </Card>
        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          {/* الصلاحيات التفصيلية */}
          <Card>
            <CardHead title={`صلاحيات — ${current.name}`} sub={current.role === "مدير" ? "المدير يملك كل الصلاحيات تلقائياً" : "فعّل أو عطّل كل صلاحية"} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 7 }}>
              {Object.keys(PERM_LABELS).map(k => (
                <div key={k} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: C.crm, borderRadius: 7, padding: ".42rem .6rem", fontSize: 12, opacity: current.role === "مدير" ? .6 : 1 }}>
                  <span>{PERM_LABELS[k]}</span>
                  <div onClick={() => current.role !== "مدير" && togglePerm(k)} style={{ width: 32, height: 17, borderRadius: 8, position: "relative", cursor: current.role === "مدير" ? "default" : "pointer", background: (current.perms[k] || current.role === "مدير") ? C.grl : "#ccc", transition: ".2s" }}>
                    <div style={{ position: "absolute", width: 13, height: 13, borderRadius: "50%", background: "#fff", top: 2, right: (current.perms[k] || current.role === "مدير") ? 2 : 17, transition: ".2s" }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* رمز الدخول */}
          <Card>
            <CardHead title="🔑 رمز الدخول" sub={current.password ? "رمز محدد لهذا الحساب ✓" : "⚠ لا يوجد رمز — يُنصح بتعيينه فوراً"} />
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              <Inp type="password" autoComplete="new-password" placeholder="رمز جديد (4 خانات فأكثر)" value={newPwd} onChange={e => setNewPwd(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
              <Btn gold sm onClick={() => {
                if (!newPwd || newPwd.length < 4) { showToast("الرمز يجب أن يكون 4 خانات على الأقل"); return; }
                setUsers(us => us.map(u => u.id === sel ? { ...u, password: newPwd } : u));
                setNewPwd(""); showToast(`تم تحديث رمز دخول ${current.name}`);
              }}>حفظ الرمز</Btn>
            </div>
          </Card>

          {/* التحكم في القوائم الظاهرة */}
          <Card>
            <CardHead
              title="القوائم الظاهرة لهذا المستخدم"
              sub={current.role === "مدير" ? "المدير يرى كل القوائم دائماً" : `${visibleCount} من ${PAGE_LIST.length} قائمة ظاهرة`}
              right={current.role !== "مدير" && (
                <div style={{ display: "flex", gap: 6 }}>
                  <Btn sm onClick={() => setAllPages(true)}>إظهار الكل</Btn>
                  <Btn sm danger onClick={() => setAllPages(false)}>إخفاء الكل</Btn>
                </div>
              )}
            />
            {current.role === "مدير" ? (
              <div style={{ textAlign: "center", padding: "1.2rem", color: C.mt, fontSize: 12.5 }}>👑 حساب المدير يصل إلى جميع أقسام النظام دون قيود.</div>
            ) : (
              <>
                <div style={{ fontSize: 11, color: C.mt, marginBottom: 8 }}>اضغط على أي قائمة لإظهارها أو إخفائها من واجهة هذا المستخدم:</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(155px,1fr))", gap: 7 }}>
                  {PAGE_LIST.map(p => {
                    const vis = pageVisible(p.id);
                    return (
                      <div key={p.id} onClick={() => togglePage(p.id)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: vis ? "#e9f6ee" : "#f4f2ec", border: `1px solid ${vis ? "rgba(26,140,62,.3)" : C.bc}`, borderRadius: 8, padding: ".45rem .65rem", fontSize: 12, cursor: "pointer", opacity: vis ? 1 : .65 }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span>{p.icon}</span>{p.label}</span>
                        <span style={{ fontSize: 13 }}>{vis ? "👁" : "🚫"}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
            {current.role !== "مدير" && (
              <div style={{ display: "flex", gap: 7, marginTop: ".85rem" }}>
                <Btn gold sm onClick={() => showToast("تم حفظ إعدادات المستخدم")}>حفظ</Btn>
                <Btn sm danger onClick={toggleActive}>{current.active ? "إيقاف الحساب" : "تفعيل الحساب"}</Btn>
              </div>
            )}
          </Card>
        </div>
      </div>
      {modal && <Modal title="إضافة مستخدم جديد" onClose={() => setModal(false)} width={460}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="الاسم الكامل" full><Inp value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="اسم المستخدم"><Inp value={f.username} onChange={e => setF({ ...f, username: e.target.value })} placeholder="user1" /></Field>
          <Field label="الدور"><Sel value={f.role} onChange={e => setF({ ...f, role: e.target.value })}><option value="بائع">بائع</option><option value="مدير">مدير</option></Sel></Field>
          <Field label="الوردية"><Sel value={f.shift} onChange={e => setF({ ...f, shift: e.target.value })}><option>صباحي</option><option>مسائي</option><option value="—">—</option></Sel></Field>
          <Field label="رمز الدخول * (4 خانات فأكثر)" full><Inp type="password" autoComplete="new-password" value={f.password} onChange={e => setF({ ...f, password: e.target.value })} placeholder="••••••" /></Field>
        </div>
        {f.role !== "مدير" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label={"الراتب الشهري (" + (ctx.settings?.currency || "د.ل") + ") — اختياري"}><Inp type="number" min="0" value={f.salary} onChange={e => setF({ ...f, salary: e.target.value })} placeholder="0" /></Field>
              <Field label="تاريخ بداية العمل"><Inp type="date" value={f.salaryStart} onChange={e => setF({ ...f, salaryStart: e.target.value })} /></Field>
            </div>
            <div style={{ fontSize: 10.5, color: C.gdd, background: C.gold + "12", borderRadius: 8, padding: ".55rem .75rem", marginBottom: 10, lineHeight: 1.7 }}>💡 إن أدخلت راتباً، سيُنشأ تلقائياً سجل موظف مرتبط بنفس هذا الحساب في صفحة «المرتبات» — لا حاجة لإدخاله مرتين.</div>
          </>
        )}
        <div style={{ fontSize: 11, color: C.mt, marginBottom: 10 }}>سيُمنح المستخدم صلاحيات افتراضية وكل القوائم ظاهرة — عدّلها بعد الإضافة. يسجّل الدخول برمزه الخاص.</div>
        <div style={{ display: "flex", gap: 8 }}><Btn gold onClick={addUser} style={{ flex: 1, justifyContent: "center" }}>✓ إضافة</Btn><Btn onClick={() => setModal(false)}>إلغاء</Btn></div>
      </Modal>}
    </>
  );
}

/* ============================ INVENTORY & SHORTAGE ============================ */
function Inventory({ ctx }) {
  const { products, setProducts, suppliers, waste, setWaste, user, showToast } = ctx;
  const cur = ctx.settings?.currency || "د.ل";
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all"); // all | low | out | ok
  const [modal, setModal] = useState(false);
  const [supplier, setSupplier] = useState("");
  const [orderLines, setOrderLines] = useState([]); // {prodId, qty}
  const [adjust, setAdjust] = useState(null); // product being adjusted
  const [wasteItem, setWasteItem] = useState(null); // product being marked as damaged/wasted
  const [wasteForm, setWasteForm] = useState({ qty: 1, reason: "سكب / انسكاب", note: "", date: todayISO() });
  const WASTE_REASONS = ["سكب / انسكاب", "تسريب عبوة", "كسر", "انتهاء الصلاحية", "تلف بالتخزين", "أخرى"];
  const wasteTotal30 = waste.filter(w => daysBetween(w.date, todayISO()) <= 30).reduce((s, w) => s + w.cost, 0);
  const applyWaste = () => {
    if (!wasteItem) return;
    const qty = Math.min(wasteItem.stock, Math.max(1, parseInt(wasteForm.qty) || 1));
    const cost = Math.round((wasteItem.buy || 0) * qty * 100) / 100;
    setProducts(ps => ps.map(p => p.id === wasteItem.id ? { ...p, stock: Math.max(0, p.stock - qty) } : p));
    setWaste(w => [{ id: "WS-" + Date.now(), date: wasteForm.date, pid: wasteItem.id, name: wasteItem.name, cat: wasteItem.cat, qty, reason: wasteForm.reason, note: wasteForm.note.trim(), cost, by: user?.name || "—" }, ...w]);
    showToast(`تم تسجيل إتلاف ${qty} ${wasteItem.unit} من «${wasteItem.name}» — خسارة ${fmt(cost)} ${cur}`);
    setWasteItem(null); setWasteForm({ qty: 1, reason: "سكب / انسكاب", note: "", date: todayISO() });
  };

  // only stocked products (services have stock=null)
  const stocked = products.filter(p => p.stock !== null);
  const lowItems = stocked.filter(p => p.min && p.stock < p.min);
  const outItems = stocked.filter(p => p.stock === 0);
  const stockValue = stocked.reduce((s, p) => s + (p.buy || 0) * p.stock, 0);

  const statusOf = (p) => {
    if (p.stock === 0) return { label: "نفد", tone: "r", pct: 0 };
    if (p.min && p.stock < p.min) return { label: "منخفض", tone: "a", pct: Math.min(100, Math.round(p.stock / (p.min * 2) * 100)) };
    return { label: "متوفر", tone: "g", pct: Math.min(100, p.min ? Math.round(p.stock / (p.min * 2) * 100) : 100) };
  };

  const shown = stocked.filter(p => {
    if (!(p.name.includes(q) || matchesBarcodePartial(p, q))) return false;
    const st = statusOf(p);
    if (filter === "low") return st.tone === "a";
    if (filter === "out") return st.tone === "r";
    if (filter === "ok") return st.tone === "g";
    return true;
  });

  // stock adjustment (manual receive/correct)
  const applyAdjust = (delta) => {
    setProducts(ps => ps.map(p => p.id === adjust.id ? { ...p, stock: Math.max(0, p.stock + delta) } : p));
    setAdjust(a => ({ ...a, stock: Math.max(0, a.stock + delta) }));
  };

  /* ---- shortage order builder ---- */
  const openShortageForm = () => {
    // auto-fill with low/out items, suggested qty = (min*2 - stock)
    const suggestions = lowItems.map(p => ({ prodId: p.id, qty: Math.max(1, (p.min * 2) - p.stock) }));
    setOrderLines(suggestions.length ? suggestions : []);
    // preselect supplier of first low item if available
    const firstSup = lowItems.find(p => p.supplier)?.supplier || "";
    setSupplier(firstSup);
    setModal(true);
  };
  const addOrderLine = () => setOrderLines(l => [...l, { prodId: "", qty: 1 }]);
  const setOrderLine = (i, k, v) => setOrderLines(l => l.map((ln, idx) => idx === i ? { ...ln, [k]: v } : ln));
  const delOrderLine = (i) => setOrderLines(l => l.filter((_, idx) => idx !== i));

  const supplierObj = suppliers.find(s => s.name === supplier);

  const sendWhatsApp = () => {
    const valid = orderLines.filter(l => l.prodId && l.qty > 0);
    if (!valid.length) { showToast("أضف صنفاً واحداً على الأقل للطلب"); return; }
    if (!supplier) { showToast("اختر المورد المستلم للطلب"); return; }
    // توليد فاتورة النواقص PDF — يفتحها المستخدم ويشاركها بنفسه عبر واتساب
    const docNo = "SHORT-" + Date.now().toString().slice(-6);
    openPdfDoc(ctx.settings, {
      title: "فاتورة نواقص — طلب توريد",
      recipientLabel: "المورد", recipientName: supplier, recipientPhone: supplierObj?.phone,
      docNo,
      columns: ["#", "الصنف", "الباركود", "الكمية المطلوبة", "الوحدة", "المتوفر حالياً"],
      rows: valid.map((l, i) => {
        const p = products.find(x => x.id == l.prodId);
        return [i + 1, p?.name || "—", p?.bc || "—", l.qty, p?.unit || "قطعة", (p?.stock ?? "—") + " قطعة"];
      }),
      totals: [["إجمالي الأصناف المطلوبة", valid.length + " صنف"]],
      note: "يرجى تأكيد التوفر والأسعار وموعد التسليم. هذا الطلب مُولّد آلياً حسب نواقص المخزون.",
    });
    showToast("فُتحت فاتورة النواقص — احفظها كـ PDF ثم شاركها عبر واتساب المورد");
    setModal(false);
  };

  return (
    <>
      <PageTop title="المخزون والنواقص" action={
        <Btn gold onClick={openShortageForm}><span style={{ fontSize: 14 }}>🟢</span> إنشاء فاتورة نواقص</Btn>
      } />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 11, marginBottom: "1.1rem" }}>
        <KCard label="أصناف بالمخزون" value={stocked.length} sub="صنف قابل للجرد" bar={C.grl} />
        <KCard label="منخفض المخزون" value={lowItems.length} sub="تحت الحد الأدنى" bar={C.gold} />
        <KCard label="نفد كلياً" value={outItems.length} sub="بحاجة طلب عاجل" bar={C.red} />
        <KCard label="قيمة المخزون" value={fmt(stockValue)} sub="دينار ليبي" bar="#2a78d6" />
        <KCard label="خسائر الإتلاف" value={fmt(wasteTotal30)} sub="آخر 30 يوم" bar={C.red} />
      </div>

      {(lowItems.length > 0) && (
        <div style={{ background: "linear-gradient(135deg,#fff7eb,#fff)", border: `1px solid ${C.gold}`, borderRadius: 12, padding: ".8rem 1rem", marginBottom: "1rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div style={{ fontSize: 12.5, color: C.gdd }}>⚠️ يوجد <b>{lowItems.length}</b> صنف تحت الحد الأدنى{outItems.length ? `، منها ${outItems.length} نفد كلياً` : ""}. يمكنك إنشاء فاتورة نواقص وإرسالها للمورد عبر واتساب مباشرة.</div>
          <Btn gold sm onClick={openShortageForm}>مراجعة النواقص →</Btn>
        </div>
      )}

      <Card>
        <CardHead
          title="جرد المخزون"
          sub="ابحث بالاسم أو الباركود للتأكد من الكمية المتوفرة"
          right={
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, background: C.crm, border: `0.5px solid ${C.bc}`, borderRadius: 8, padding: ".3rem .7rem", width: 220 }}>
                <span style={{ color: C.mt, fontSize: 14 }}>🔍</span>
                <input value={q} onChange={e => setQ(e.target.value)} placeholder="ابحث عن صنف أو باركود..." style={{ border: "none", outline: "none", background: "transparent", fontSize: 12.5, width: "100%", fontFamily: "inherit" }} />
              </div>
              <Sel value={filter} onChange={e => setFilter(e.target.value)} style={{ width: 130 }}>
                <option value="all">كل الأصناف</option>
                <option value="ok">متوفر</option>
                <option value="low">منخفض</option>
                <option value="out">نفد</option>
              </Sel>
            </div>
          }
        />
        {shown.length === 0 ? (
          <div style={{ textAlign: "center", color: C.mt, fontSize: 12.5, padding: "1.5rem 0" }}>لا توجد أصناف مطابقة للبحث.</div>
        ) : (
          <Table
            cols={[{ h: "الباركود", w: "13%" }, { h: "الصنف", w: "20%" }, { h: "القسم", w: "10%" }, { h: "المتوفر", w: "10%" }, { h: "الحد الأدنى", w: "10%" }, { h: "مستوى المخزون", w: "19%" }, { h: "الحالة", w: "10%" }, { h: "إجراء", w: "8%" }]}
            rows={shown.map(p => {
              const st = statusOf(p);
              return [
                <span style={{ fontFamily: "monospace", fontSize: 11, background: C.crm, padding: "2px 6px", borderRadius: 5 }}>{p.bc}</span>,
                <span style={{ fontWeight: 600 }}>{p.name}</span>,
                <Badge tone={p.cat === "games" ? "g" : "a"}>{CATS[p.cat]}</Badge>,
                <span style={{ fontWeight: 700, color: st.tone === "r" ? C.red : st.tone === "a" ? C.gdd : C.grn2 }}>{p.stock} {p.unit}</span>,
                p.min || "—",
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ flex: 1, height: 6, borderRadius: 3, background: "#eee", overflow: "hidden" }}><div style={{ width: st.pct + "%", height: "100%", background: st.tone === "r" ? "#e34948" : st.tone === "a" ? C.gold : C.grl }} /></div>
                  <span style={{ fontSize: 10, color: C.mt, minWidth: 28 }}>{st.pct}%</span>
                </div>,
                <Badge tone={st.tone}>{st.label}</Badge>,
                <div style={{ display: "flex", gap: 4 }}><Btn sm onClick={() => setAdjust(p)}>تعديل</Btn><Btn sm danger onClick={() => { setWasteItem(p); setWasteForm({ qty: 1, reason: "سكب / انسكاب", note: "", date: todayISO() }); }}>🗑 إتلاف</Btn></div>,
              ];
            })}
          />
        )}
      </Card>

      {/* stock adjust modal */}
      {adjust && (
        <Modal title={`تعديل مخزون — ${adjust.name}`} onClose={() => setAdjust(null)} width={400}>
          <div style={{ textAlign: "center", padding: ".5rem 0 1rem" }}>
            <div style={{ fontSize: 11, color: C.mt, marginBottom: 4 }}>الكمية المتوفرة حالياً</div>
            <div style={{ fontSize: 34, fontWeight: 700, color: C.grn2 }}>{adjust.stock}</div>
            <div style={{ fontSize: 11, color: C.mt }}>{adjust.unit}</div>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: "1rem" }}>
            <Btn onClick={() => applyAdjust(-1)}>− 1</Btn>
            <Btn onClick={() => applyAdjust(-10)}>− 10</Btn>
            <Btn onClick={() => applyAdjust(10)}>+ 10</Btn>
            <Btn onClick={() => applyAdjust(1)}>+ 1</Btn>
          </div>
          <Btn gold onClick={() => { showToast("تم تحديث المخزون"); setAdjust(null); }} style={{ width: "100%", justifyContent: "center" }}>✓ حفظ التعديل</Btn>
        </Modal>
      )}

      {/* damage / waste modal */}
      {wasteItem && (
        <Modal title={`تسجيل إتلاف — ${wasteItem.name}`} onClose={() => setWasteItem(null)} width={440}>
          <div style={{ fontSize: 12, color: C.mt, marginBottom: 12, background: C.crm, borderRadius: 8, padding: ".55rem .8rem" }}>المتوفر حالياً: <b>{wasteItem.stock} {wasteItem.unit}</b> — سعر الشراء: <b>{fmt(wasteItem.buy || 0)} {cur}</b> / {wasteItem.unit}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label={"الكمية التالفة (" + wasteItem.unit + ")"}><Inp type="number" min="1" max={wasteItem.stock} value={wasteForm.qty} onChange={e => setWasteForm({ ...wasteForm, qty: e.target.value })} /></Field>
            <Field label="التاريخ"><Inp type="date" value={wasteForm.date} onChange={e => setWasteForm({ ...wasteForm, date: e.target.value })} /></Field>
            <Field label="السبب" full><Sel value={wasteForm.reason} onChange={e => setWasteForm({ ...wasteForm, reason: e.target.value })}>{WASTE_REASONS.map(r => <option key={r}>{r}</option>)}</Sel></Field>
            <Field label="ملاحظة (اختياري)" full><Inp value={wasteForm.note} onChange={e => setWasteForm({ ...wasteForm, note: e.target.value })} placeholder="مثال: سقط كوب أثناء التقديم" /></Field>
          </div>
          <div style={{ background: "#fdeaea", border: "0.5px solid rgba(192,57,43,.25)", borderRadius: 9, padding: ".6rem .85rem", margin: ".4rem 0 1rem", fontSize: 12.5, display: "flex", justifyContent: "space-between" }}>
            <span>الخسارة المقدّرة</span><b style={{ color: C.red }}>{fmt(Math.round((wasteItem.buy || 0) * (Math.max(1, parseInt(wasteForm.qty) || 1)) * 100) / 100)} {cur}</b>
          </div>
          <div style={{ display: "flex", gap: 8 }}><Btn danger onClick={applyWaste} style={{ flex: 1, justifyContent: "center" }}>🗑 تأكيد الإتلاف وخصمه من المخزون</Btn><Btn onClick={() => setWasteItem(null)}>إلغاء</Btn></div>
        </Modal>
      )}

      {/* سجل الإتلاف الأخير */}
      {waste.length > 0 && (
        <Card style={{ marginTop: "1rem" }}>
          <CardHead title="🗑 سجل الإتلاف الأخير" sub={`إجمالي الخسائر: ${fmt(waste.reduce((s, w) => s + w.cost, 0))} ${cur}`} />
          <Table cols={[{ h: "التاريخ", w: "13%" }, { h: "الصنف", w: "22%" }, { h: "الكمية", w: "10%" }, { h: "السبب", w: "18%" }, { h: "الخسارة", w: "13%" }, { h: "بواسطة", w: "12%" }, { h: "ملاحظة", w: "12%" }]}
            rows={waste.slice(0, 8).map(w => [arDate(w.date), w.name, w.qty, w.reason, fmt(w.cost) + " " + cur, w.by, w.note || "—"])} />
        </Card>
      )}

      {/* shortage order modal */}
      {modal && (
        <Modal title="فاتورة نواقص — طلب من المورد" onClose={() => setModal(false)} width={580}>
          <Field label="المورد (للإرسال عبر واتساب)">
            <Sel value={supplier} onChange={e => setSupplier(e.target.value)}>
              <option value="">اختر المورد...</option>
              {suppliers.map(s => <option key={s.id} value={s.name}>{s.name}{s.wa ? "" : " (لا يوجد واتساب)"}</option>)}
            </Sel>
          </Field>
          {supplierObj && supplierObj.wa && (
            <div style={{ fontSize: 11.5, color: "#1a8c3e", marginBottom: 10, display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ fontSize: 14 }}>🟢</span> سيُرسَل الطلب إلى واتساب: {supplierObj.phone}
            </div>
          )}

          <div style={{ fontSize: 11, fontWeight: 700, color: C.mt, margin: ".3rem 0 .5rem" }}>الأصناف المطلوبة (تم اقتراح النواقص تلقائياً)</div>
          {orderLines.length === 0 && <div style={{ fontSize: 12, color: C.mt, padding: ".5rem 0" }}>لا توجد نواقص حالياً — أضف أصنافاً يدوياً إن رغبت.</div>}
          {orderLines.map((ln, i) => {
            const p = products.find(x => x.id == ln.prodId);
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6, background: C.crm, borderRadius: 8, padding: ".45rem .7rem" }}>
                <Sel value={ln.prodId} onChange={e => setOrderLine(i, "prodId", e.target.value)} style={{ flex: 2.5, background: C.cd }}>
                  <option value="">اختر الصنف...</option>
                  {stocked.map(pr => <option key={pr.id} value={pr.id}>{pr.name} (متوفر: {pr.stock})</option>)}
                </Sel>
                <Inp type="number" value={ln.qty} onChange={e => setOrderLine(i, "qty", parseInt(e.target.value) || 1)} style={{ width: 70, background: C.cd }} />
                <span style={{ fontSize: 11, color: C.mt, minWidth: 34 }}>{p?.unit || ""}</span>
                <button onClick={() => delOrderLine(i)} style={{ background: "none", border: "none", cursor: "pointer", color: C.mt, fontSize: 15 }}>✕</button>
              </div>
            );
          })}
          <Btn sm onClick={addOrderLine} style={{ marginTop: 5 }}>+ إضافة صنف</Btn>

          {/* PDF flow explanation */}
          {orderLines.filter(l => l.prodId).length > 0 && (
            <div style={{ marginTop: "1rem", background: C.bluebg, border: `0.5px solid ${C.blue}33`, borderRadius: 10, padding: ".7rem .85rem", fontSize: 11.5, color: C.blue, lineHeight: 1.8 }}>
              📄 عند الضغط على الزر تُفتح فاتورة النواقص مباشرة كمستند رسمي: اضغط <b>«💾 حفظ كـ PDF»</b> داخل المستند، ثم شارك الملف المحفوظ عبر واتساب المورد 📎 من جهازك.
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: "1rem" }}>
            <button onClick={sendWhatsApp} style={{ flex: 1, justifyContent: "center", display: "inline-flex", alignItems: "center", gap: 7, padding: ".55rem", borderRadius: 10, background: "#25D366", color: "#fff", border: "none", fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              <span style={{ fontSize: 16 }}>📄</span> فتح فاتورة النواقص PDF
            </button>
            <Btn onClick={() => setModal(false)}>إغلاق</Btn>
          </div>
        </Modal>
      )}
    </>
  );
}

/* ============================ SETTINGS ============================ */
function Settings({ ctx }) {
  const { settings, setSettings, showToast } = ctx;
  const [tab, setTab] = useState("appearance");
  const set = (k, v) => setSettings(s => ({ ...s, [k]: v }));
  const fileRef = useRef(null);

  const onLogo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 800000) { showToast("حجم الصورة كبير — اختر صورة أصغر من 800KB"); return; }
    const reader = new FileReader();
    reader.onload = () => { set("logo", reader.result); showToast("تم تحديث الشعار"); };
    reader.readAsDataURL(file);
  };

  const TABS = [
    { id: "appearance", label: "المظهر والثيمات", icon: "🎨" },
    { id: "pos", label: "نقطة البيع", icon: "🛍" },
    { id: "printers", label: "الطابعات", icon: "🖨" },
    { id: "invoice", label: "شكل الفاتورة", icon: "🧾" },
    { id: "content", label: "الكلمات والمعلومات", icon: "✍" },
    { id: "security", label: "الأمان", icon: "🔐" },
    { id: "loyalty", label: "الولاء والنقاط", icon: "🎁" },
    { id: "database", label: "قاعدة البيانات", icon: "🗄" },
  ];

  return (
    <>
      <PageTop title="الإعدادات" action={<Btn gold onClick={() => { ctx.setAuditLog(al => [{ id: "AU-" + Date.now(), date: todayISO(), by: ctx.user?.name || "—", type: "تعديل إعدادات", detail: "تحديث إعدادات النظام" }, ...al]); showToast("تم حفظ جميع الإعدادات"); }}>✓ حفظ الكل</Btn>} />

      {/* tab bar */}
      <div style={{ display: "flex", gap: 4, background: C.gold + "18", borderRadius: 12, padding: 4, marginBottom: "1.1rem", flexWrap: "wrap" }}>
        {TABS.map(t => (
          <div key={t.id} onClick={() => setTab(t.id)} style={{ padding: ".45rem 1rem", borderRadius: 9, fontSize: 12.5, cursor: "pointer", fontWeight: tab === t.id ? 700 : 500, background: tab === t.id ? C.grn : "transparent", color: tab === t.id ? C.gld : C.mt, transition: "all .2s", display: "flex", alignItems: "center", gap: 6 }}>
            <span>{t.icon}</span>{t.label}
          </div>
        ))}
      </div>

      {/* ===== APPEARANCE ===== */}
      {tab === "appearance" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Card className="nk-card-hover">
            <CardHead title="شعار النادي" sub="ارفع شعارك الخاص أو استخدم الشعار الافتراضي" />
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ width: 90, height: 90, borderRadius: 16, background: C.crm, border: `1px dashed ${C.gold}`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                {settings.logo ? <img src={settings.logo} alt="logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Crest size={64} />}
              </div>
              <div style={{ flex: 1 }}>
                <input ref={fileRef} type="file" accept="image/*" onChange={onLogo} style={{ display: "none" }} />
                <Btn gold onClick={() => fileRef.current?.click()} style={{ width: "100%", justifyContent: "center", marginBottom: 7 }}>📤 رفع صورة الشعار</Btn>
                {settings.logo && <Btn onClick={() => { set("logo", null); showToast("تم استرجاع الشعار الافتراضي"); }} style={{ width: "100%", justifyContent: "center" }}>استرجاع الافتراضي</Btn>}
                <div style={{ fontSize: 10.5, color: C.mt, marginTop: 6 }}>PNG أو JPG — أقل من 800KB — يُفضّل مربّع</div>
              </div>
            </div>
          </Card>

          <Card className="nk-card-hover">
            <CardHead title="الوضع الليلي" sub="راحة للعين في الإضاءة المنخفضة" />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: C.crm, borderRadius: 12, padding: "1rem 1.2rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 26 }}>{settings.dark ? "🌙" : "☀️"}</span>
                <div><div style={{ fontSize: 13, fontWeight: 600 }}>{settings.dark ? "الوضع الليلي مُفعّل" : "الوضع النهاري"}</div><div style={{ fontSize: 11, color: C.mt }}>اضغط للتبديل</div></div>
              </div>
              <div onClick={() => set("dark", !settings.dark)} style={{ width: 52, height: 28, borderRadius: 14, background: settings.dark ? C.grl : "#ccc", position: "relative", cursor: "pointer", transition: "background .3s" }}>
                <div style={{ position: "absolute", width: 22, height: 22, borderRadius: "50%", background: "#fff", top: 3, right: settings.dark ? 3 : 27, transition: "right .3s", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>{settings.dark ? "🌙" : "☀️"}</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, padding: "0 .3rem" }}>
              <div style={{ fontSize: 12.5, fontWeight: 600 }}>المؤثرات الحركية</div>
              <div onClick={() => set("animations", !settings.animations)} style={{ width: 34, height: 18, borderRadius: 9, background: settings.animations ? C.grl : "#ccc", position: "relative", cursor: "pointer" }}>
                <div style={{ position: "absolute", width: 14, height: 14, borderRadius: "50%", background: "#fff", top: 2, right: settings.animations ? 2 : 18, transition: "right .2s" }} />
              </div>
            </div>
          </Card>

          <Card className="nk-card-hover" style={{ gridColumn: "1/-1" }}>
            <CardHead title="ثيم الألوان" sub="اختر لوحة الألوان التي تناسب هوية ناديك — التغيير فوري وسلس" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(110px,1fr))", gap: 10 }}>
              {Object.entries(THEMES).map(([key, th], i) => (
                <div key={key} onClick={() => { set("theme", key); showToast(`تم تفعيل ثيم ${th.name}`); }} className="nk-theme-card"
                  style={{ border: `2px solid ${settings.theme === key ? th.accent : C.bc}`, borderRadius: 14, padding: ".8rem", cursor: "pointer", background: settings.theme === key ? th.accent + "12" : C.crm, transform: settings.theme === key ? "translateY(-2px)" : "none", boxShadow: settings.theme === key ? `0 6px 16px ${th.accent}33` : "none", animationDelay: `${i * 35}ms` }}>
                  <div style={{ display: "flex", gap: 5, marginBottom: 8 }}>
                    <div style={{ flex: 1, height: 34, borderRadius: 8, background: `linear-gradient(135deg,${th.brand},${th.brand2})` }} />
                    <div style={{ width: 20, height: 34, borderRadius: 8, background: th.accent }} />
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, textAlign: "center", color: settings.theme === key ? th.accentD : C.k2 }}>{th.name}</div>
                  {settings.theme === key && <div style={{ textAlign: "center", fontSize: 10, color: th.accent, marginTop: 3, fontWeight: 600, animation: settings.animations ? "nkPop .3s ease" : "none" }}>● مُفعّل</div>}
                </div>
              ))}
            </div>
          </Card>

          <Card className="nk-card-hover" style={{ gridColumn: "1/-1" }}>
            <CardHead title="🎨 لون خلفية مخصّص" sub="تجاوز لون خلفية الثيم المختار بلونك الخاص (اختياري)" />
            <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              <label style={{ position: "relative", cursor: "pointer" }}>
                <input type="color" value={settings.customBg || C.pg} onChange={e => set("customBg", e.target.value)} style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: 54, height: 54 }} />
                <div style={{ width: 54, height: 54, borderRadius: 14, background: settings.customBg || C.pg, border: `2px solid ${C.bc}`, boxShadow: "0 2px 8px rgba(0,0,0,.1)" }} />
              </label>
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 2 }}>{settings.customBg ? "لون مخصّص مُفعّل" : "لون خلفية الثيم الافتراضي"}</div>
                <div style={{ fontSize: 10.5, color: C.mt }}>اضغط المربّع لاختيار أي لون — يطبَّق فوراً على كل الصفحات</div>
              </div>
              {settings.customBg && <Btn sm onClick={() => { set("customBg", null); showToast("أُعيدت خلفية الثيم الافتراضية"); }}>↺ إعادة تعيين</Btn>}
            </div>
          </Card>
        </div>
      )}

      {/* ===== POS MODES ===== */}
      {tab === "pos" && (
        <Card className="nk-card-hover">
          <CardHead title="وضعية عرض نقطة البيع السريع" sub="اختر طريقة عرض المنتجات التي تناسب سرعة عملك" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
            {[
              { id: "grid", name: "شبكة البطاقات", desc: "بطاقات كبيرة بأيقونات — الأسرع للمس", preview: "grid" },
              { id: "list", name: "قائمة مفصّلة", desc: "صفوف بمعلومات أكثر لكل منتج", preview: "list" },
              { id: "compact", name: "مضغوط", desc: "أزرار صغيرة — أكبر عدد بالشاشة", preview: "compact" },
            ].map(m => (
              <div key={m.id} onClick={() => { set("posMode", m.id); showToast(`وضع ${m.name} مُفعّل`); }}
                style={{ border: `2px solid ${settings.posMode === m.id ? C.gold : C.bc}`, borderRadius: 14, padding: "1rem", cursor: "pointer", background: settings.posMode === m.id ? C.gold + "10" : C.crm, transition: "all .2s" }}>
                <div style={{ height: 70, background: C.cd, borderRadius: 8, padding: 8, marginBottom: 10, display: "flex", flexDirection: m.preview === "list" ? "column" : "row", flexWrap: m.preview === "grid" ? "wrap" : "nowrap", gap: 4, overflow: "hidden" }}>
                  {m.preview === "grid" && [1, 2, 3, 4, 5, 6].map(i => <div key={i} style={{ width: "30%", height: 26, borderRadius: 5, background: C.gold + "33" }} />)}
                  {m.preview === "list" && [1, 2, 3].map(i => <div key={i} style={{ width: "100%", height: 15, borderRadius: 4, background: C.gold + "33" }} />)}
                  {m.preview === "compact" && [1, 2, 3, 4, 5, 6, 7, 8].map(i => <div key={i} style={{ width: "22%", height: 16, borderRadius: 3, background: C.gold + "33" }} />)}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{m.name}</div>
                <div style={{ fontSize: 11, color: C.mt, marginTop: 2 }}>{m.desc}</div>
                {settings.posMode === m.id && <div style={{ fontSize: 10, color: C.grl, marginTop: 5, fontWeight: 700 }}>● الوضع الحالي</div>}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ===== أقسام مجانية للموظفين ===== */}
      {tab === "pos" && (
        <Card className="nk-card-hover" style={{ marginTop: 12 }}>
          <CardHead title="🎁 أقسام مجانية للموظفين" sub="عند تسجيل شراء موظف من نقطة البيع، أصناف هذه الأقسام لا تُخصم من راتبه ولا تُحتسب ضمن مبلغ الفاتورة" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))", gap: 8 }}>
            {Object.entries(ctx.cats).map(([k, label]) => {
              const list = settings.freeDeptsForEmployees || [];
              const active = list.includes(k);
              return (
                <div key={k} onClick={() => set("freeDeptsForEmployees", active ? list.filter(x => x !== k) : [...list, k])}
                  style={{ border: `1.5px solid ${active ? C.gold : C.bc}`, borderRadius: 10, padding: ".6rem .75rem", cursor: "pointer", background: active ? C.gold + "14" : C.crm, display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12.5, fontWeight: active ? 700 : 500 }}>
                  <span>{label}</span>{active && <span style={{ color: C.gdd }}>🎁</span>}
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: 10.5, color: C.mt, marginTop: 10, lineHeight: 1.7 }}>💡 مثال: فعّل «مياه» ليحصل الموظفون على مياه الشرب مجاناً كميزة عمل — تبقى تكلفتها مُحتسبة في التقارير المالية للشفافية، لكن دون خصم من راتب أحد.</div>
        </Card>
      )}
      {/* ===== PRINTERS ===== */}
      {tab === "printers" && (
        <Card className="nk-card-hover">
          <CardHead title="إعدادات الطابعة" sub="اختر نوع الطابعة المستخدمة لطباعة الفواتير" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[
              { id: "xprinter", name: "طابعة الإيصالات (Xprinter)", desc: "طابعة حرارية 80mm — إيصال ضيق سريع", icon: "🧾", width: "80mm", sample: "narrow" },
              { id: "a4", name: "الطابعة الكبيرة (A4)", desc: "طابعة عادية — فاتورة كاملة بحجم A4", icon: "🖨", width: "A4", sample: "wide" },
            ].map(p => (
              <div key={p.id} onClick={() => { set("printer", p.id); showToast(`تم اختيار ${p.name}`); }}
                style={{ border: `2px solid ${settings.printer === p.id ? C.gold : C.bc}`, borderRadius: 14, padding: "1.1rem", cursor: "pointer", background: settings.printer === p.id ? C.gold + "10" : C.crm, transition: "all .2s", textAlign: "center" }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>{p.icon}</div>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
                  <div style={{ width: p.sample === "narrow" ? 44 : 80, height: 60, background: "#fff", borderRadius: 4, border: `1px solid ${C.bc}`, padding: 5, boxShadow: "0 2px 6px rgba(0,0,0,.08)" }}>
                    <div style={{ height: 6, background: C.gold + "55", borderRadius: 2, marginBottom: 3, width: "60%", marginInline: "auto" }} />
                    {[1, 2, 3, 4].map(i => <div key={i} style={{ height: 3, background: "#ddd", borderRadius: 2, marginBottom: 2 }} />)}
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{p.name}</div>
                <div style={{ fontSize: 11, color: C.mt, marginTop: 3 }}>{p.desc}</div>
                <Badge tone="gold" style={{ marginTop: 8 }}>عرض: {p.width}</Badge>
                {settings.printer === p.id && <div style={{ fontSize: 10, color: C.grl, marginTop: 6, fontWeight: 700 }}>● الطابعة الحالية</div>}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, background: C.gold + "12", border: `0.5px solid ${C.gold}55`, borderRadius: 10, padding: ".8rem 1rem", fontSize: 12, color: C.gdd, display: "flex", gap: 8 }}>
            <span style={{ fontSize: 16 }}>💡</span>
            <span>عند إتمام أي بيع، سيتم تنسيق الفاتورة تلقائياً حسب الطابعة المختارة — الإيصال الحراري يظهر مضغوطاً بعرض 80mm، وطابعة A4 تعرض فاتورة رسمية كاملة.</span>
          </div>
        </Card>
      )}

      {/* ===== INVOICE DESIGN ===== */}
      {tab === "invoice" && <InvoiceDesigner ctx={ctx} />}

      {/* ===== CONTENT ===== */}
      {tab === "content" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Card className="nk-card-hover">
            <CardHead title="معلومات النادي" sub="تظهر في الشريط الجانبي والفواتير" />
            <Field label="اسم النادي"><Inp value={settings.clubName} onChange={e => set("clubName", e.target.value)} /></Field>
            <Field label="الوصف / الشعار النصي"><Inp value={settings.clubSub} onChange={e => set("clubSub", e.target.value)} /></Field>
            <Field label="العنوان"><Inp value={settings.address} onChange={e => set("address", e.target.value)} /></Field>
            <Field label="رقم الهاتف"><Inp value={settings.phone} onChange={e => set("phone", e.target.value)} /></Field>
          </Card>
          <Card className="nk-card-hover">
            <CardHead title="الكلمات الترحيبية والفاتورة" sub="خصّص نبرة رسائل النظام" />
            <Field label="عنوان الترحيب (شاشة الدخول)"><Inp value={settings.welcomeTitle} onChange={e => set("welcomeTitle", e.target.value)} /></Field>
            <Field label="رسالة ترحيبية"><Inp value={settings.welcomeMsg} onChange={e => set("welcomeMsg", e.target.value)} /></Field>
            <Field label="تذييل الفاتورة"><textarea value={settings.invoiceFooter} onChange={e => set("invoiceFooter", e.target.value)} style={{ ...inputStyle, height: 52, resize: "none" }} /></Field>
            <div style={{ marginTop: 6, background: C.crm, borderRadius: 10, padding: ".7rem .9rem" }}>
              <div style={{ fontSize: 10.5, color: C.mt, marginBottom: 4 }}>معاينة رسالة الترحيب:</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.grn2 }}>{settings.welcomeTitle}</div>
              <div style={{ fontSize: 11.5, color: C.k2 }}>{settings.welcomeMsg}</div>
            </div>
          </Card>
        </div>
      )}

      {/* ===== SECURITY ===== */}
      {tab === "security" && (
        <Card className="nk-card-hover">
          <CardHead title="🔐 انتهاء الجلسة التلقائي" sub="سجّل خروج المستخدم تلقائياً بعد فترة خمول — مفيد لأجهزة الكاشير المشتركة" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 12 }}>
            {[{ v: 0, l: "معطّل" }, { v: 5, l: "5 دقائق" }, { v: 15, l: "15 دقيقة" }, { v: 30, l: "30 دقيقة" }].map(o => (
              <div key={o.v} onClick={() => set("sessionTimeout", o.v)} style={{ border: `1.5px solid ${(settings.sessionTimeout ?? 0) === o.v ? C.gold : C.bc}`, borderRadius: 10, padding: ".6rem", textAlign: "center", cursor: "pointer", fontSize: 12.5, fontWeight: 600, background: (settings.sessionTimeout ?? 0) === o.v ? C.gold + "14" : C.crm }}>{o.l}</div>
            ))}
          </div>
          <div style={{ fontSize: 11.5, color: C.mt, background: C.crm, borderRadius: 8, padding: ".6rem .8rem", lineHeight: 1.8 }}>💡 عند التفعيل، إن لم يتفاعل المستخدم مع النظام (لمس/نقر/كتابة) خلال المدة المحددة، يُسجَّل خروجه تلقائياً وتظهر شاشة الدخول من جديد — لحماية النظام عند ترك الجهاز دون مراقبة.</div>
        </Card>
      )}

      {/* ===== LOYALTY ===== */}
      {tab === "loyalty" && (
        <Card className="nk-card-hover">
          <CardHead title="🎁 نظام نقاط الولاء" sub="كافئ الزبائن المتكررين بنقاط تُستبدل بخصومات" />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: C.crm, borderRadius: 10, padding: ".7rem .9rem", marginBottom: 14 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>تفعيل نظام النقاط</span>
            <div onClick={() => set("loyaltyOn", !settings.loyaltyOn)} style={{ width: 40, height: 21, borderRadius: 11, position: "relative", cursor: "pointer", background: settings.loyaltyOn ? C.grl : "#ccc", transition: ".2s" }}>
              <div style={{ position: "absolute", width: 17, height: 17, borderRadius: "50%", background: "#fff", top: 2, right: settings.loyaltyOn ? 2 : 21, transition: ".2s" }} />
            </div>
          </div>
          {settings.loyaltyOn && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label={`اكسب نقطة واحدة لكل (${settings.currency || "د.ل"})`}><Inp type="number" value={settings.pointsPerCurrency ?? 10} onChange={e => set("pointsPerCurrency", parseFloat(e.target.value) || 1)} /></Field>
              <Field label="قيمة 100 نقطة عند الاستبدال"><Inp type="number" value={settings.pointsRedeemValue ?? 5} onChange={e => set("pointsRedeemValue", parseFloat(e.target.value) || 0)} /></Field>
            </div>
          )}
          <div style={{ fontSize: 11.5, color: C.mt, background: C.crm, borderRadius: 8, padding: ".6rem .8rem", lineHeight: 1.8, marginTop: 10 }}>
            💡 مثال بالإعدادات الحالية: زبون اشترى بـ{settings.pointsPerCurrency ?? 10} {settings.currency || "د.ل"} يكسب نقطة واحدة. عند وصوله 100 نقطة يمكنه استبدالها بخصم {fmt(settings.pointsRedeemValue ?? 5)} {settings.currency || "د.ل"} من نقطة البيع. النقاط تُمنح فقط عند اختيار زبون مسجَّل (وليس «زبون» عابر) في نقطة البيع.
          </div>
        </Card>
      )}

      {tab === "database" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Card className="nk-card-hover">
            <CardHead title="حالة قاعدة البيانات" sub="أين تُحفظ بياناتك الآن" />
            {DB.mode === "supabase" && (
              <div style={{ background: "#e8f8ee", border: "1px solid rgba(26,140,62,.35)", borderRadius: 12, padding: "1rem", textAlign: "center" }}>
                <div style={{ fontSize: 34 }}>☁️</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#1a5c2e", marginTop: 4 }}>سحابية — Supabase</div>
                <div style={{ fontSize: 11.5, color: C.mt, marginTop: 4, lineHeight: 1.8 }}>بياناتك محفوظة دائمياً في السحابة ومتزامنة بين كل الأجهزة المتصلة بنفس المشروع.</div>
              </div>
            )}
            {DB.mode === "local" && (
              <div style={{ background: C.gold + "12", border: `1px solid ${C.gold}55`, borderRadius: 12, padding: "1rem", textAlign: "center" }}>
                <div style={{ fontSize: 34 }}>💾</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: C.gdd, marginTop: 4 }}>محلية — على هذا الجهاز</div>
                <div style={{ fontSize: 11.5, color: C.mt, marginTop: 4, lineHeight: 1.8 }}>بياناتك محفوظة دائمياً في متصفح هذا الجهاز (تنجو من التحديث والإغلاق). لتفعيل السحابة والمزامنة بين الأجهزة، اتبع الخطوات المجاورة.</div>
              </div>
            )}
            {DB.mode === "memory" && (
              <div style={{ background: C.redbg, border: "1px solid rgba(192,57,43,.35)", borderRadius: 12, padding: "1rem", textAlign: "center" }}>
                <div style={{ fontSize: 34 }}>⚠️</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: C.red, marginTop: 4 }}>مؤقتة — في الذاكرة فقط</div>
                <div style={{ fontSize: 11.5, color: C.mt, marginTop: 4, lineHeight: 1.8 }}>هذه البيئة تمنع التخزين المحلي؛ البيانات ستُفقد عند تحديث الصفحة. شغّل النظام في متصفح عادي أو فعّل Supabase.</div>
              </div>
            )}
            {DB.error && <div style={{ marginTop: 10, fontSize: 11, color: C.red, background: C.redbg, borderRadius: 8, padding: ".5rem .7rem" }}>⚠ {DB.error}</div>}
            <div style={{ marginTop: 12, borderTop: `0.5px solid ${C.bc}`, paddingTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.red, marginBottom: 6 }}>منطقة الخطر</div>
              <Btn danger onClick={() => { if (window.confirm("سيتم مسح كل البيانات نهائياً (بما فيها المستخدمون) والبدء بنظام فارغ. ستظهر شاشة إنشاء حساب المدير من جديد. هل أنت متأكد؟")) DB.reset(); }}>🗑 مسح كل البيانات والبدء من جديد</Btn>
            </div>
          </Card>
          <Card className="nk-card-hover">
            <CardHead title="تفعيل الحفظ السحابي (Supabase)" sub="مجاني — 4 خطوات لمرة واحدة" />
            <div style={{ fontSize: 12.5, lineHeight: 2.1, color: C.k2 }}>
              <b>1.</b> أنشئ حساباً ومشروعاً مجانياً على <b>supabase.com</b><br />
              <b>2.</b> افتح <b>SQL Editor</b> والصق محتوى ملف <code style={{ background: C.crm, padding: "1px 6px", borderRadius: 5 }}>supabase-schema.sql</code> المرفق ثم نفّذه<br />
              <b>3.</b> من <b>Settings → API</b> انسخ <b>Project URL</b> و <b>anon key</b><br />
              <b>4.</b> افتح ملف النظام وضعهما في أعلى الملف:
              <pre style={{ background: "#14431f", color: "#f0d080", borderRadius: 9, padding: ".7rem .9rem", fontSize: 11, direction: "ltr", textAlign: "left", overflowX: "auto", marginTop: 6 }}>{`const SUPABASE_URL = "https://xxxx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOi...";`}</pre>
              أعد تشغيل النظام — ستتحول الحالة إلى ☁️ سحابية تلقائياً، وكل جهاز يفتح النظام يرى نفس البيانات.
            </div>
          </Card>
          <div style={{ gridColumn: "1 / -1" }}><BackupManager ctx={ctx} /></div>
        </div>
      )}
    </>
  );
}

/* ============================ BACKUP MANAGER ============================ */
function BackupManager({ ctx }) {
  const { showToast, settings } = ctx;
  const [, tick] = useState(0);
  const fileRef = useRef(null);
  const lastBackup = DB.lastBackupAt();
  const autoBk = DB.getAutoBackup();

  // كم مضى منذ آخر نسخة؟
  const daysSince = lastBackup ? Math.floor((Date.now() - new Date(lastBackup)) / 86400000) : null;
  const overdue = daysSince === null || daysSince >= (settings.backupFreq || 7);

  const downloadBackup = () => {
    const backup = DB.exportData();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url; a.download = `nakheel-backup-${stamp}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    DB.saveAutoBackup(); tick(x => x + 1);
    showToast("تم تنزيل النسخة الاحتياطية بنجاح");
  };

  const saveInternal = () => {
    const at = DB.saveAutoBackup(); tick(x => x + 1);
    showToast("تم حفظ نسخة احتياطية داخلية");
  };

  const restoreInternal = async () => {
    if (!autoBk) return;
    if (!window.confirm("سيتم استبدال كل البيانات الحالية بالنسخة الداخلية المحفوظة. متابعة؟")) return;
    try { await DB.importData(autoBk); showToast("تمت الاستعادة — سيُعاد التحميل"); setTimeout(() => window.location.reload(), 900); }
    catch (e) { showToast("تعذّرت الاستعادة"); }
  };

  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const backup = JSON.parse(reader.result);
        if (!backup.__nakheel_backup) { showToast("هذا الملف ليس نسخة احتياطية صالحة"); return; }
        const cnt = backupCounts(backup.data || {}).join("، ") || "لا عناصر";
        if (!window.confirm(`استعادة نسخة بتاريخ ${new Date(backup.exportedAt).toLocaleString("ar-LY")}؟\nتحتوي: ${cnt}\n\nسيتم استبدال كل البيانات الحالية.`)) return;
        await DB.importData(backup);
        showToast("تمت الاستعادة بنجاح — سيُعاد التحميل");
        setTimeout(() => window.location.reload(), 900);
      } catch (err) { showToast("تعذّرت قراءة الملف — تأكد أنه نسخة صحيحة"); }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const setFreq = (v) => ctx.setSettings(s => ({ ...s, backupFreq: v }));

  return (
    <Card className="nk-card-hover">
      <CardHead title="🛡 النسخ الاحتياطي الذكي" sub="احمِ بيانات النادي من الفقدان" />

      {/* حالة آخر نسخة */}
      <div style={{ background: overdue ? "#fdeaea" : "#e8f8ee", border: `1px solid ${overdue ? "rgba(192,57,43,.3)" : "rgba(26,140,62,.3)"}`, borderRadius: 12, padding: ".85rem 1rem", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 26 }}>{overdue ? "⚠️" : "✅"}</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: overdue ? "#922" : "#1a5c2e" }}>
              {lastBackup ? `آخر نسخة: ${daysSince === 0 ? "اليوم" : daysSince === 1 ? "أمس" : `منذ ${daysSince} يوم`}` : "لم تُنشأ أي نسخة احتياطية بعد"}
            </div>
            <div style={{ fontSize: 11, color: C.mt }}>{lastBackup ? new Date(lastBackup).toLocaleString("ar-LY") : "يُنصح بإنشاء نسخة الآن"}</div>
          </div>
        </div>
        {overdue && <Btn gold sm onClick={downloadBackup}>أنشئ نسخة الآن</Btn>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 12 }}>
        {/* تنزيل / رفع ملف */}
        <div style={{ border: `0.5px solid ${C.bc}`, borderRadius: 12, padding: "1rem" }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 4 }}>📁 نسخة كملف (موصى بها)</div>
          <div style={{ fontSize: 11, color: C.mt, marginBottom: 10, lineHeight: 1.7 }}>نزّل ملف <code style={{ background: C.crm, padding: "1px 5px", borderRadius: 4 }}>.json</code> واحتفظ به في مكان آمن (سحابة/فلاش). يمكنك استعادته على أي جهاز.</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            <Btn gold onClick={downloadBackup} style={{ justifyContent: "center" }}>⬇ تنزيل نسخة احتياطية</Btn>
            <input ref={fileRef} type="file" accept="application/json,.json" onChange={onFile} style={{ display: "none" }} />
            <Btn onClick={() => fileRef.current?.click()} style={{ justifyContent: "center" }}>⬆ استعادة من ملف</Btn>
          </div>
        </div>

        {/* نسخة داخلية سريعة */}
        <div style={{ border: `0.5px solid ${C.bc}`, borderRadius: 12, padding: "1rem" }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 4 }}>⚡ نسخة داخلية سريعة</div>
          <div style={{ fontSize: 11, color: C.mt, marginBottom: 10, lineHeight: 1.7 }}>لقطة فورية تُحفظ داخل النظام — مفيدة قبل أي تعديل كبير. {autoBk ? `آخر لقطة: ${new Date(autoBk.exportedAt).toLocaleString("ar-LY")}` : "لا توجد لقطة بعد."}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            <Btn onClick={saveInternal} style={{ justifyContent: "center" }}>📸 حفظ لقطة الآن</Btn>
            <Btn onClick={restoreInternal} disabled={!autoBk} style={{ justifyContent: "center", opacity: autoBk ? 1 : .5 }}>↩ استرجاع آخر لقطة</Btn>
          </div>
        </div>

        {/* التذكير المجدول */}
        <div style={{ border: `0.5px solid ${C.bc}`, borderRadius: 12, padding: "1rem" }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 4 }}>⏰ تذكير النسخ التلقائي</div>
          <div style={{ fontSize: 11, color: C.mt, marginBottom: 10, lineHeight: 1.7 }}>كل متى يذكّرك النظام بإنشاء نسخة احتياطية؟</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
            {[{ v: 1, l: "يومياً" }, { v: 7, l: "أسبوعياً" }, { v: 30, l: "شهرياً" }].map(o => (
              <div key={o.v} onClick={() => setFreq(o.v)} style={{ border: `1.5px solid ${(settings.backupFreq || 7) === o.v ? C.gold : C.bc}`, borderRadius: 8, padding: ".5rem .3rem", textAlign: "center", cursor: "pointer", fontSize: 11.5, fontWeight: 600, background: (settings.backupFreq || 7) === o.v ? C.gold + "14" : C.crm }}>{o.l}</div>
            ))}
          </div>
          <div style={{ fontSize: 10.5, color: C.mt, marginTop: 8, lineHeight: 1.6 }}>يظهر تنبيه أعلى الصفحة عند حلول موعد النسخ التالي.</div>
        </div>
      </div>

      <div style={{ marginTop: 12, fontSize: 11, color: C.mt, background: C.crm, borderRadius: 8, padding: ".6rem .8rem", lineHeight: 1.8 }}>
        💡 <b>نصيحة:</b> النسخة كملف هي الأأمن — إن تعطّل الجهاز أو المتصفح تبقى بياناتك سليمة. احتفظ بنسخة أسبوعية على الأقل في مكان منفصل. عند تفعيل Supabase السحابي، بياناتك محفوظة سحابياً أيضاً كطبقة حماية إضافية.
      </div>
    </Card>
  );
}

/* ---- Invoice live designer ---- */
function InvoiceDesigner({ ctx }) {
  const { settings, setSettings, showToast } = ctx;
  const set = (k, v) => setSettings(s => ({ ...s, [k]: v }));
  const isThermal = settings.printer === "xprinter";

  return (
    <div style={{ display: "grid", gridTemplateColumns: ctx.scr?.isTab ? "1fr" : "1fr 340px", gap: 12 }}>
      <Card className="nk-card-hover">
        <CardHead title="تخصيص شكل الفاتورة" sub="غيّر العناصر وشاهد المعاينة تتحدث فوراً على اليسار" />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: C.crm, borderRadius: 10, padding: ".6rem .85rem", marginBottom: 10 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600 }}>إظهار الشعار على الفاتورة</div>
          <div onClick={() => set("invoiceShowLogo", !settings.invoiceShowLogo)} style={{ width: 34, height: 18, borderRadius: 9, background: settings.invoiceShowLogo ? C.grl : "#ccc", position: "relative", cursor: "pointer" }}>
            <div style={{ position: "absolute", width: 14, height: 14, borderRadius: "50%", background: "#fff", top: 2, right: settings.invoiceShowLogo ? 2 : 18, transition: "right .2s" }} />
          </div>
        </div>
        <Field label="اسم العملة"><Inp value={settings.currency} onChange={e => set("currency", e.target.value)} placeholder="د.ل" /></Field>
        <Field label="تذييل الفاتورة"><textarea value={settings.invoiceFooter} onChange={e => set("invoiceFooter", e.target.value)} style={{ ...inputStyle, height: 52, resize: "none" }} /></Field>
        <div style={{ fontSize: 12, color: C.mt, marginTop: 6, marginBottom: 4 }}>نوع الطابعة الحالي:</div>
        <Badge tone="gold">{isThermal ? "إيصال حراري 80mm (Xprinter)" : "فاتورة A4 كاملة"}</Badge>
        <div style={{ fontSize: 11, color: C.mt, marginTop: 6 }}>يمكنك تغيير نوع الطابعة من تبويب «الطابعات».</div>
        <Btn gold onClick={() => showToast("تم حفظ تصميم الفاتورة")} style={{ marginTop: 12, width: "100%", justifyContent: "center" }}>✓ حفظ التصميم</Btn>
      </Card>

      {/* LIVE PREVIEW */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.mt, marginBottom: 8, textAlign: "center" }}>معاينة حيّة للفاتورة</div>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <div style={{ width: isThermal ? 240 : 320, background: "#fff", borderRadius: isThermal ? 6 : 8, boxShadow: "0 8px 30px rgba(0,0,0,.15)", padding: isThermal ? "14px 12px" : "20px 22px", fontFamily: isThermal ? "monospace" : "'Tajawal',sans-serif", color: "#1a1a18", transition: "width .3s" }}>
            {settings.invoiceShowLogo && (
              <div style={{ textAlign: "center", marginBottom: 8 }}>
                {settings.logo ? <img src={settings.logo} alt="" style={{ width: isThermal ? 40 : 54, height: isThermal ? 40 : 54, objectFit: "cover", borderRadius: 8 }} /> : <Crest size={isThermal ? 40 : 54} />}
              </div>
            )}
            <div style={{ textAlign: "center", fontSize: isThermal ? 13 : 16, fontWeight: 700, color: "#1a5c2e" }}>{settings.clubName}</div>
            <div style={{ textAlign: "center", fontSize: isThermal ? 9 : 10, color: "#7a7870", marginBottom: 3 }}>{settings.clubSub}</div>
            <div style={{ textAlign: "center", fontSize: isThermal ? 8.5 : 10, color: "#7a7870" }}>{settings.address} · {settings.phone}</div>
            <div style={{ borderTop: "1px dashed #ccc", margin: "8px 0" }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: isThermal ? 9 : 11, color: "#3d3c38" }}><span>فاتورة #INV-1048</span><span>{new Date().toLocaleDateString("ar-LY")}</span></div>
            <div style={{ borderTop: "1px dashed #ccc", margin: "8px 0" }} />
            {[["وقت PS5 × 2", "100"], ["قهوة تركية × 3", "24"], ["Red Bull × 1", "8"]].map((r, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: isThermal ? 9.5 : 11.5, marginBottom: 4 }}><span>{r[0]}</span><span>{r[1]} {settings.currency}</span></div>
            ))}
            <div style={{ borderTop: "1px dashed #ccc", margin: "8px 0" }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: isThermal ? 12 : 14, fontWeight: 700, color: "#1a5c2e" }}><span>الإجمالي</span><span>132 {settings.currency}</span></div>
            <div style={{ borderTop: "1px dashed #ccc", margin: "8px 0" }} />
            <div style={{ textAlign: "center", fontSize: isThermal ? 8.5 : 10.5, color: "#7a7870", marginTop: 4 }}>{settings.invoiceFooter}</div>
            {isThermal && <div style={{ textAlign: "center", marginTop: 8, letterSpacing: 2, fontSize: 18 }}>▮▏▮▎▏▮▍▏▮</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================ ALERTS (overdue payments) ============================ */
function Alerts({ ctx }) {
  const { invoices, customers, showToast, settings } = ctx;
  const cur = settings?.currency || "د.ل";

  // group overdue deferred invoices by customer
  const overdue = invoices.filter(iv => overdueDays(iv) > 0);
  const byCustomer = {};
  overdue.forEach(iv => {
    if (!byCustomer[iv.customer]) byCustomer[iv.customer] = { name: iv.customer, invoices: [], total: 0, maxLate: 0 };
    byCustomer[iv.customer].invoices.push(iv);
    byCustomer[iv.customer].total += iv.total;
    byCustomer[iv.customer].maxLate = Math.max(byCustomer[iv.customer].maxLate, overdueDays(iv));
  });
  const groups = Object.values(byCustomer).sort((a, b) => b.maxLate - a.maxLate);

  const severity = (days) => {
    if (days > 30) return { label: "متأخر جداً", tone: "r", color: "#c0392b" };
    if (days > 14) return { label: "متأخر", tone: "a", color: "#e07b1a" };
    return { label: "قريب التأخير", tone: "a", color: "#c9a84c" };
  };

  const totalOverdue = overdue.reduce((s, iv) => s + iv.total, 0);

  const sendReminder = (group) => {
    const cust = customers.find(c => c.name === group.name);
    if (!cust || !cust.wa) { showToast("لا يوجد رقم واتساب مسجّل لهذا الزبون"); return; }
    const lines = group.invoices.map((iv, i) => `${i + 1}. #${iv.id} — ${fmt(iv.total)} ${cur} — متأخرة ${overdueDays(iv)} يوم`);
    const msg = [
      `🌴 *${settings?.clubName || "نادي النخيل"}* — تذكير بالسداد`,
      `عزيزنا ${group.name}،`,
      "",
      "نودّ تذكيركم بوجود مستحقات متأخرة:",
      ...lines,
      "",
      `*إجمالي المتأخر: ${fmt(group.total)} ${cur}*`,
      "",
      "نرجو التكرم بالسداد في أقرب وقت. شكراً لتعاملكم معنا 🌴",
    ].join("\n");
    window.open(`https://wa.me/${cust.wa}?text=${encodeURIComponent(msg)}`, "_blank");
    showToast(`تم فتح واتساب لتذكير ${group.name}`);
  };

  const remindAll = () => {
    if (!groups.length) return;
    showToast(`سيتم فتح ${groups.length} محادثة واتساب — أكّد كل رسالة`);
    groups.forEach((g, idx) => setTimeout(() => sendReminder(g), idx * 600));
  };

  return (
    <>
      <PageTop title="تنبيهات السداد" action={groups.length > 0 && <Btn gold onClick={remindAll}>📱 تذكير الجميع</Btn>} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 11, marginBottom: "1.1rem" }}>
        <KCard label="فواتير متأخرة" value={overdue.length} sub="بحاجة متابعة" bar={C.red} />
        <KCard label="زبائن متأخرون" value={groups.length} sub="عليهم مستحقات" bar={C.gold} />
        <KCard label="إجمالي المتأخر" value={fmt(totalOverdue)} sub={cur} bar="#e07b1a" />
      </div>

      {groups.length === 0 ? (
        <Card>
          <div style={{ textAlign: "center", padding: "2.5rem 1rem", color: C.mt }}>
            <div style={{ fontSize: 46, marginBottom: 10 }}>✅</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.grn2 }}>لا توجد مستحقات متأخرة</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>كل الحسابات الآجلة ضمن مواعيد السداد.</div>
          </div>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          {groups.map(g => {
            const sev = severity(g.maxLate);
            return (
              <Card key={g.name} className="nk-card-hover" style={{ borderRight: `4px solid ${sev.color}` }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: sev.color + "22", color: sev.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700 }}>{g.name.slice(0, 1)}</div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{g.name}</div>
                      <div style={{ fontSize: 11, color: C.mt }}>{g.invoices.length} فاتورة متأخرة · أقصى تأخير {g.maxLate} يوم</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ textAlign: "left" }}>
                      <div style={{ fontSize: 18, fontWeight: 700, color: sev.color }}>{fmt(g.total)} {cur}</div>
                      <Badge tone={sev.tone}>{sev.label}</Badge>
                    </div>
                    <button onClick={() => sendReminder(g)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: ".5rem .9rem", borderRadius: 9, background: "#25D366", color: "#fff", border: "none", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>📱 تذكير</button>
                  </div>
                </div>
                <div style={{ background: C.crm, borderRadius: 9, padding: ".5rem .7rem" }}>
                  {g.invoices.map(iv => (
                    <div key={iv.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, padding: ".3rem 0", borderBottom: `0.5px solid ${C.bc}` }}>
                      <span>#{iv.id} — {iv.details}</span>
                      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ color: C.mt, fontSize: 11 }}>استحقاق {arDate(iv.dueDate || iv.date)}</span>
                        <Badge tone={severity(overdueDays(iv)).tone}>متأخرة {overdueDays(iv)} يوم</Badge>
                        <span style={{ fontWeight: 600, color: C.grn2, minWidth: 60, textAlign: "left" }}>{fmt(iv.total)} {cur}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}

/* ============================ PROMOTIONS (التخفيضات والعروض) ============================ */
function Promotions({ ctx }) {
  const { promotions, setPromotions, cats, showToast, settings } = ctx;
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const empty = { name: "", cat: "all", pct: "", from: todayISO(), to: "", period: "allday" };
  const [f, setF] = useState(empty);
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick(x => x + 1), 30000); return () => clearInterval(t); }, []);

  const activeNow = promotions.filter(p => promoActiveNow(p));
  const scheduled = promotions.filter(p => p.active && !promoActiveNow(p) && p.to >= todayISO());
  const catName = (k) => k === "all" ? "كل الأقسام" : (cats[k] || CATS[k] || k);

  const openAdd = () => { setEditId(null); setF(empty); setModal(true); };
  const openEdit = (p) => { setEditId(p.id); setF({ name: p.name, cat: p.cat, pct: String(p.pct), from: p.from, to: p.to, period: p.period }); setModal(true); };

  const save = () => {
    if (!f.name.trim()) { showToast("أدخل اسم العرض"); return; }
    const pct = parseInt(f.pct);
    if (!pct || pct < 1 || pct > 90) { showToast("نسبة الخصم يجب أن تكون بين 1 و 90"); return; }
    if (!f.to) { showToast("حدد تاريخ نهاية العرض"); return; }
    if (f.to < f.from) { showToast("تاريخ النهاية قبل البداية"); return; }
    if (editId) {
      setPromotions(ps => ps.map(p => p.id === editId ? { ...p, name: f.name.trim(), cat: f.cat, pct, from: f.from, to: f.to, period: f.period } : p));
      showToast("تم تحديث العرض");
    } else {
      setPromotions(ps => [...ps, { id: Math.max(0, ...ps.map(x => x.id)) + 1, name: f.name.trim(), cat: f.cat, pct, from: f.from, to: f.to, period: f.period, active: true }]);
      showToast("تم إنشاء العرض وتفعيله");
    }
    setModal(false); setEditId(null); setF(empty);
  };
  const toggle = (id) => setPromotions(ps => ps.map(p => p.id === id ? { ...p, active: !p.active } : p));
  const remove = (id) => { setPromotions(ps => ps.filter(p => p.id !== id)); showToast("تم حذف العرض"); };

  const statusOf = (p) => {
    if (!p.active) return { label: "موقوف", tone: "r" };
    if (promoActiveNow(p)) return { label: "فعّال الآن", tone: "g" };
    if (p.from > todayISO()) return { label: "مجدول", tone: "b" };
    if (p.to < todayISO()) return { label: "منتهي", tone: "r" };
    return { label: "خارج الفترة الزمنية", tone: "a" };
  };

  return (
    <>
      <PageTop title="التخفيضات والعروض" action={<Btn gold onClick={openAdd}>+ عرض جديد</Btn>} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 11, marginBottom: "1.1rem" }}>
        <KCard label="عروض فعّالة الآن" value={activeNow.length} sub="تُطبَّق على نقطة البيع" bar="#1a8c3e" />
        <KCard label="عروض مجدولة" value={scheduled.length} sub="قادمة أو خارج فترتها" bar="#2a78d6" />
        <KCard label="إجمالي العروض" value={promotions.length} sub="عرض" bar={C.gold} />
      </div>

      {activeNow.length > 0 && (
        <div style={{ background: "linear-gradient(135deg,#e8f8ee,#fff)", border: "1px solid rgba(26,140,62,.3)", borderRadius: 12, padding: ".7rem 1rem", marginBottom: "1rem", fontSize: 12.5, color: "#1a5c2e" }}>
          🏷 <b>{activeNow.length}</b> عرض فعّال الآن: {activeNow.map(p => `${p.name} (-${p.pct}% على ${catName(p.cat)})`).join(" · ")} — الأسعار المخفّضة تظهر تلقائياً في نقطة البيع.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {promotions.length === 0 && <Card><div style={{ textAlign: "center", padding: "2rem", color: C.mt }}>لا توجد عروض — أنشئ أول عرض تخفيض.</div></Card>}
        {promotions.map(p => {
          const st = statusOf(p);
          return (
            <Card key={p.id} className="nk-card-hover" style={{ borderRight: `4px solid ${st.tone === "g" ? "#1a8c3e" : st.tone === "b" ? "#2a78d6" : st.tone === "r" ? C.red : C.gold}` }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 52, height: 52, borderRadius: 12, background: C.gold + "18", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: C.gdd }}>-{p.pct}%</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>{p.name} <Badge tone={st.tone}>{st.label}</Badge></div>
                    <div style={{ fontSize: 11.5, color: C.mt, marginTop: 3 }}>
                      القسم: <b style={{ color: C.k2 }}>{catName(p.cat)}</b> · {PERIOD_ICON[p.period]} {PERIOD_NAME[p.period]}
                    </div>
                    <div style={{ fontSize: 11, color: C.mt, marginTop: 2 }}>من {arDate(p.from)} إلى {arDate(p.to)}</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div onClick={() => toggle(p.id)} title={p.active ? "إيقاف" : "تفعيل"} style={{ width: 38, height: 20, borderRadius: 10, background: p.active ? C.grl : "#ccc", position: "relative", cursor: "pointer" }}>
                    <div style={{ position: "absolute", width: 16, height: 16, borderRadius: "50%", background: "#fff", top: 2, right: p.active ? 2 : 20, transition: "right .2s" }} />
                  </div>
                  <Btn sm onClick={() => openEdit(p)}>✎ تعديل</Btn>
                  <Btn sm danger onClick={() => remove(p.id)}>حذف</Btn>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {modal && (
        <Modal title={editId ? "تعديل عرض" : "عرض تخفيض جديد"} onClose={() => setModal(false)} width={480}>
          <Field label="اسم العرض *"><Inp value={f.name} onChange={e => set("name", e.target.value)} placeholder="مثال: عرض عيد الفطر — ألعاب" /></Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="القسم المستهدف">
              <Sel value={f.cat} onChange={e => set("cat", e.target.value)}>
                <option value="all">كل الأقسام</option>
                {Object.entries(cats).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Sel>
            </Field>
            <Field label="نسبة الخصم % *"><Inp type="number" value={f.pct} onChange={e => set("pct", e.target.value)} placeholder="20" min="1" max="90" /></Field>
            <Field label="من تاريخ"><Inp type="date" value={f.from} onChange={e => set("from", e.target.value)} /></Field>
            <Field label="إلى تاريخ *"><Inp type="date" value={f.to} onChange={e => set("to", e.target.value)} /></Field>
          </div>
          <Field label="الفترة الزمنية للتطبيق" full>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 7 }}>
              {["morning", "evening", "allday"].map(pr => (
                <div key={pr} onClick={() => set("period", pr)} style={{ border: `1.5px solid ${f.period === pr ? C.gold : C.bc}`, borderRadius: 10, padding: ".6rem .4rem", textAlign: "center", cursor: "pointer", background: f.period === pr ? C.gold + "14" : C.crm }}>
                  <div style={{ fontSize: 20 }}>{PERIOD_ICON[pr]}</div>
                  <div style={{ fontSize: 10.5, fontWeight: 600, marginTop: 3 }}>{pr === "morning" ? "صباحية" : pr === "evening" ? "مسائية" : "كامل اليوم"}</div>
                  <div style={{ fontSize: 9, color: C.mt }}>{pr === "morning" ? "6ص – 4م" : pr === "evening" ? "4م – 12م" : "24 ساعة"}</div>
                </div>
              ))}
            </div>
          </Field>
          {f.pct && <div style={{ background: "rgba(26,140,62,.07)", border: "0.5px solid rgba(26,140,62,.2)", borderRadius: 8, padding: ".55rem .8rem", margin: ".3rem 0 .7rem", fontSize: 12, color: "#1a5c2e" }}>مثال: منتج سعره 50 → يصبح <b>{fmt(50 * (1 - (parseInt(f.pct) || 0) / 100))}</b> خلال فترة العرض</div>}
          <div style={{ display: "flex", gap: 8 }}><Btn gold onClick={save} style={{ flex: 1, justifyContent: "center" }}>✓ {editId ? "حفظ التعديل" : "إنشاء وتفعيل"}</Btn><Btn onClick={() => setModal(false)}>إلغاء</Btn></div>
        </Modal>
      )}
    </>
  );
}
