import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import path from 'path';

function mobileLogger() {
  return {
    name: 'mobile-logger',

    configureServer(server) {
      server.middlewares.use('/mobile-log', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }

        let body = '';

        req.on('data', (chunk) => {
          body += chunk;
        });

        req.on('end', () => {
          try {
            const log = JSON.parse(body);

            console.log(
              `[MOBILE ${log.level || 'LOG'}]`,
              log.message,
              log.data || ''
            );
          } catch {
            console.log('[MOBILE LOG]', body);
          }

          res.statusCode = 204;
          res.end();
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    basicSsl(),
    mobileLogger(),
  ],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  server: {
    host: true,
    https: true,
  },
});