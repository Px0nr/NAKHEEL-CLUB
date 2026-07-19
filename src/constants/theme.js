/* ---------- COLOR PALETTE (mutable — applyTheme mutates this in place) ---------- */
export const C = {
  gold: "#c9a84c", gld: "#f0d080", gdd: "#8a6a20",
  grn: "#14431f", grn2: "#1a5c2e", grl: "#2d8c4e",
  crm: "#faf8f2", ink: "#1a1a18", k2: "#3d3c38", mt: "#7a7870",
  bc: "rgba(201,168,76,0.2)", cd: "#fff", pg: "#f4f1e8",
  red: "#c0392b", redbg: "#fde9e9", blue: "#1a3e8c", bluebg: "#e4effe",
  purp: "#4a3aa7", purpbg: "#eeeafd", dark: false,
};

/* ---------- DESIGN TOKENS (T) ----------
   مقاييس موحّدة: خطوط أكبر مناسبة للأجهزة اللوحية، مسافات بمضاعفات 4،
   وأهداف لمس ≥44px حسب معايير Apple/Google. تُستخدم تدريجياً في الواجهات
   الأكثر استخداماً (POS واللوحة) دون كسر الصفحات القديمة. */
export const T = {
  font: { xs: 12, sm: 13.5, base: 15, lg: 17, xl: 20, xxl: 26, num: 22, numLg: 30 },
  sp: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
  rad: { sm: 8, md: 12, lg: 16 },
  shadow: { card: "0 2px 10px rgba(0,0,0,.06)", pop: "0 14px 40px rgba(0,0,0,.22)" },
  touch: 44,
};

export const fmt = (n) => Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });

/* ---------- THEME SYSTEM ---------- */
export const THEMES = {
  gold:    { name: "ذهبي كلاسيكي", accent: "#c9a84c", accentD: "#8a6a20", accentL: "#f0d080", brand: "#14431f", brand2: "#1a5c2e", bgLight: "#f4f1e8", bgDark: "#12100c" },
  emerald: { name: "زمردي", accent: "#1aa06a", accentD: "#0c6b45", accentL: "#7fe3bd", brand: "#08312a", brand2: "#0f5c4a", bgLight: "#f0f7f3", bgDark: "#0c1613" },
  royal:   { name: "ملكي أزرق", accent: "#3d6fd6", accentD: "#264c9c", accentL: "#9dbcf5", brand: "#141d3d", brand2: "#22346b", bgLight: "#f0f3fb", bgDark: "#0e1224" },
  sunset:  { name: "غروب", accent: "#e07b3c", accentD: "#a8531f", accentL: "#f5b98a", brand: "#3d1f14", brand2: "#6b3722", bgLight: "#faf3ee", bgDark: "#1f120c" },
  ocean:   { name: "محيطي", accent: "#1f9ba8", accentD: "#0f6670", accentL: "#8ad9e1", brand: "#0a2e33", brand2: "#12565e", bgLight: "#eef8fa", bgDark: "#0a1a1c" },
  midnight:{ name: "الليل الهادئ", accent: "#7c8fd6", accentD: "#4d5aa3", accentL: "#c2caf0", brand: "#1a1f38", brand2: "#262c4d", bgLight: "#f1f2f8", bgDark: "#12142a" },
  rose:    { name: "الياسمين", accent: "#d97ba0", accentD: "#a24d73", accentL: "#f5c3d9", brand: "#3d1f2b", brand2: "#5c2e40", bgLight: "#faf1f5", bgDark: "#1f1015" },
  charcoal:{ name: "الفحم", accent: "#9a9a9a", accentD: "#5c5c5c", accentL: "#d4d4d4", brand: "#1c1c1c", brand2: "#2e2e2e", bgLight: "#f3f3f3", bgDark: "#141414" },
  desert:  { name: "الصحراء", accent: "#c98a4b", accentD: "#8f5f2e", accentL: "#e6bd8f", brand: "#3d2a17", brand2: "#5c4023", bgLight: "#f9f1e6", bgDark: "#1f150c" },
  neon:    { name: "نيون الألعاب", accent: "#c04cf5", accentD: "#8a2fb3", accentL: "#e5a8fb", brand: "#180a2e", brand2: "#2a1050", bgLight: "#f7effc", bgDark: "#120a1f" },
};

export function resolveTheme(settings) {
  const t = THEMES[settings.theme] || THEMES.gold;
  const dark = settings.dark;
  return {
    ...t,
    gold: t.accent, gld: t.accentL, gdd: t.accentD,
    grn: t.brand, grn2: t.brand2, grl: t.accent,
    // surfaces flip in dark mode — لون خلفية مخصّص (إن اختير) يتفوّق على لون خلفية الثيم المميّز
    pg: settings.customBg || (dark ? t.bgDark : t.bgLight),
    cd: dark ? "#1e1b16" : "#fff",
    crm: dark ? "#26221b" : "#faf8f2",
    ink: dark ? "#f2efe6" : "#1a1a18",
    k2: dark ? "#c9c5ba" : "#3d3c38",
    mt: dark ? "#8f8b80" : "#7a7870",
    bc: dark ? "rgba(201,168,76,0.14)" : "rgba(201,168,76,0.2)",
    red: "#c0392b", redbg: dark ? "rgba(192,57,43,.18)" : "#fde9e9",
    blue: "#4a7fd6", bluebg: dark ? "rgba(74,127,214,.16)" : "#e4effe",
    purp: "#6b5bd0", purpbg: dark ? "rgba(107,91,208,.16)" : "#eeeafd",
    dark,
  };
}

export function applyTheme(settings) {
  Object.assign(C, resolveTheme(settings));
}
