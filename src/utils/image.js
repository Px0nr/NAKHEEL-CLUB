/* =========================================================================
   ضغط صور المنتجات قبل تخزينها.

   السبب ليس تجميلياً: الصور تُخزَّن كـ data URL بصيغة base64 داخل سجلّ المنتج
   نفسه، أي داخل مخزن البيانات المحلي المحدود (~5MB). وأكبر مقاس تُعرض به صورة
   المنتج في النظام كله هو 46×46 بكسل (بطاقة نقطة البيع)، فتخزين صورة بحجم
   مئات الكيلوبايتات يستهلك الحصة بلا أي فائدة بصرية — عشر صور قد تملأ المخزن
   وتُفشل حفظ الفواتير بعدها.
   ========================================================================= */

// 256 بكسل: أكبر من ضعف أكبر مقاس عرض (46) حتى على الشاشات عالية الكثافة،
// ويبقى الملف الناتج بعشرات الكيلوبايتات لا مئاتها
export const MAX_IMAGE_DIM = 256;
export const IMAGE_QUALITY = 0.72;

/* حساب المقاس بعد التصغير مع الحفاظ على نسبة الأبعاد.
   دالة نقية مفصولة عن الرسم كي تكون قابلة للاختبار بلا DOM. */
export function fitWithin(width, height, maxDim = MAX_IMAGE_DIM) {
  if (!width || !height) return { width: 0, height: 0 };
  if (width <= maxDim && height <= maxDim) return { width: Math.round(width), height: Math.round(height) };
  const scale = maxDim / Math.max(width, height);
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

// حجم data URL بالبايت تقريباً (طول جزء base64 × 3/4)
export function dataUrlBytes(dataUrl) {
  if (typeof dataUrl !== "string") return 0;
  const i = dataUrl.indexOf(",");
  if (i === -1) return 0;
  const b64 = dataUrl.slice(i + 1);
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((b64.length * 3) / 4) - padding);
}

/* تصغير ملف صورة وإرجاعه data URL بصيغة JPEG.
   يُرفض الملف غير الصوري صراحةً بدل تمريره كما هو. */
export function compressImageFile(file, { maxDim = MAX_IMAGE_DIM, quality = IMAGE_QUALITY } = {}) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type?.startsWith("image/")) { reject(new Error("الملف ليس صورة")); return; }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("تعذّرت قراءة الملف"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("تعذّر فتح الصورة"));
      img.onload = () => {
        try {
          const { width, height } = fitWithin(img.naturalWidth, img.naturalHeight, maxDim);
          const canvas = document.createElement("canvas");
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext("2d");
          // خلفية بيضاء: JPEG لا يدعم الشفافية، وبدونها تصبح المناطق الشفافة سوداء
          ctx.fillStyle = "#fff";
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", quality));
        } catch (e) { reject(e); }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
