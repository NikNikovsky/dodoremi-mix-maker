import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

function onWarn(warning, handler) {
  // ignore a11y warnings during development to avoid failing the dev server
  if (warning && typeof warning.code === 'string' && (warning.code.startsWith('a11y-') || warning.code === 'css-unused-selector')) return;
  if (warning && typeof warning.message === 'string' && warning.message.includes('Unused CSS selector')) return;
  handler(warning);
}

export default defineConfig({
  plugins: [svelte({ onwarn: onWarn })],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  build: {
    outDir: 'docs',
  },
})
