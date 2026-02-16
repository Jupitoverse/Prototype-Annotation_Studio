import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/auth': 'http://127.0.0.1:8000',
      '/users': 'http://127.0.0.1:8000',
      '/workspaces': 'http://127.0.0.1:8000',
      '/projects': 'http://127.0.0.1:8000',
      '/activities': 'http://127.0.0.1:8000',
      '/batches': 'http://127.0.0.1:8000',
      '/tasks': 'http://127.0.0.1:8000',
      '/insight': 'http://127.0.0.1:8000',
      '/queue': 'http://127.0.0.1:8000',
      '/requests': 'http://127.0.0.1:8000',
      '/db': 'http://127.0.0.1:8000',
      '/docs': 'http://127.0.0.1:8000',
      '/openapi.json': 'http://127.0.0.1:8000',
    },
  },
})
