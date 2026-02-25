import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'https://www.tefas.gov.tr',
        changeOrigin: true,
      }
    }
  }
});
