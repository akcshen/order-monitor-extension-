# 订单监控助手

多平台新订单监控 Chrome 扩展（Manifest V3）。当前为脚手架阶段，包含 popup、background service worker 与 content script 空壳。

## 环境要求

- Node.js 18+
- npm

## 安装

```bash
npm install
```

## 开发

```bash
npm run dev
```

Vite 开发服务器启动后，在 Chrome 中加载 `dist/` 目录（CRXJS 会在 dev 模式下写入构建产物）。

## 构建

```bash
npm run build
```

构建产物位于 `dist/`，包含 `manifest.json`、popup 页面及扩展脚本。

## 在 Chrome 中加载扩展

1. 打开 `chrome://extensions/`
2. 开启右上角「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择项目根目录下的 `dist/` 文件夹
5. 点击工具栏扩展图标，应看到 popup 显示「订单监控助手 · 脚手架就绪」

## 测试

```bash
npm run test
```

## 项目结构

```
├── index.html              # Popup 入口
├── vite.config.js          # Vite + CRXJS 配置（含 manifest）
├── vitest.config.js        # Vitest 配置
├── public/icons/           # 扩展图标
└── src/
    ├── popup/              # Popup Vue 应用
    ├── background/         # Service Worker
    ├── content/            # Content Script
    └── injected/           # 页面注入脚本（预留）
```
