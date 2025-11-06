// vite.config.mjs
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: "./frontend/src",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
});
