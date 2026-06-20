import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const isGitHubPages = mode === 'github-pages'

  return {
    base: isGitHubPages ? '/dodgeball-match-recorder/' : '/',
    plugins: [react()],
  }
})
