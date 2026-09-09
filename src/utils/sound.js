/* =========================================================================
   تنبيه صوتي عند انتهاء وقت حجز مدفوع مقدماً — نغمة مُولَّدة عبر Web Audio API
   بلا أي ملف صوت خارجي: تعمل دون إنترنت (يهم في PWA) ولا تحتاج تحميل أصل إضافي.

   المتصفحات تمنع تشغيل صوت قبل أول تفاعل حقيقي من المستخدم (سياسة التشغيل
   التلقائي) — لذا نُنشئ AudioContext ونُحرِّره عند أول نقرة/ضغطة في الصفحة،
   لا عند أول محاولة تشغيل فعلية التي قد تكون بلا تفاعل سابق مباشر (مؤقّت).
   ========================================================================= */

let ctx = null;
function getCtx() {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!ctx) { try { ctx = new AC(); } catch { return null; } }
  return ctx;
}

let unlocked = false;
function unlock() {
  if (unlocked) return;
  unlocked = true;
  const c = getCtx();
  if (c && c.state === "suspended") c.resume().catch(() => {});
}
if (typeof document !== "undefined") {
  ["pointerdown", "keydown"].forEach(ev => document.addEventListener(ev, unlock, { once: true, passive: true }));
}

// ثلاث نبضات صاعدة النبرة — مسموعة وواضحة بلا إزعاج صاخب، ولا تعتمد على ملف
// خارجي فتفشل بصمت لو حُظر الصوت أو تعذّر إنشاء AudioContext
export function playTimeUpAlarm() {
  const c = getCtx();
  if (!c) return;
  try {
    if (c.state === "suspended") c.resume().catch(() => {});
    const beep = (freq, start, dur) => {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, c.currentTime + start);
      gain.gain.linearRampToValueAtTime(0.25, c.currentTime + start + 0.02);
      gain.gain.linearRampToValueAtTime(0, c.currentTime + start + dur);
      osc.connect(gain); gain.connect(c.destination);
      osc.start(c.currentTime + start);
      osc.stop(c.currentTime + start + dur + 0.02);
    };
    beep(880, 0, 0.15);
    beep(880, 0.22, 0.15);
    beep(1046.5, 0.44, 0.25);
  } catch { /* صوت تحسيني لا وظيفي — فشله لا يجب أن يكسر شيئاً */ }
}
