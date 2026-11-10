import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Built into ../react with relative URLs, so the check page can load it from any folder.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: { outDir: '../react', emptyOutDir: true },
});
