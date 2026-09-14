import { describe, it, expect } from "vitest";
import { categoryTotals, toSegments, categoryColorMap, sourceCat, catLabel, rangePreset, inRange, revenueInRange, CATEGORICAL_LIGHT, CATEGORICAL_DARK, CHART_MUTED, pctDelta, deltaLabel, profitOnDate, topItemsOnDate } from "./analytics.js";

const cats = { games: "ألعاب فيديو", cafe: "كافيه" };

describe("sourceCat", () => {
  it("maps invoice sources to synthetic category keys", () => {
    expect(sourceCat({ source: "حجز" })).toBe("__booking");
    expect(sourceCat({ source: "تأجير" })).toBe("__rental");
    expect(sourceCat({ source: "رصيد سابق" })).toBe("__opening");
    expect(sourceCat({ source: "منتج" })).toBe("__uncat");
  });
});

describe("catLabel", () => {
  it("prefers a real product category name", () => {
    expect(catLabel("games", cats)).toBe("ألعاب فيديو");
  });
  it("falls back to a stream label", () => {
    expect(catLabel("__booking", cats)).toBe("الحجوزات");
  });
  it("falls back to the key itself when unknown", () => {
    expect(catLabel("mystery", cats)).toBe("mystery");
  });
});

describe("categoryTotals", () => {
  it("aggregates by items[].cat when present", () => {
    const invoices = [
      { status: "مدفوعة", items: [{ cat: "games", lineTotal: 100 }, { cat: "cafe", lineTotal: 40 }] },
      { status: "مدفوعة", items: [{ cat: "games", lineTotal: 60 }] },
    ];
    expect(categoryTotals(invoices)).toEqual({ games: 160, cafe: 40 });
  });

  it("falls back to invoice source for old invoices without items", () => {
    const invoices = [
      { status: "مدفوعة", source: "حجز", total: 200 },
      { status: "مدفوعة", source: "تأجير", total: 50 },
    ];
    expect(categoryTotals(invoices)).toEqual({ __booking: 200, __rental: 50 });
  });

  it("mixes itemized and legacy invoices in one map", () => {
    const invoices = [
      { status: "مدفوعة", items: [{ cat: "cafe", lineTotal: 30 }] },
      { status: "مدفوعة", source: "حجز", total: 70 },
    ];
    expect(categoryTotals(invoices)).toEqual({ cafe: 30, __booking: 70 });
  });

  it("excludes opening-debt balances by default but includes them on request", () => {
    const invoices = [{ items: [{ cat: "__opening", lineTotal: 500 }] }, { items: [{ cat: "cafe", lineTotal: 20 }] }];
    expect(categoryTotals(invoices)).toEqual({ cafe: 20 });
    expect(categoryTotals(invoices, { includeOpening: true })).toEqual({ cafe: 20, __opening: 500 });
  });

  it("treats items without an explicit cat as uncategorized", () => {
    expect(categoryTotals([{ items: [{ lineTotal: 15 }] }])).toEqual({ __uncat: 15 });
  });
});

describe("toSegments", () => {
  it("sorts descending and computes percentages", () => {
    const segs = toSegments({ games: 60, cafe: 40 }, cats);
    expect(segs.map(s => s.label)).toEqual(["ألعاب فيديو", "كافيه"]);
    expect(segs.map(s => s.pct)).toEqual([60, 40]);
    expect(segs[0].color).toBeTruthy();
  });

  it("groups the tail beyond maxSegments into أخرى with the neutral muted color", () => {
    const totals = { a: 50, b: 40, c: 30, d: 20, e: 10, f: 5, g: 5 };
    const segs = toSegments(totals, {}, false, 5);
    expect(segs).toHaveLength(6);
    expect(segs[5].label).toBe("أخرى");
    expect(segs[5].value).toBe(10); // f + g
    expect(segs[5].color).toBe(CHART_MUTED);
  });

  it("ignores zero/negative values", () => {
    const segs = toSegments({ a: 0, b: 10 }, {});
    expect(segs).toHaveLength(1);
    expect(segs[0].value).toBe(10);
  });

  it("keeps a category's color identical across different rankings (color follows identity, not rank)", () => {
    const dayOne = toSegments({ cafe: 90, games: 10 }, cats); // cafe on top
    const dayTwo = toSegments({ cafe: 10, games: 90 }, cats); // games on top now
    const cafeColorDay1 = dayOne.find(s => s.key === "cafe").color;
    const cafeColorDay2 = dayTwo.find(s => s.key === "cafe").color;
    const gamesColorDay1 = dayOne.find(s => s.key === "games").color;
    const gamesColorDay2 = dayTwo.find(s => s.key === "games").color;
    expect(cafeColorDay1).toBe(cafeColorDay2);
    expect(gamesColorDay1).toBe(gamesColorDay2);
  });

  it("uses the dark palette when dark=true", () => {
    const segs = toSegments({ cafe: 10 }, cats, true);
    expect(CATEGORICAL_DARK).toContain(segs[0].color);
    expect(CATEGORICAL_LIGHT).not.toContain(segs[0].color);
  });
});

