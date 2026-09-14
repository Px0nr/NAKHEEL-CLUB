import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // "prompt" بدل "autoUpdate": لا يُعاد تحميل التطبيق تلقائياً بإصدار جديد أثناء عمل المستخدم —
      // التحديث يُطبَّق بأمان عند إغلاق وإعادة فتح النظام لاحقاً (لا مقاطعة لعملية بيع أو إغلاق خزينة جارية)
      registerType: "prompt",
      includeAssets: ["favicon.png", "icons/apple-touch-icon.png"],
      manifest: {
        name: "نادي النخيل — نظام الإدارة",
        short_name: "نادي النخيل",
        description: "نظام إدارة متكامل لنادي النخيل: نقطة بيع، حجوزات، مخزون، ومحاسبة",
        lang: "ar",
        dir: "rtl",
        start_url: "/",
        display: "standalone",
        background_color: "#0a2712",
        theme_color: "#1a5c2e",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // تخزين ملفات التطبيق الثابتة فقط للعمل دون إنترنت — لا صلة لهذا بطلبات Supabase
        // (نطاق مختلف تماماً، فلا يعترضها الـService Worker إطلاقاً)
        globPatterns: ["**/*.{js,css,html,woff,woff2,png,svg,ico}"],
      },
    }),
  ],
  server: {
    host: true,   // يتيح فتح النظام من الأجهزة اللوحية على نفس الشبكة
    port: 5173,
  },
});
