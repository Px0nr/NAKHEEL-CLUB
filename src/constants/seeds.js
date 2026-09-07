/* ---------- seed data ---------- */
export const SEED_PRODUCTS = [
  { id: 1, bc: "NKH20260001", name: "وقت PS5 — ساعة", cat: "games", unit: "ساعة", packSize: 1, sell: 50, buy: 0, stock: null, min: 0, hasExp: false, exp: null, supplier: "", status: "active" },
  { id: 2, bc: "NKH20260002", name: "وقت Xbox — ساعة", cat: "games", unit: "ساعة", packSize: 1, sell: 40, buy: 0, stock: null, min: 0, hasExp: false, exp: null, supplier: "", status: "active" },
  { id: 3, bc: "NKH20260003", name: "كود Xbox شهر", cat: "games", unit: "كود رقمي", packSize: 1, sell: 120, buy: 90, stock: 15, min: 5, hasExp: false, exp: null, supplier: "توزيع البلد", status: "active" },
  { id: 4, bc: "NKH20260004", name: "كنترول PS5", cat: "games", unit: "قطعة", packSize: 1, sell: 180, buy: 130, stock: 2, min: 4, hasExp: false, exp: null, supplier: "شركة الجلال", status: "limited" },
  { id: 5, bc: "NKH20260005", name: "قهوة تركية", cat: "cafe", unit: "كوب", packSize: 1, sell: 8, buy: 2.5, stock: 60, min: 15, hasExp: false, exp: null, supplier: "مستودع الشمال", status: "active" },
  { id: 6, bc: "NKH20260006", name: "Red Bull", cat: "cafe", unit: "علبة", packSize: 24, sell: 8, sellPack: 180, buy: 4.5, stock: 18, min: 20, hasExp: true, exp: "2027-01-01", supplier: "مستودع الشمال", status: "active" },
  { id: 7, bc: "NKH20260007", name: "عصير طازج", cat: "cafe", unit: "زجاجة", packSize: 1, sell: 10, buy: 5, stock: 20, min: 8, hasExp: true, exp: "2026-07-05", supplier: "", status: "active" },
  { id: 8, bc: "NKH20260008", name: "ساندويش", cat: "cafe", unit: "وجبة", packSize: 1, sell: 22, buy: 12, stock: 20, min: 6, hasExp: true, exp: "2026-07-01", supplier: "", status: "active" },
];

export const SEED_CUSTOMERS = [
  { id: 1, name: "محمد علي", phone: "0913-456-789", wa: "218913456789", invoices: 24, total: 8420, debt: 0, last: "2026-06-29", tier: "VIP" },
  { id: 2, name: "أحمد سالم", phone: "0921-123-456", wa: "218921123456", invoices: 18, total: 5300, debt: 320, last: "2026-06-29", tier: "نشط" },
  { id: 3, name: "خالد عمر", phone: "0912-789-321", wa: "218912789321", invoices: 7, total: 1980, debt: 0, last: "2026-06-28", tier: "نشط" },
  { id: 4, name: "يوسف طاهر", phone: "0924-654-987", wa: "218924654987", invoices: 3, total: 540, debt: 180, last: "2026-06-28", tier: "جديد" },
];

export const SEED_SUPPLIERS = [
  { id: 1, name: "شركة الجلال", phone: "0913-111-222", wa: "218913111222", spec: "أجهزة ألعاب", total: 4500, due: 0, status: "نشط" },
  { id: 2, name: "مستودع الشمال", phone: "0921-333-444", wa: "218921333444", spec: "مواد كافيه", total: 800, due: 0, status: "نشط" },
  { id: 3, name: "توزيع البلد", phone: "0912-555-666", wa: "218912555666", spec: "بطاقات وأكواد", total: 3200, due: 3200, status: "آجل" },
];

export const SEED_INVOICES = [
  { id: "INV-1047", customer: "محمد علي", date: "2026-06-29", source: "منتج", details: "وقت PS5 × 2", pay: "كاش", discount: "10%", total: 420, status: "مدفوعة" },
  { id: "INV-1046", customer: "أحمد سالم", date: "2026-06-29", source: "منتج", details: "قهوة × 5", pay: "بطاقة", discount: "—", total: 750, status: "مدفوعة" },
  { id: "INV-1045", customer: "خالد عمر", date: "2026-06-28", source: "منتج", details: "عصير × 2", pay: "آجل", discount: "5%", total: 180, status: "معلقة", dueDate: "2026-07-05" },
  { id: "INV-1042", customer: "أحمد سالم", date: "2026-06-25", source: "منتج", details: "كنترول PS5 × 1", pay: "آجل", discount: "—", total: 320, status: "معلقة", dueDate: "2026-06-25" },
];

