import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' keeps asset paths relative so the built tool can be dropped into
// any host page (e.g. an iframe or a subfolder under project-business.org).
export default defineConfig({
  base: './',
  plugins: [react()],
});
