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

import { Badge, Crest, HubIconPaths, HubIcon, PageTop, Card, CardHead, Btn, KCard, Field, inputStyle, Inp, Sel, Modal, Table } from "./components/ui.jsx";
import CommandPalette from "./components/CommandPalette.jsx";
import { MiniBars, Donut, CompareBarChart, TrendChart, RankBarChart } from "./components/charts.jsx";
import { PDF_HOOK, openPdfDoc, ensureHtml2pdf, PdfPreview } from "./components/pdf.jsx";
import { genBarcode, BarcodeSVG } from "./components/barcode.jsx";

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


/* ============================ DASHBOARD ============================ */
import Dashboard from "./pages/Dashboard.jsx";
import POS from "./pages/POS.jsx";
import Sales from "./pages/Sales.jsx";
import Products from "./pages/Products.jsx";
import Purchases from "./pages/Purchases.jsx";
import Bookings from "./pages/Bookings.jsx";
import Suppliers from "./pages/Suppliers.jsx";
import Customers from "./pages/Customers.jsx";
import RentalDevices from "./pages/RentalDevices.jsx";
import Assets from "./pages/Assets.jsx";
import Tournaments from "./pages/Tournaments.jsx";
import Coupons from "./pages/Coupons.jsx";
import Treasury from "./pages/Treasury.jsx";
import Expenses from "./pages/Expenses.jsx";
import CapitalLedger from "./pages/CapitalLedger.jsx";
import Salaries from "./pages/Salaries.jsx";

import Insights from "./pages/Insights.jsx";
import Reports from "./pages/Reports.jsx";
import EmployeeActivity from "./pages/EmployeeActivity.jsx";
import Users from "./pages/Users.jsx";
import Inventory from "./pages/Inventory.jsx";
import Settings from "./pages/Settings.jsx";
import Alerts from "./pages/Alerts.jsx";
import Promotions from "./pages/Promotions.jsx";