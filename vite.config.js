import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { crx, defineManifest } from '@crxjs/vite-plugin'
import { BUILTIN_PLATFORMS } from './src/shared/builtin-platforms.js'
import { collectChromeMatchPatterns } from './src/shared/builtin-platform-utils.js'

const builtinMatches = collectChromeMatchPatterns(BUILTIN_PLATFORMS)
// 未配置真实 URL 时仍用全站匹配，方便开发；配置后自动收窄到目标域名
const pageMatches =
  builtinMatches.length > 0 ? builtinMatches : ['http://*/*', 'https://*/*']

const manifest = defineManifest({
  manifest_version: 3,
  name: '订单监控助手',
  version: '0.1.1',
  description: '多平台新订单监控并邮件通知',
  action: {
    default_popup: 'index.html',
    default_title: '订单监控助手',
  },
  background: {
    service_worker: 'src/background/service-worker.js',
    type: 'module',
  },
  permissions: ['storage', 'alarms', 'tabs', 'notifications', 'scripting'],
  host_permissions: pageMatches,
  content_scripts: [
    {
      matches: pageMatches,
      js: ['src/content/main.js'],
      run_at: 'document_start',
    },
  ],
  web_accessible_resources: [
    {
      resources: ['src/injected/network-hook.js'],
      matches: pageMatches,
    },
  ],
  icons: {
    128: 'public/icons/icon128.png',
  },
})

export default defineConfig({
  plugins: [vue(), crx({ manifest })],
  build: {
    rollupOptions: {
      input: {
        popup: 'index.html',
      },
    },
  },
})
