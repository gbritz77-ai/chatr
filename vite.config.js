// C:\Dev\Chatr\vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  // ✅ Root points to frontend (not frontend/src)
  root: path.resolve(__dirname, "frontend"),

  // ✅ Output compiled files to frontend/dist
  build: {
    outDir: path.resolve(__dirname, "frontend/dist"),
    emptyOutDir: true,
    chunkSizeWarningLimit: 1500,
  },

  plugins: [react()],

  optimizeDeps: {
    include: ["@emoji-mart/react", "@emoji-mart/data"],
  },

  server: {
    port: 5173,
    open: true,
  },

  // ✅ Ensures all assets resolve correctly on Amplify/S3
  base: "./",

  // ✅ Optional aliases for cleaner imports
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "frontend/src"),
    },
  },
});
