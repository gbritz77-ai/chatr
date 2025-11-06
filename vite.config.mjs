import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "frontend", // 👈 points Vite to your React app folder
  plugins: [react()],
  base: "./", // ✅ ensures relative asset paths (works with Amplify hosting)
  build: {
    outDir: "../dist", // 👈 outputs final build to /dist at root level
    emptyOutDir: true,
    assetsDir: "assets", // optional but helps organize CSS/JS
  },
  resolve: {
    alias: {
      "@": "/frontend/src", // 👈 allows '@' imports for cleaner paths
    },
  },
  server: {
    port: 5173, // ✅ ensures local dev consistency
    open: true,
  },
});
