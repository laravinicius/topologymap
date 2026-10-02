import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cpSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Recursos locais de fontes/CMaps/WASM: nenhuma dependência de CDN na prévia.
const pdfRoot = dirname(createRequire(import.meta.url).resolve('pdfjs-dist/package.json'));
const pdfPublic = fileURLToPath(new URL('./public/pdfjs/',import.meta.url));
for (const directory of ['cmaps','standard_fonts','wasm']) {
  mkdirSync(join(pdfPublic,directory),{recursive:true});
  cpSync(join(pdfRoot,directory),join(pdfPublic,directory),{recursive:true});
}

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    watch: { usePolling: true, interval: 300 },
    proxy: {
      '/api': {
        target: process.env.API_PROXY_TARGET ?? 'http://api:3001',
        changeOrigin: true,
      },
    },
  },
});
