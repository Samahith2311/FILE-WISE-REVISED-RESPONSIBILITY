import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import vercel from './vercel.json'

/**
 * On Vercel (process.env.VERCEL is set) the build must be Supabase mode: local mode
 * and the mock accounts, whose passwords are in the source, must never be deployed.
 * Local builds are not checked, so local mode still builds on your computer.
 */
function checkVercelEnv(mode: string): void {
  if (!process.env.VERCEL) return
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ''
  const problems = [
    env.VITE_DATA_BACKEND !== 'supabase' && `VITE_DATA_BACKEND must be "supabase" (got "${env.VITE_DATA_BACKEND ?? ''}")`,
    !env.VITE_SUPABASE_URL && 'VITE_SUPABASE_URL is missing',
    !key && 'VITE_SUPABASE_PUBLISHABLE_KEY is missing',
    (key.startsWith('sb_secret_') || Buffer.from(key.split('.')[1] ?? '', 'base64url').toString().includes('"service_role"')) &&
      'VITE_SUPABASE_PUBLISHABLE_KEY is a secret (service role) key; use the publishable key',
  ].filter(Boolean)
  if (problems.length) {
    throw new Error(
      `Vercel build stopped:\n- ${problems.join('\n- ')}\n` +
        'Set them in Vercel under Project Settings, then Environment Variables, and redeploy.',
    )
  }
}

export default defineConfig(({ command, mode }) => {
  if (command === 'build') checkVercelEnv(mode)
  return {
    plugins: [react(), tailwindcss()],
    // seed.json (about 200 kB) is bundled into the main chunk until Supabase serves the data.
    build: { chunkSizeWarningLimit: 800 },
    // npm run preview sends the same security headers (CSP included) as Vercel.
    preview: { headers: Object.fromEntries(vercel.headers[0]!.headers.map((h) => [h.key, h.value])) },
  }
})
