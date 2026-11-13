import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  // Puerto fijo: si 5173 está ocupado, falla en vez de saltar a 5174 (CORS lo bloquearía)
  server: { port: 5173, strictPort: true },
})
