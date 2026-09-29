import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

// GitHub Pages serves the site from /<repo>/; relative base keeps the build portable.
export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    // three.js accounts for most of the bundle; one chunk keeps loading simple.
    chunkSizeWarningLimit: 900,
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.js'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.js'],
      exclude: ['src/ui/**', 'src/main.js'],
      reporter: ['text', 'json-summary', 'html'],
    },
  },
});
