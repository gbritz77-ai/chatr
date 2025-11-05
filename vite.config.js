// C:\Dev\Chatr\vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  // 💡 Entry folder containing index.html
  root: "src",

  // 📦 Output build to "src/dist" (matches your deploy-frontend script)
  build: {
    outDir: path.resolve(__dirname, "src/dist"),
    emptyOutDir: true,
    rollupOptions: {
      // Avoid Rollup import resolution errors (emoji-mart, etc.)
      external: [],
    },
  },

  plugins: [react()],

  // ⚙️ Ensure emoji-mart and React deps are pre-bundled properly
  optimizeDeps: {
    include: ["@emoji-mart/react", "@emoji-mart/data"],
  },

  // 🧩 Dev server options
  server: {
    port: 5173,
    open: true,
  },

  // 🌍 Handle relative paths correctly in Amplify builds
  base: "./",
});
