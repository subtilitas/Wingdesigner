import { defineConfig } from 'vite';

// GitHub Pages serves the site from /<repo>/; relative base keeps the build portable.
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    sourcemap: true,
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
