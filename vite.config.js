import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,   // يتيح فتح النظام من الأجهزة اللوحية على نفس الشبكة
    port: 5173,
  },
});
