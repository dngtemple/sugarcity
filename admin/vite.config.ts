import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5181, strictPort: true },
  preview: { port: 5181, strictPort: true },
  build: {
    rollupOptions: {
      output: {
        // Framework code changes rarely: its own chunk stays cached across deploys.
        manualChunks: (id) => {
          const path = id.split('\\').join('/');
          if (!path.includes('/node_modules/')) return undefined;
          if (/\/node_modules\/(react|react-dom|scheduler|react-router|react-router-dom)\//.test(path)) return 'framework';
          if (path.includes('/node_modules/@radix-ui/')) return 'radix';
          return undefined;
        },
      },
    },
  },
});
