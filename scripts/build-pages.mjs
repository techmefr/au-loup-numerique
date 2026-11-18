import { build } from 'esbuild';
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist/vendor/three', { recursive: true });
mkdirSync('dist/vendor/font', { recursive: true });
cpSync('web', 'dist', { recursive: true });
for (const f of ['three.module.js', 'three.core.js']) cpSync(`node_modules/three/build/${f}`, `dist/vendor/three/${f}`);
for (const f of ['pixelify-sans-latin-400-normal.woff2', 'pixelify-sans-latin-700-normal.woff2']) cpSync(`node_modules/@fontsource/pixelify-sans/files/${f}`, `dist/vendor/font/${f}`);
await build({ entryPoints: ['src/local/localSocket.ts'], bundle: true, format: 'esm', minify: true, target: 'es2022', outfile: 'dist/local.js' });
writeFileSync('dist/.nojekyll', '');
writeFileSync('dist/404.html', '<meta http-equiv="refresh" content="0;url=./">');
console.log('dist prêt');
