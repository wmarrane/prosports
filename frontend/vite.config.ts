import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync, copyFileSync, existsSync } from 'fs'
import { execSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function getVersion(): string {
  const pkgPath = path.resolve(__dirname, '../package.json')
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
  return pkg.version
}

function getCommit(): string {
  if (process.env.APP_COMMIT && process.env.APP_COMMIT !== 'unknown') {
    return process.env.APP_COMMIT
  }
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    return process.env.APP_COMMIT ?? 'unknown'
  }
}

function copyChangelog() {
  return {
    name: 'copy-changelog',
    buildStart() {
      const src = path.resolve(__dirname, '../CHANGELOG.md')
      const dst = path.resolve(__dirname, 'public/CHANGELOG.md')
      if (existsSync(src)) copyFileSync(src, dst)
    },
  }
}

export default defineConfig({
  plugins: [tailwindcss(), react(), copyChangelog()],
  define: {
    __APP_VERSION__: JSON.stringify(getVersion()),
    __APP_COMMIT__: JSON.stringify(getCommit()),
    __APP_BUILT_AT__: JSON.stringify(new Date().toISOString()),
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://192.168.56.113:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/uploads': {
        target: 'http://192.168.56.113:3000',
        changeOrigin: true,
      },
    },
  },
})
