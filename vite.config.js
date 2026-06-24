import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function pwaAssetManifest() {
  return {
    name: 'pwa-asset-manifest',
    generateBundle(_options, bundle) {
      const assets = Object.values(bundle)
        .map((item) => item.fileName)
        .filter((fileName) => /\.(css|js|html|png|webmanifest|json)$/.test(fileName))
        .sort()

      this.emitFile({
        type: 'asset',
        fileName: 'pwa-assets.json',
        source: JSON.stringify({ assets }, null, 2),
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const isGitHubPages = mode === 'github-pages'

  return {
    base: isGitHubPages ? '/dodgeball-match-recorder/' : '/',
    plugins: [react(), pwaAssetManifest()],
  }
})
