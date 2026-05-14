import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/gas': {
        target: 'https://script.google.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/gas/, '/macros/s/AKfycbwD69kUTjegbEtKlOguodFWr6d6ZA7iRwvwGe3UuOwUz4kr-vVxSnpDOm537G1x7_li/exec'),
        followRedirects: true,
        secure: false,
      }
    }
  }
})
