import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { crx } from '@crxjs/vite-plugin'
import { defineManifest } from '@crxjs/vite-plugin'

const manifest = defineManifest({
  manifest_version: 3,
  name: '订单监控助手',
  version: '0.1.0',
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
  host_permissions: ['http://*/*', 'https://*/*'],
  content_scripts: [
    {
      matches: ['http://*/*', 'https://*/*'],
      js: ['src/content/main.js'],
      run_at: 'document_start',
    },
  ],
  web_accessible_resources: [
    {
      resources: ['src/injected/network-hook.js'],
      matches: ['http://*/*', 'https://*/*'],
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
