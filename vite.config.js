import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const root = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

/**
 * The bundled airfoil library (public/airfoils/index.json and its coordinate files) as the module
 * `virtual:airfoil-library`: the library then works without network requests, also when the page
 * is opened from a file, where the browser refuses fetch.
 */
function airfoilLibrary() {
  const id = 'virtual:airfoil-library';
  const dir = join(root, 'public', 'airfoils');
  return {
    name: 'wingdesigner-airfoil-library',
    resolveId: (source) => (source === id ? `\0${id}` : null),
    load(resolved) {
      if (resolved !== `\0${id}`) return null;
      const indexFile = join(dir, 'index.json');
      this.addWatchFile(indexFile);
      const index = JSON.parse(readFileSync(indexFile, 'utf8'));
      const files = {};
      for (const a of index.airfoils) {
        const file = join(dir, a.file);
        this.addWatchFile(file);
        files[a.file] = readFileSync(file, 'utf8');
      }
      return `export default ${JSON.stringify({ airfoils: index.airfoils, files })};`;
    },
  };
}

/**
 * Root folder of the npm package that contains `file`, or null outside node_modules. Vite writes
 * module ids with / on every platform, Node paths use \ on Windows: both separate.
 */
export function packageRoot(file) {
  const parts = file.split(/[\\/]/);
  const at = parts.lastIndexOf('node_modules');
  if (at < 0) return null;
  const depth = parts[at + 1]?.startsWith('@') ? 3 : 2;
  return parts.slice(0, at + depth).join('/');
}

/**
 * LICENSES.txt next to index.html: the license of this app, then the license text of every npm
 * package whose code the bundle contains (the MIT license asks for its notice in every copy, and
 * minification drops the notices in the code). A bundled package without a license file stops the
 * build.
 */
function licenses() {
  return {
    name: 'wingdesigner-licenses',
    apply: 'build',
    generateBundle(options, bundle) {
      const roots = new Set();
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== 'chunk') continue;
        for (const id of chunk.moduleIds ?? Object.keys(chunk.modules ?? {})) {
          const r = packageRoot(id.replace(/^\0/, '').split('?')[0]);
          if (r) roots.add(r);
        }
      }
      const parts = [`${pkg.name} ${pkg.version} (${pkg.license})\n\n${readFileSync(join(root, 'LICENSE'), 'utf8').trim()}`];
      for (const r of [...roots].sort()) {
        const meta = JSON.parse(readFileSync(join(r, 'package.json'), 'utf8'));
        const file = readdirSync(r).find((f) => /^(licen[cs]e|copying)(\.(md|txt))?$/i.test(f));
        if (!file) this.error(`The bundle contains ${meta.name} ${meta.version}, which has no license file.`);
        parts.push(`${meta.name} ${meta.version} (${meta.license})\n\n${readFileSync(join(r, file), 'utf8').trim()}`);
      }
      this.emitFile({ type: 'asset', fileName: 'LICENSES.txt', source: `${parts.join(`\n\n${'-'.repeat(72)}\n\n`)}\n` });
    },
  };
}

/**
 * The page loads the bundle as a classic deferred script without CORS mode, so it also runs when
 * opened from a file: Chromium refuses module scripts and CORS-mode stylesheets from file URLs.
 */
function classicScript() {
  return {
    name: 'wingdesigner-classic-script',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler: (html) => html.replace(/<script type="module" crossorigin/g, '<script defer').replace(/ crossorigin(?=[\s>])/g, ''),
    },
  };
}

// GitHub Pages serves the site from /<repo>/; relative base keeps the build portable.
export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [airfoilLibrary(), licenses(), classicScript()],
  build: {
    target: 'es2022',
    sourcemap: true,
    // One classic script (no module imports at run time): see classicScript.
    modulePreload: false,
    rollupOptions: { output: { format: 'iife' } },
    // three.js accounts for most of the bundle; one chunk keeps loading simple.
    chunkSizeWarningLimit: 900,
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.js'],
    // Timing limits live in the tests that measure them; the timeout only catches hangs. Under
    // coverage on a loaded 2-core runner, the heaviest tests take 4 to 10 s.
    testTimeout: 20000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.js'],
      exclude: ['src/ui/**', 'src/main.js'],
      reporter: ['text', 'json-summary', 'html'],
    },
  },
});