describe("categoryColorMap", () => {
  it("assigns real category keys before synthetic stream keys", () => {
    const map = categoryColorMap(["__booking", "cafe", "games"]);
    // real keys sorted alphabetically get the first slots: "cafe" then "games"
    expect(map.cafe).toBe(CATEGORICAL_LIGHT[0]);
    expect(map.games).toBe(CATEGORICAL_LIGHT[1]);
    expect(map.__booking).toBe(CATEGORICAL_LIGHT[2]);
  });

  it("gives every distinct key its own slot with no two keys colliding (within the palette size)", () => {
    const map = categoryColorMap(["cafe", "games", "__booking", "__rental"]);
    const colors = Object.values(map);
    expect(new Set(colors).size).toBe(colors.length);
  });

  it("is stable regardless of input order", () => {
    const mapA = categoryColorMap(["games", "cafe", "__booking"]);
    const mapB = categoryColorMap(["__booking", "cafe", "games"]);
    expect(mapA).toEqual(mapB);
  });
});

describe("rangePreset", () => {
  const ref = new Date(2026, 6, 15); // 15 July 2026 (local)
  it("returns a single-day range for today", () => {
    const r = rangePreset("today", ref);
    expect(r.from).toBe(r.to);
  });
  it("spans 7 days for last7", () => {
    const r = rangePreset("last7", ref);
    // from is 6 days before the ref day
    expect(r.from <= r.to).toBe(true);
  });
  it("starts thisMonth on the first of the month", () => {
    const r = rangePreset("thisMonth", ref);
    expect(r.from.endsWith("-01")).toBe(true);
  });
  it("bounds lastMonth to the previous calendar month", () => {
    const r = rangePreset("lastMonth", ref);
    expect(r.from.slice(0, 7)).toBe("2026-06");
    expect(r.to.slice(0, 7)).toBe("2026-06");
  });
  it("starts thisQuarter on the first day of the current calendar quarter", () => {
    const r = rangePreset("thisQuarter", ref); // July -> Q3 starts July 1
    expect(r.from.slice(0, 8)).toBe("2026-07-");
    expect(r.from.endsWith("-01")).toBe(true);
  });
  it("bounds lastQuarter to the full previous calendar quarter", () => {
    const r = rangePreset("lastQuarter", ref); // previous quarter: Apr-Jun
    expect(r.from).toBe("2026-04-01");
    expect(r.to).toBe("2026-06-30");
  });
  it("bounds lastYear to the full previous calendar year", () => {
    const r = rangePreset("lastYear", ref);
    expect(r.from).toBe("2025-01-01");
    expect(r.to).toBe("2025-12-31");
  });
});

describe("inRange & revenueInRange", () => {
  it("inRange is inclusive of both bounds", () => {
    expect(inRange("2026-07-05", "2026-07-01", "2026-07-31")).toBe(true);
    expect(inRange("2026-08-01", "2026-07-01", "2026-07-31")).toBe(false);
  });
  it("sums only paid invoices within the range", () => {
    const invoices = [
      { status: "مدفوعة", date: "2026-07-05", total: 100 },
      { status: "معلقة", date: "2026-07-06", total: 999 },
      { status: "مدفوعة", date: "2026-08-01", total: 50 },
    ];
    expect(revenueInRange(invoices, "2026-07-01", "2026-07-31")).toBe(100);
  });
});

describe("pctDelta", () => {
  it("computes a normal percentage change", () => {
    expect(pctDelta(120, 100)).toBe(20);
    expect(pctDelta(80, 100)).toBe(-20);
  });
  it("returns 100% when going from zero to a positive value", () => {
    expect(pctDelta(50, 0)).toBe(100);
  });
  it("returns 0% when staying at zero", () => {
    expect(pctDelta(0, 0)).toBe(0);
  });
});

describe("deltaLabel", () => {
  it("shows a percentage when both values are non-negative", () => {
    expect(deltaLabel(120, 100, "د.ل")).toBe("20%");
  });
  it("falls back to a currency difference when either value is negative (e.g. a loss)", () => {
    expect(deltaLabel(50, -20, "د.ل")).toBe("+70 د.ل");
    expect(deltaLabel(-10, 30, "د.ل")).toBe("-40 د.ل");
  });
  it("appends the optional suffix", () => {
    expect(deltaLabel(120, 100, "د.ل", " عن الأمس")).toBe("20% عن الأمس");
  });
});

