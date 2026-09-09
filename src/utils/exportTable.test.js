import { describe, it, expect } from "vitest";
import { buildCsv } from "./exportTable.js";

const sheet = { name: "المبيعات", thead: ["رقم", "الزبون"], tbody: [["INV-1", "محمد"], ["INV-2", "أحمد"]] };

describe("buildCsv", () => {
  it("يكتب العناوين ثم الصفوف", () => {
    expect(buildCsv([sheet])).toBe('"رقم","الزبون"\n"INV-1","محمد"\n"INV-2","أحمد"\n');
  });

  it("يحمي علامات الاقتباس داخل القيم بمضاعفتها", () => {
    const s = { thead: ["ملاحظة"], tbody: [['قال "مرحباً"']] };
    expect(buildCsv([s])).toBe('"ملاحظة"\n"قال ""مرحباً"""\n');
  });

  it("يحوّل الفارغ والمعدوم إلى خانة فارغة لا إلى null نصية", () => {
    const s = { thead: ["أ", "ب"], tbody: [[null, undefined]] };
    expect(buildCsv([s])).toBe('"أ","ب"\n"",""\n');
  });

  it("يفصل الأوراق بسطر فارغ ويكتب اسم الورقة التالية", () => {
    const second = { name: "تفصيل", thead: ["القسم"], tbody: [["كافيه"]] };
    const csv = buildCsv([sheet, second]);
    expect(csv).toContain('\n\n"تفصيل"\n"القسم"\n"كافيه"');
  });

  it("يتحمّل ورقة بلا صفوف", () => {
    expect(buildCsv([{ thead: ["أ"], tbody: [] }])).toBe('"أ"\n');
  });
});
