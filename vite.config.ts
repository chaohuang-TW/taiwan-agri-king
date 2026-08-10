import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  base: '/taiwan-agri-king/',
  build: {
    rollupOptions: {
      input: {
        index: fileURLToPath(new URL('./index.html', import.meta.url)),
        game: fileURLToPath(new URL('./game.html', import.meta.url)),
        engineTest: fileURLToPath(new URL('./engine-test.html', import.meta.url)),
      },
    },
  },
});