export const SEED_PURCHASES = [
  { id: "PO-234", supplier: "شركة الجلال", date: "2026-06-28", items: "كنترول PS5 × 10", pay: "كاش", total: 4500, status: "مستلم" },
  { id: "PO-233", supplier: "مستودع الشمال", date: "2026-06-27", items: "قهوة × 100", pay: "تحويل", total: 800, status: "مستلم" },
  { id: "PO-232", supplier: "توزيع البلد", date: "2026-06-26", items: "أكواد Xbox × 50", pay: "آجل", total: 3200, status: "قيد الشحن" },
];

export const SEED_EXPENSES = [
  { id: 1, date: "2026-06-01", cat: "أجار", desc: "أجار الموقع — يونيو", amount: 5000, pay: "نقداً", by: "المدير" },
  { id: 2, date: "2026-06-01", cat: "مرتبات", desc: "مرتبات شهر مايو", amount: 12000, pay: "تحويل", by: "المدير" },
  { id: 3, date: "2026-06-15", cat: "كهرباء", desc: "فاتورة الكهرباء", amount: 1800, pay: "نقداً", by: "أحمد" },
  { id: 4, date: "2026-06-20", cat: "صيانة", desc: "صيانة أجهزة PS", amount: 2500, pay: "نقداً", by: "أحمد" },
];

export const SEED_EMPLOYEES = [
  { id: 1, name: "أحمد محمود", role: "كاشير", hired: "2025-01-01", salaryStart: "2026-06-01", salary: 2500, status: "نشط" },
  { id: 2, name: "سالم الزبيدي", role: "مشرف ألعاب", hired: "2025-03-15", salaryStart: "2026-06-01", salary: 3000, status: "نشط" },
  { id: 3, name: "فارس علي", role: "فني صيانة", hired: "2025-06-01", salaryStart: "2026-06-01", salary: 2800, status: "نشط" },
];

export const SEED_COUPONS = [
  { id: 1, code: "GAME20", desc: "خصم 20% على الألعاب", pct: 20, used: 14, limit: 50, exp: "2026-07-31", status: "نشط" },
  { id: 2, code: "CAFE10", desc: "خصم 10% على الكافيه", pct: 10, used: 8, limit: 30, exp: "2026-07-15", status: "نشط" },
];

/* ---------- promotions (تخفيضات موسمية بفترات زمنية) ---------- */
export const SEED_PROMOS = [
  { id: 1, name: "عرض العطلة — ألعاب", cat: "games", pct: 20, from: "2026-06-25", to: "2026-07-15", period: "allday", active: true },
  { id: 2, name: "صباح الكافيه", cat: "cafe", pct: 10, from: "2026-06-01", to: "2026-07-31", period: "morning", active: true },
];
export const PERIOD_NAME = { morning: "الفترة الصباحية (6ص – 4م)", evening: "الفترة المسائية (4م – 12م)", allday: "كامل اليوم" };
export const PERIOD_ICON = { morning: "🌅", evening: "🌙", allday: "🕐" };

export const SEED_USERS = [
  { id: 1, name: "أحمد الحسين", username: "admin", role: "مدير", shift: "—", active: true,
    perms: { invoices: true, discounts: true, cancel: true, reports: true, customers: true, prices: true, purchases: true, inventory: true, salaries: true } },
  { id: 2, name: "سالم محمد", username: "salem", role: "بائع", shift: "صباحي", active: true,
    perms: { invoices: true, discounts: true, cancel: false, reports: false, customers: true, prices: false, purchases: false, inventory: false, salaries: false } },
  { id: 3, name: "فارس عمر", username: "faris", role: "بائع", shift: "مسائي", active: true,
    perms: { invoices: true, discounts: false, cancel: false, reports: false, customers: true, prices: false, purchases: false, inventory: false, salaries: false } },
];