describe("profitOnDate", () => {
  it("يطرح تكلفة البضاعة والمصاريف والإتلاف من إيراد اليوم فقط", () => {
    const invoices = [
      { date: "2026-07-20", status: "مدفوعة", total: 100, cost: 40 },
      { date: "2026-07-20", status: "مدفوعة", total: 50, cost: 20 },
      { date: "2026-07-19", status: "مدفوعة", total: 999, cost: 999 }, // يوم آخر — يُستثنى
      { date: "2026-07-20", status: "معلقة", total: 500, cost: 1 }, // غير مدفوعة — تُستثنى
    ];
    const expenses = [{ date: "2026-07-20", amount: 30 }, { date: "2026-07-19", amount: 999 }];
    const waste = [{ date: "2026-07-20", cost: 10 }, { date: "2026-07-19", cost: 999 }];
    // 150 إيراد - 60 تكلفة - 30 مصاريف - 10 إتلاف = 50
    expect(profitOnDate("2026-07-20", { invoices, expenses, waste })).toBe(50);
  });

  it("يعيد رقماً سالباً في يوم خسارة", () => {
    const invoices = [{ date: "2026-07-20", status: "مدفوعة", total: 20, cost: 5 }];
    const expenses = [{ date: "2026-07-20", amount: 100 }];
    expect(profitOnDate("2026-07-20", { invoices, expenses, waste: [] })).toBe(-85);
  });

  it("يتحمّل غياب المصاريف/الإتلاف بلا انهيار", () => {
    const invoices = [{ date: "2026-07-20", status: "مدفوعة", total: 20, cost: 5 }];
    expect(profitOnDate("2026-07-20", { invoices })).toBe(15);
  });

  it("يعيد صفراً ليوم بلا أي فواتير مدفوعة", () => {
    expect(profitOnDate("2026-07-20", { invoices: [] })).toBe(0);
  });
});

describe("topItemsOnDate", () => {
  const invoices = [
    { date: "2026-07-20", status: "مدفوعة", items: [
      { pid: 1, name: "قهوة", qty: 2, lineTotal: 20 },
      { pid: 2, name: "شاي", qty: 1, lineTotal: 5 },
    ] },
    { date: "2026-07-20", status: "مدفوعة", items: [
      { pid: 1, name: "قهوة", qty: 3, lineTotal: 30 },
    ] },
    { date: "2026-07-20", status: "مدفوعة", items: [
      { pid: null, name: "حجز طاولة", qty: 1, lineTotal: 100, cat: "__booking" }, // اصطناعي — يُستثنى
    ] },
    { date: "2026-07-19", status: "مدفوعة", items: [{ pid: 1, name: "قهوة", qty: 99, lineTotal: 990 }] }, // يوم آخر
    { date: "2026-07-20", status: "معلقة", items: [{ pid: 3, name: "عصير", qty: 5, lineTotal: 50 }] }, // غير مدفوعة
  ];

  it("يجمع نفس الصنف عبر فواتير متعددة ويرتّب بالإيراد تنازلياً", () => {
    const top = topItemsOnDate("2026-07-20", invoices);
    expect(top).toEqual([
      { pid: 1, name: "قهوة", qty: 5, revenue: 50 },
      { pid: 2, name: "شاي", qty: 1, revenue: 5 },
    ]);
  });

  it("يستثني العناصر الاصطناعية بلا pid والفواتير غير المدفوعة وأيام أخرى", () => {
    const top = topItemsOnDate("2026-07-20", invoices);
    expect(top.find(i => i.name === "حجز طاولة")).toBeUndefined();
    expect(top.find(i => i.name === "عصير")).toBeUndefined();
    expect(top.reduce((s, i) => s + i.qty, 0)).toBe(6); // لا يشمل الـ99 من اليوم الآخر
  });

  it("يحترم حدّ العدد المطلوب", () => {
    const many = [{ date: "d", status: "مدفوعة", items: [1, 2, 3, 4, 5, 6].map(n => ({ pid: n, name: "p" + n, qty: 1, lineTotal: n })) }];
    expect(topItemsOnDate("d", many, 3)).toHaveLength(3);
  });

  it("يعيد مصفوفة فارغة بلا فواتير", () => {
    expect(topItemsOnDate("2026-07-20", [])).toEqual([]);
  });
});
