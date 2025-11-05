// C:\Dev\Chatr\vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  // ✅ Correct root folder
  root: "frontend/src",

  // ✅ Output build to frontend/dist (keeps structure clean)
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

  // ✅ Ensures Amplify/S3 can load relative assets
  base: "./",
});
