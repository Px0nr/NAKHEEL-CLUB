import { useState, useMemo, useEffect, useRef, lazy, Suspense } from "react";

import { C, T, fmt, applyTheme } from "./constants/theme.js";
import {
  SEED_PRODUCTS, SEED_CUSTOMERS, SEED_SUPPLIERS, SEED_INVOICES, SEED_PURCHASES,
  SEED_EXPENSES, SEED_EMPLOYEES, SEED_COUPONS, SEED_PROMOS, SEED_USERS, CATS,
  SEED_TABLES, SEED_ASSETS,
} from "./constants/seeds.js";
import { todayISO, daysBetween, overdueDays } from "./utils/format.js";
import { nextCounter } from "./utils/counters.js";
import { setAppAnimations } from "./utils/motionPrefs.js";
import { DB, usePersistentState } from "./db/db.js";

import { Crest, HubIcon } from "./components/ui.jsx";
import CommandPalette from "./components/CommandPalette.jsx";
import { PDF_HOOK } from "./components/pdfHook.js";
// PdfPreview يجرّ مكتبة html2pdf الثقيلة — يُحمَّل فقط عند فتح معاينة PDF فعلياً
const PdfPreview = lazy(() => import("./components/pdf.jsx").then(m => ({ default: m.PdfPreview })));
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import ConfirmDialog from "./components/ConfirmDialog.jsx";

// FirstSetup وLogin يُستوردان مباشرة (يُعرَضان قبل أي مصادقة — لا فائدة من تأجيلهما)
import FirstSetup from "./pages/FirstSetup.jsx";
import Login from "./pages/Login.jsx";
// باقي الصفحات تُحمَّل عند الطلب فقط (React.lazy) لتقليل حجم الحزمة الأولى
const Dashboard = lazy(() => import("./pages/Dashboard.jsx"));
const POS = lazy(() => import("./pages/POS.jsx"));
const Sales = lazy(() => import("./pages/Sales.jsx"));
const Products = lazy(() => import("./pages/Products.jsx"));
const Purchases = lazy(() => import("./pages/Purchases.jsx"));
const Bookings = lazy(() => import("./pages/Bookings.jsx"));
const Suppliers = lazy(() => import("./pages/Suppliers.jsx"));
const Customers = lazy(() => import("./pages/Customers.jsx"));
const RentalDevices = lazy(() => import("./pages/RentalDevices.jsx"));
const Assets = lazy(() => import("./pages/Assets.jsx"));
const Tournaments = lazy(() => import("./pages/Tournaments.jsx"));
const Coupons = lazy(() => import("./pages/Coupons.jsx"));
const Treasury = lazy(() => import("./pages/Treasury.jsx"));
const Expenses = lazy(() => import("./pages/Expenses.jsx"));
const CapitalLedger = lazy(() => import("./pages/CapitalLedger.jsx"));
const Salaries = lazy(() => import("./pages/Salaries.jsx"));
const Insights = lazy(() => import("./pages/Insights.jsx"));
const Reports = lazy(() => import("./pages/Reports.jsx"));
const EmployeeActivity = lazy(() => import("./pages/EmployeeActivity.jsx"));
const Users = lazy(() => import("./pages/Users.jsx"));
const Inventory = lazy(() => import("./pages/Inventory.jsx"));
const Settings = lazy(() => import("./pages/Settings.jsx"));
const Alerts = lazy(() => import("./pages/Alerts.jsx"));
const Promotions = lazy(() => import("./pages/Promotions.jsx"));

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
      DB.migrateAutoBackup(); // ينقل النسخة الاحتياطية خارج مخزن البيانات (تشغيل واحد)
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

/* أنماط التطبيق كدالة نقية على مستوى الوحدة — تُستدعى من useMemo داخل المكوّن.
   إبقاؤها خارج الدالة يمنع إعادة إنشاء السلسلة الضخمة في كل رندر. */