export const CATS = { games: "ألعاب فيديو", cafe: "كافيه" };
export const TYPE_ICON = { billiard: "🎱", tennis: "🏓", football: "🎮" };
export const TYPE_NAME = { billiard: "بلياردو", tennis: "تنس طاولة", football: "ألعاب إلكترونية" };
export const TYPE_DEFAULT_RATE = { billiard: 15, tennis: 10, football: 40 };
// editable tables: each has its own rate (falls back to type default when created)
export const SEED_TABLES = [
  { id: "b1", type: "billiard", name: "طاولة 1", rate: 15 },
  { id: "b2", type: "billiard", name: "طاولة 2", rate: 15 },
  { id: "b3", type: "billiard", name: "طاولة 3", rate: 20 },
  { id: "t1", type: "tennis", name: "طاولة 1", rate: 10 },
  { id: "t2", type: "tennis", name: "طاولة 2", rate: 10 },
  { id: "t3", type: "tennis", name: "طاولة 3", rate: 10 },
  { id: "f1", type: "football", name: "جهاز PS5 — 1", rate: 40 },
  { id: "f2", type: "football", name: "جهاز PS5 — 2", rate: 40 },
  { id: "f3", type: "football", name: "جهاز Xbox", rate: 50 },
];

export const PERM_LABELS = {
  invoices: "إنشاء فواتير", discounts: "تطبيق خصومات", cancel: "إلغاء فواتير",
  reports: "عرض التقارير", customers: "إدارة الزبائن", prices: "تعديل الأسعار",
  purchases: "عرض المشتريات", inventory: "إدارة المخزون", salaries: "عرض المرتبات",
};

/* ---------- موارد وأصول النادي ---------- */
// status: active (موجود) | maintenance (صيانة) | damaged (تالف) | lost (مفقود)
export const SEED_ASSETS = [
  { id: "a1", name: "طاولة تنس رسمية", cat: "معدات رياضية", qty: 1, addedAt: "2026-06-01", supplier: "شركة الجلال", cost: 1200, status: "active", history: [] },
  { id: "a2", name: "مضرب تنس", cat: "معدات رياضية", qty: 6, addedAt: "2026-06-01", supplier: "شركة الجلال", cost: 45, status: "active", history: [] },
  { id: "a3", name: "جهاز بلايستيشن 5", cat: "أجهزة ألعاب", qty: 2, addedAt: "2026-06-05", supplier: "توزيع البلد", cost: 3200, status: "active", history: [] },
  { id: "a4", name: "يد تحكم PS5", cat: "أجهزة ألعاب", qty: 4, addedAt: "2026-06-05", supplier: "توزيع البلد", cost: 250, status: "active", history: [] },
];
export const ASSET_STATUS = {
  active: { label: "موجود", icon: "✅", tone: "g", color: "#1a8c3e" },
  maintenance: { label: "في الصيانة", icon: "🔧", tone: "b", color: "#2a78d6" },
  damaged: { label: "تالف", icon: "⚠️", tone: "r", color: "#c0392b" },
  lost: { label: "مفقود", icon: "❓", tone: "a", color: "#8a6a20" },
};

// كل الصفحات القابلة للإظهار/الإخفاء لكل مستخدم (ما عدا صفحات الإدارة المقصورة على المدير)
export const PAGE_LIST = [
  { id: "dashboard", label: "لوحة التحكم", icon: "▦" },
  { id: "pos", label: "نقطة البيع السريع", icon: "🛍" },
  { id: "sales", label: "المبيعات والفواتير", icon: "🧾" },
  { id: "purchases", label: "المشتريات", icon: "🛒" },
  { id: "products", label: "المنتجات", icon: "📦" },
  { id: "inventory", label: "المخزون والنواقص", icon: "🏬" },
  { id: "assets", label: "موارد النادي", icon: "🏛" },
  { id: "rentals", label: "تأجير الأجهزة", icon: "🔌" },
  { id: "bookings", label: "حجز الطاولات", icon: "📅" },
  { id: "tournaments", label: "الدوريات والمسابقات", icon: "🏆" },
  { id: "suppliers", label: "الموردون", icon: "🚚" },
  { id: "customers", label: "الزبائن", icon: "👥" },
  { id: "alerts", label: "تنبيهات السداد", icon: "🔔" },
  { id: "coupons", label: "كوبونات", icon: "🎟" },
  { id: "promos", label: "التخفيضات والعروض", icon: "🏷" },
  { id: "treasury", label: "الخزينة والإغلاق", icon: "💰" },
  { id: "expenses", label: "المصاريف", icon: "💵" },
  { id: "salaries", label: "المرتبات", icon: "🪪" },
  { id: "capital", label: "رأس المال والسيولة", icon: "🏦" },
  { id: "reports", label: "التقارير", icon: "📊" },
  { id: "insights", label: "الرؤى والتحليلات البيانية", icon: "📈" },
];
