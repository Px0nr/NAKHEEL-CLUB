// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";

// وهم بسيط لـ AudioContext — الاختبار يتحقق من عدم الانهيار والاستدعاء الصحيح
// للواجهة، لا من الصوت الفعلي (غير قابل للاختبار في jsdom أصلاً)
class FakeGain { constructor() { this.gain = { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() }; } connect() {} }
class FakeOsc { constructor() { this.frequency = { value: 0 }; } connect() {} start() {} stop() {} }
class FakeAudioContext {
  constructor() { this.state = "running"; this.currentTime = 0; this.destination = {}; }
  createGain() { return new FakeGain(); }
  createOscillator() { return new FakeOsc(); }
  resume() { this.state = "running"; return Promise.resolve(); }
}

describe("playTimeUpAlarm", () => {
  beforeEach(() => { vi.resetModules(); });

  it("لا ينهار عند غياب دعم AudioContext في المتصفح", async () => {
    const original = window.AudioContext;
    delete window.AudioContext;
    delete window.webkitAudioContext;
    const { playTimeUpAlarm } = await import("./sound.js");
    expect(() => playTimeUpAlarm()).not.toThrow();
    window.AudioContext = original;
  });

  it("يشغّل النغمة عبر AudioContext عند توفره بلا رمي استثناء", async () => {
    window.AudioContext = FakeAudioContext;
    const { playTimeUpAlarm } = await import("./sound.js");
    expect(() => playTimeUpAlarm()).not.toThrow();
  });

  it("يستأنف السياق إن كان معلَّقاً قبل التشغيل", async () => {
    window.AudioContext = FakeAudioContext;
    const { playTimeUpAlarm } = await import("./sound.js");
    playTimeUpAlarm(); // ينشئ السياق
    expect(() => playTimeUpAlarm()).not.toThrow();
  });
});
