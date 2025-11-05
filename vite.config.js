// C:\Dev\Chatr\vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // 💡 Point root to the folder containing index.html
  root: 'src', 

  plugins: [react()],
  server: {
    port: 5173,
    open: true,
  },
});