const APP_CSS = (gold, touch, anim) => `
        @keyframes nkFadeUp { from { opacity:0; transform: translateY(10px);} to {opacity:1; transform:none;} }
        @keyframes nkPop { 0%{transform:scale(.92);opacity:0} 100%{transform:scale(1);opacity:1} }
        @keyframes nkGlow { 0%,100%{box-shadow:0 0 0 0 ${gold}44} 50%{box-shadow:0 0 0 6px ${gold}00} }
        @keyframes nkKCardIn { 0%{opacity:0; transform:translateY(12px)} 100%{opacity:1; transform:none} }
        @keyframes nkBarGrowY { 0%{transform:scaleY(0)} 100%{transform:scaleY(1)} }
        @keyframes nkToastShrink { from{width:100%} to{width:0%} }
        @keyframes nkRowIn { from{opacity:0; transform:translateY(4px)} to{opacity:1; transform:none} }
        .nk-page { animation: ${anim ? "nkFadeUp .35s ease" : "none"}; }
        .nk-nav-item { transition: ${anim ? "background .18s, color .18s, border-color .18s, transform .18s" : "none"}; }
        .nk-nav-item:hover { transform: translateX(4px); }
        .nk-card-hover { transition: ${anim ? "transform .2s, box-shadow .2s" : "none"}; }
        .nk-card-hover:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,.10); }
        .nk-kcard { animation: ${anim ? "nkKCardIn .4s cubic-bezier(.2,.8,.2,1) both" : "none"}; transition: ${anim ? "transform .18s ease, box-shadow .18s ease" : "none"}; }
        .nk-kcard:hover { transform: translateY(-3px); box-shadow: 0 8px 20px rgba(20,67,31,.12); }
        .nk-kcard-bar { transform-origin: top; animation: ${anim ? "nkBarGrowY .5s cubic-bezier(.2,.8,.2,1) .08s both" : "none"}; }
        .nk-row-in { animation: ${anim ? "nkRowIn .3s ease both" : "none"}; }
        .nk-theme-transition { transition: ${anim ? "background-color .35s ease, border-color .35s ease, color .35s ease" : "none"}; }
        .nk-theme-card { animation: ${anim ? "nkKCardIn .35s cubic-bezier(.2,.8,.2,1) both" : "none"}; transition: ${anim ? "transform .18s ease, box-shadow .18s ease, border-color .2s ease, background .2s ease" : "none"}; }
        .nk-theme-card:hover { transform: translateY(-3px) !important; }
        * { scrollbar-width: thin; scrollbar-color: ${gold}66 transparent; }
        /* ---- تحسينات اللمس للأجهزة اللوحية ---- */
        html { -webkit-text-size-adjust: 100%; }
        button, input, select, textarea, [role="button"] { touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
        @media (pointer: coarse) {
          input, select, textarea { font-size: 16px !important; min-height: ${touch}px; }
          button, [role="button"] { min-height: ${touch}px; }
        }
        .nk-tbl-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
        .nk-tbl-wrap table { min-width: 560px; }
        /* تلميع بصري: استجابة الضغط والتركيز */
        button:active { transform: scale(.97); }
        button, a { transition: ${anim ? "transform .1s ease, background .15s, box-shadow .15s" : "none"}; }
        input:focus, select:focus, textarea:focus { border-color: ${gold} !important; box-shadow: 0 0 0 3px ${gold}22 !important; }
        button:focus-visible, [role="button"]:focus-visible, .nk-nav-item:focus-visible { outline: 2px solid ${gold}; outline-offset: 2px; }
        tbody tr { transition: background .12s; }
        tbody tr:hover td { background: ${gold}0d; }
        ::selection { background: ${gold}55; }
        *::-webkit-scrollbar { width: 8px; height: 8px; }
        *::-webkit-scrollbar-thumb { background: ${gold}55; border-radius: 4px; }
        *::-webkit-scrollbar-thumb:hover { background: ${gold}99; }
        *::-webkit-scrollbar-track { background: transparent; }
        button:hover { filter: brightness(1.05); }
        @keyframes nkModalIn { from { opacity: 0; transform: translateY(14px) scale(.97); } to { opacity: 1; transform: none; } }
        .nk-modal-in { animation: nkModalIn .25s ease; }
        /* الخروج — مدّته مرتبطة بـ MODAL_EXIT_MS في ui.jsx؛ تغيير أحدهما يستلزم الآخر */
        @keyframes nkModalOut { from { opacity: 1; transform: none; } to { opacity: 0; transform: translateY(8px) scale(.98); } }
        @keyframes nkFadeOut { from { opacity: 1; } to { opacity: 0; } }
        .nk-modal-out { animation: nkModalOut .17s ease forwards; }
        .nk-backdrop-out { animation: nkFadeOut .17s ease forwards; }
        /* احترام تفضيل تقليل الحركة في نظام التشغيل — يهمّ ذوي اضطرابات الدهليز.
           مستقل عن مفتاح الإعدادات داخل النظام: أيّهما طلب التقليل يُحترم.
           تُستخدم 0.01ms بدل 0 كي تبقى أحداث نهاية الحركة تُطلَق لمن يعتمد عليها. */
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
            scroll-behavior: auto !important;
          }
        }
        /* عند الطباعة الاحتياطية: يُطبع المستند فقط */
        @media print {
          body.nk-printing * { visibility: hidden !important; }
          body.nk-printing .nk-pdf-sheet, body.nk-printing .nk-pdf-sheet * { visibility: visible !important; }
          body.nk-printing .nk-pdf-sheet { position: absolute !important; top: 0; right: 0; left: 0; margin: 0 !important; max-width: none !important; box-shadow: none !important; border-radius: 0 !important; }

          /* طباعة 80 مم (موفّرة للورق) */
          body.nk-receipt-print .nk-pdf-sheet { width: 80mm !important; max-width: 80mm !important; page-break-after: avoid !important; }
          body.nk-receipt-print { page-break-before: avoid !important; page-break-after: avoid !important; }

          body.nk-printing-labels * { visibility: hidden !important; }
          body.nk-printing-labels .nk-label-sheet, body.nk-printing-labels .nk-label-sheet * { visibility: visible !important; }
          body.nk-printing-labels .nk-label-sheet { position: absolute !important; top: 0; right: 0; left: 0; margin: 0 !important; }
        }
`;

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
  const [parkedSales, setParkedSales] = usePersistentState("parkedSales", []); // فواتير نقطة البيع المعلَّقة مؤقتاً
  const [rentalDevices, setRentalDevices] = usePersistentState("rentalDevices", []); // أجهزة إلكترونية للتأجير
  const [rentals, setRentals] = usePersistentState("rentals", []); // عمليات التأجير
  const [deductions, setDeductions] = usePersistentState("deductions", []); // خصومات وجزاءات الموظفين (تأخير، مخالفات...)
  const [capitalMoves, setCapitalMoves] = usePersistentState("capitalMoves", []); // ضخ/سحب رأس المال (سيولة خارج دورة البيع والمصاريف)
  const [reportPresets, setReportPresets] = usePersistentState("reportPresets", []); // إعدادات تقارير محفوظة/مفضّلة
  const [users, setUsers] = usePersistentState("users", SEED_USERS);
  const [bookings, setBookings] = usePersistentState("bookings", {}); // الحجوزات النشطة تنجو من تحديث الصفحة
  const [tables, setTables] = usePersistentState("tables", SEED_TABLES, true);
  const [cats, setCats] = usePersistentState("cats", { games: "ألعاب فيديو", cafe: "كافيه" }, true);
  const [completedBookings, setCompletedBookings] = usePersistentState("completed_bookings", []);
  // عدّادات تسلسلية دائمة لأرقام الفواتير/التوريدات (لا تتكرر أبداً حتى بعد حذف سجلات) —
  // القيم الابتدائية تطابق الترقيم القديم المعتمد على .length لضمان استمرارية الأرقام
  const [counters, setCounters] = usePersistentState("counters", { invoice: 1047, po: 234, bkInvoice: 0, autoInvoice: 8, rtInvoice: 0, obInvoice: 0 }, true);
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

  // confirm(message, { danger }) — بديل نافذة window.confirm الأصلية، يُستخدم كـ: if (!(await confirm("..."))) return;
  const [confirmState, setConfirmState] = useState(null);
  const confirm = (message, opts) => new Promise((resolve) => {
    setConfirmState({ message, danger: opts && opts.danger, resolve });
  });

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

  // مزامنة مفتاح الحركة مع طبقة GSAP المركزية — تفضيل نظام التشغيل
  // (prefers-reduced-motion) يُحترم هناك بالتوازي مع هذا المفتاح
  useEffect(() => { setAppAnimations(settings.animations); }, [settings.animations]);

  /* تاريخ آخر نسخة كملف كحالة React — يعيش في DB.cache التي لا تُحدِث رندراً،
     فبلا هذا يبقى تنبيه النسخ ظاهراً بعد التنزيل حتى نبضة الدقيقة التالية.
     يُعرَّف قبل notifications أدناه لأنها تقرأه (تعريفه بعدها = منطقة ميتة زمنية). */
  const [lastFileBackup, setLastFileBackup] = useState(DB.lastFileBackupAt());
  useEffect(() => { DB.onBackupChange = setLastFileBackup; return () => { DB.onBackupChange = null; }; }, []);

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
    // يُحتسب تاريخ النسخة كملف وحده: اللقطة الداخلية تعيش في نفس التخزين الذي
    // يزول مع الجهاز، فاحتسابها كان يُطفئ التنبيه دون أن يحمي شيئاً
    const lastBk = lastFileBackup;
    const bkDays = lastBk ? Math.floor((Date.now() - new Date(lastBk)) / 86400000) : null;
    if (bkDays === null || bkDays >= (settings.backupFreq || 7)) list.push({ id: "backup", icon: "🛡", tone: "gold", text: lastBk ? `مضى ${bkDays} يوم على آخر نسخة محفوظة كملف` : "لا توجد نسخة محفوظة كملف خارج المتصفح", page: "settings" });
    const todayClosing = closings.find(c => c.date === todayISO());
    if (!todayClosing) list.push({ id: "closing", icon: "🔒", tone: "b", text: "لم يُغلق حساب اليوم في الخزينة بعد", page: "treasury" });
    const maintTooLong = assets.filter(a => a.status === "maintenance" && a.maintStart && daysBetween(a.maintStart, todayISO()) > 14);
    if (maintTooLong.length > 0) list.push({ id: "maint", icon: "🔧", tone: "a", text: `${maintTooLong.length} مورد في الصيانة منذ أكثر من 14 يوماً`, page: "assets" });
    const rentalsEndingSoon = (rentals || []).filter(r => r.status !== "مُرجَع" && (new Date(r.endAt).getTime() - Date.now()) <= 3600000);
    if (rentalsEndingSoon.length > 0) list.push({ id: "rental", icon: "⏰", tone: "a", text: `${rentalsEndingSoon.length} جهاز مؤجَّر تنتهي مدته خلال ساعة أو متأخر`, page: "rentals" });
    return list;
  }, [overdueAlerts, products, closings, assets, settings, rentals, nowTick, lastFileBackup]);

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

  /* إنذار فشل الحفظ — دائم لا toast عابر: فشل الكتابة يعني أن كل ما يُسجَّل بعده
     يضيع، فالمستخدم يحتاج أن يرى الحالة باستمرار حتى تُعالَج لا لثانيتين. */
  const [writeError, setWriteError] = useState(DB.lastWriteError);
  useEffect(() => { DB.onWriteError = setWriteError; return () => { DB.onWriteError = null; }; }, []);

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

  // تطبيق الثيم النشط على اللوحة المشتركة قبل أي رندر — يسبق العودات المبكّرة
  // كي تحصل شاشتا الإعداد والدخول على ألوان الثيم الصحيحة أيضاً، ولأن appCss
  // أدناه يقرأ C.gold بعد تحديثه
  applyTheme(settings);

  /* أنماط التطبيق تُبنى مرة واحدة لا مع كل رندر: كانت سلسلة نصية طويلة تُعاد
     صياغتها عند كل تحديث حالة (تنقّل، تنبيه، تعديل سلة...). لا تعتمد إلا على
     لون الثيم ومقاس اللمس ومفتاح الحركة.
     موضعها هنا فوق العودات المبكّرة إلزامي: الخطافات يجب أن تُستدعى بنفس
     الترتيب في كل رندر، وإلا انكسر React عند الانتقال من الدخول إلى النظام. */
  // settings.theme و settings.dark ضروريان رغم أن اللينتر يعدّهما زائدين: applyTheme
  // يعدّل الكائن C على مستوى الوحدة، فهما الإشارة الوحيدة إلى أن C.gold تغيّر —
  // ولا سبيل للينتر أن يرى ذلك لأنه يتتبّع المراجع النصية داخل الدالة فقط.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const appCss = useMemo(() => APP_CSS(C.gold, T.touch, settings.animations), [settings.animations, settings.theme, settings.dark]);

  // إعداد أولي: إن لم يوجد أي مستخدم (بعد التصفير) → شاشة إنشاء المدير الرئيسي
  if (!users || users.length === 0) {
    return <FirstSetup settings={settings} onCreate={(admin) => { setUsers([admin]); setUser(admin); }} />;
  }

  if (!user) return <Login users={users} onLogin={setUser} settings={settings} setUsers={setUsers} />;

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
    auditLog, setAuditLog, parkedSales, setParkedSales,
    rentalDevices, setRentalDevices,
    rentals, setRentals,
    deductions, setDeductions,
    capitalMoves, setCapitalMoves,
    reportPresets, setReportPresets,
    bookings, setBookings, completedBookings, setCompletedBookings, tables, setTables,
    cats, setCats,
    settings, setSettings,
    nextCounter: (key) => nextCounter(counters, setCounters, key),
    totals, showToast, confirm, overdueAlerts, notifications,
    cmdOpen, setCmdOpen, searchIntent, setSearchIntent,
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
      <style>{appCss}</style>

      {/* إنذار فشل الحفظ — يعلو كل شيء ولا يُغلق: ما دام ظاهراً فالعمل الجديد لا يُحفظ */}
      {writeError && (
        <div role="alert" style={{
          position: "fixed", top: 0, insetInline: 0, zIndex: 900, background: "#c0392b", color: "#fff",
          padding: ".6rem 1rem", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center",
          justifyContent: "center", gap: 10, flexWrap: "wrap", boxShadow: "0 4px 16px rgba(0,0,0,.3)",
        }}>
          <span>
            ⛔ تعذّر حفظ البيانات — {writeError.quota
              ? "مساحة التخزين ممتلئة. صدّر نسخة احتياطية ثم احذف صور المنتجات الكبيرة أو صفّر البيانات القديمة."
              : "خطأ في الكتابة. لا تعتمد على ما يُسجَّل الآن."}
          </span>
          <button onClick={() => { setPage("settings"); }} style={{
            background: "rgba(255,255,255,.18)", border: "1px solid rgba(255,255,255,.5)", color: "#fff",
            borderRadius: 8, padding: ".2rem .7rem", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
          }}>فتح النسخ الاحتياطي</button>
        </div>
      )}

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
          <button onClick={() => goPage("settings")} title={
            DB.mode === "supabase" ? "سحابية — Supabase (متزامنة بين الأجهزة)"
              : DB.mode === "local" ? "محلية — محفوظة على هذا الجهاز فقط"
              : "مؤقتة — في الذاكرة فقط، ستُفقد عند التحديث"
          } style={{ position: "relative", background: "rgba(255,255,255,.1)", border: "none", borderRadius: 9, width: 32, height: 32, cursor: "pointer", fontSize: 14, color: DB.mode === "supabase" ? "#4ee08a" : DB.mode === "local" ? C.gld : "#ff7a70", flexShrink: 0 }}>
            {DB.mode === "supabase" ? "☁️" : DB.mode === "local" ? "💾" : "⚠️"}
          </button>
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
        <ErrorBoundary resetKey={page} onReset={() => setPage("dashboard")}>
        <Suspense fallback={<div style={{ textAlign: "center", padding: "3rem 0", color: C.mt, fontSize: 13 }}>⏳ جارٍ التحميل...</div>}>
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
        </Suspense>
        </ErrorBoundary>
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

      {confirmState && (
        <ConfirmDialog
          message={confirmState.message}
          danger={confirmState.danger}
          onConfirm={() => { confirmState.resolve(true); setConfirmState(null); }}
          onCancel={() => { confirmState.resolve(false); setConfirmState(null); }}
        />
      )}

      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} products={products} customers={customers} invoices={invoices} hubs={HUBS} goPage={goPage} setSearchIntent={setSearchIntent} currency={settings.currency || "د.ل"} />

      {/* PDF PREVIEW OVERLAY */}
      {pdfDoc && (
        <Suspense fallback={<div style={{ position: "fixed", inset: 0, zIndex: 700, background: "rgba(12,20,14,.75)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13 }}>⏳ جارٍ تجهيز المعاينة...</div>}>
          <PdfPreview doc={pdfDoc} onClose={() => setPdfDoc(null)} globalSettings={settings} />
        </Suspense>
      )}
    </div>
  );
}
