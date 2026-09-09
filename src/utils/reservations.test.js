import { describe, it, expect } from "vitest";
import { overlaps, activeBookingRange, reservationRange, findConflict, reservationsForTableOnDay, nextReservationToday, isOverdue } from "./reservations.js";

describe("overlaps", () => {
  it("يكتشف تداخلاً حقيقياً", () => expect(overlaps(10, 20, 15, 25)).toBe(true));
  it("لا يعتبر التلاصق (نهاية = بداية) تداخلاً", () => expect(overlaps(10, 20, 20, 30)).toBe(false));
  it("لا تداخل لفترتين منفصلتين تماماً", () => expect(overlaps(10, 20, 30, 40)).toBe(false));
});

describe("activeBookingRange", () => {
  it("حجز بمدة محددة ينتهي بعد durationMin", () => {
    const r = activeBookingRange({ startTime: 1000, durationMin: 60 });
    expect(r).toEqual({ start: 1000, end: 1000 + 60 * 60000 });
  });
  it("حجز مفتوح (بلا durationMin) يمتد لنهاية اليوم لا للأبد", () => {
    const start = new Date("2026-09-09T10:00:00").getTime();
    const r = activeBookingRange({ startTime: start, durationMin: null });
    expect(r.end).toBeGreaterThan(start);
    expect(new Date(r.end).toDateString()).toBe(new Date(start).toDateString());
  });
});

describe("reservationRange", () => {
  it("ينتهي بعد durationMin من startAt", () => {
    const r = reservationRange({ startAt: "2026-09-09T20:00:00.000Z", durationMin: 30 });
    expect(r).toEqual({ start: new Date("2026-09-09T20:00:00.000Z").getTime(), end: new Date("2026-09-09T20:30:00.000Z").getTime() });
  });
});

describe("findConflict", () => {
  const start = new Date("2026-09-09T20:00:00").toISOString();
  const mkRes = (over) => ({ id: "r1", tableId: "t1", customerName: "أحمد", startAt: start, durationMin: 60, status: "محجوز", ...over });

  it("لا تعارض على طاولة فارغة", () => {
    expect(findConflict("t1", Date.now(), Date.now() + 3600000, { bookings: {}, reservations: [] })).toBeNull();
  });

  it("يكتشف التعارض مع حجز نشط حالياً على نفس الطاولة", () => {
    const now = Date.now();
    const bookings = { b1: { tableId: "t1", customer: "سالم", startTime: now, durationMin: 60 } };
    const conflict = findConflict("t1", now + 1800000, now + 5400000, { bookings, reservations: [] });
    expect(conflict).toMatchObject({ kind: "active", customer: "سالم" });
  });

  it("لا يتأثر بحجز نشط على طاولة أخرى", () => {
    const now = Date.now();
    const bookings = { b1: { tableId: "OTHER", customer: "سالم", startTime: now, durationMin: 60 } };
    expect(findConflict("t1", now, now + 3600000, { bookings, reservations: [] })).toBeNull();
  });

  it("يكتشف التعارض مع حجز مستقبلي على نفس الطاولة", () => {
    const s = new Date(start).getTime();
    const conflict = findConflict("t1", s + 1800000, s + 5400000, { bookings: {}, reservations: [mkRes()] });
    expect(conflict).toMatchObject({ kind: "reservation", customer: "أحمد" });
  });

  it("لا تعارض قبل أو بعد نطاق الحجز المستقبلي مباشرة", () => {
    const s = new Date(start).getTime();
    expect(findConflict("t1", s - 3600000, s, { bookings: {}, reservations: [mkRes()] })).toBeNull();
    expect(findConflict("t1", s + 3600000, s + 7200000, { bookings: {}, reservations: [mkRes()] })).toBeNull();
  });

  it("يتجاهل حجزاً مُلغى", () => {
    const s = new Date(start).getTime();
    expect(findConflict("t1", s, s + 3600000, { bookings: {}, reservations: [mkRes({ status: "ملغى" })] })).toBeNull();
  });

  it("يستثني الحجز نفسه عبر excludeReservationId عند تعديل موعده", () => {
    const s = new Date(start).getTime();
    expect(findConflict("t1", s, s + 3600000, { bookings: {}, reservations: [mkRes()] }, "r1")).toBeNull();
  });
});

describe("reservationsForTableOnDay و nextReservationToday", () => {
  const list = [
    { id: "r1", tableId: "t1", status: "محجوز", startAt: "2026-09-09T14:00:00.000Z" },
    { id: "r2", tableId: "t1", status: "محجوز", startAt: "2026-09-09T10:00:00.000Z" },
    { id: "r3", tableId: "t1", status: "محجوز", startAt: "2026-09-10T10:00:00.000Z" }, // يوم آخر
    { id: "r4", tableId: "t2", status: "محجوز", startAt: "2026-09-09T11:00:00.000Z" }, // طاولة أخرى
  ];

  it("يرجّع حجوزات الطاولة واليوم فقط مرتَّبة زمنياً", () => {
    const rows = reservationsForTableOnDay("t1", list, "2026-09-09");
    expect(rows.map(r => r.id)).toEqual(["r2", "r1"]);
  });

  it("nextReservationToday يتجاهل ما مضى ويعيد الأقرب القادم", () => {
    const next = nextReservationToday("t1", list, "2026-09-09T12:00:00.000Z");
    expect(next.id).toBe("r1");
  });

  it("nextReservationToday يعيد null إن لم يبقَ شيء اليوم", () => {
    expect(nextReservationToday("t1", list, "2026-09-09T23:00:00.000Z")).toBeNull();
  });
});

describe("isOverdue", () => {
  it("ليس متأخراً خلال مهلة السماح", () => {
    expect(isOverdue({ status: "محجوز", startAt: "2026-09-09T10:00:00.000Z" }, new Date("2026-09-09T10:10:00.000Z").getTime())).toBe(false);
  });
  it("متأخر بعد تجاوز المهلة", () => {
    expect(isOverdue({ status: "محجوز", startAt: "2026-09-09T10:00:00.000Z" }, new Date("2026-09-09T10:25:00.000Z").getTime())).toBe(true);
  });
  it("حجز غير بحالة «محجوز» لا يُعتبر متأخراً", () => {
    expect(isOverdue({ status: "ملغى", startAt: "2026-09-09T10:00:00.000Z" }, new Date("2026-09-09T12:00:00.000Z").getTime())).toBe(false);
  });
});
