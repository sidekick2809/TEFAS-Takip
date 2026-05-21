import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'https://www.tefas.gov.tr',
        changeOrigin: true,
      },
      '/api/fvt/distribution': {
        target: 'https://fvt.com.tr',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/fvt\/distribution\/([^/]+)/, '/api/funds/$1/distribution')
      }
    }
  }
});
