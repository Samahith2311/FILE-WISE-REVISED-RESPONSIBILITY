import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // seed.json (about 200 kB) is bundled into the main chunk until Supabase serves the data.
  build: { chunkSizeWarningLimit: 800 },
})
