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
