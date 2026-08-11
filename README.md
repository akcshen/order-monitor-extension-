# 订单监控助手

多平台新订单监控 Chrome 扩展（Manifest V3）。在订单列表页挂钩 `fetch` / `XMLHttpRequest` 读取接口 JSON，或通过 DOM 规则兜底解析；发现新订单后通过 [Resend](https://resend.com) HTTP API 发送邮件通知。

## 环境要求

- Node.js 22.13+（jsdom@30 要求 `^22.13.0 || >=24`）
- npm
- Chrome（Manifest V3）

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

构建产物位于 `dist/`，包含 `manifest.json`、popup 页面、background service worker 与 content script。

## 在 Chrome 中加载扩展

1. 打开 `chrome://extensions/`
2. 开启右上角「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择项目根目录下的 `dist/` 文件夹
5. 点击工具栏扩展图标：用户只需填**收件邮箱**并打开监控开关

## 内置监控规则（开发者）

规则写在包内，用户不能改。编辑：

`src/shared/builtin-platforms.js`

```js
{
  id: 'builtin-main',           // 稳定唯一，不要随便改
  name: '主订货后台',
  enabled: true,
  orderListUrl: 'https://真实后台/orders',   // 访问路径
  apiUrlIncludes: '/api/order/list',         // 接口地址片段
  orderIdPath: 'data.list[].orderNo',
  orderFields: [
    { label: '超市', path: 'shopName' },
    { label: '金额', path: 'amount' },
  ],
  refreshSeconds: 60,
}
```

把示例里的 `REPLACE_ME` 换成真实地址后执行 `npm run build`。未替换的条目**不会**同步进扩展（避免误监控）。

安装/启动扩展时会自动把内置规则同步到本地；若用户因登录失败被暂停，会保留其 `enabled` 状态。

## 发信配置（开发者）

发信凭证**不在 Popup 里填**，由你在构建前配置：

```bash
cp .env.example .env.local
# 编辑 .env.local：
#   VITE_RESEND_API_KEY=re_xxx
#   VITE_MAIL_FROM=noreply@your-domain.com
#   VITE_MAIL_FROM_NAME=订单监控助手
npm run build
```

1. 在 [Resend](https://resend.com) 验证发件域名并创建 API Key  
2. 写入 `.env.local`（已在 `.gitignore`，勿提交公开仓库）  
3. 重新 `npm run build` 后加载 `dist`  

## 用户侧设置

在 Popup「设置」中只需：

- **监控开关**
- **收件邮箱**

然后「保存」→「发送测试邮件」。监控状态区只读展示内置规则；若因登录页暂停，登录成功后会**自动恢复**，也可手动点「恢复」。

> **安全提醒：** API Key 会打进扩展包，解包仍可能被取出。仅分发给可信使用方；泄露后请立即在 Resend 撤销 Key。

配置真实 `orderListUrl` 后，构建会把 content script 收窄到对应域名（不再默认监听全网）。

## 配置示例（联调）

本地可用 `npx serve .` 起静态服务，并准备 `demo/orders.html` + JSON。开发者在 `builtin-platforms.js` 写入对应访问路径与接口片段后打包即可，**无需**在 Popup 里再配规则。

**DOM 兜底**：在内置规则里填 `rowSelector` / `orderIdSelector` 等字段（见 `builtin-platforms.js` 选填项）。

## 首次运行与基线

平台**第一次**采集到订单时，扩展只会把当前所有 `orderId` 写入本地 `seenOrders` 并标记 `baselineReady = true`，**不会对历史订单发信**。之后只有不在 seen 中的新 `orderId` 才会触发邮件。

如需重新建立基线（例如规则改错后重测），可在 `chrome://extensions` → 该扩展 → 「Service Worker」→ Application / Storage 中清除 `seenOrders` 对应平台条目，或删除后重新添加平台。

## 权限说明

扩展申请以下 Chrome 权限（见 `vite.config.js` manifest）：

| 权限 | 用途 |
|------|------|
| `storage` | 保存设置、平台规则、已见订单、邮件日志 |
| `alarms` | 按平台间隔定时刷新订单列表页 |
| `tabs` | 查找 / 刷新 / 打开订单列表标签页 |
| `notifications` | 发信失败、未登录等桌面通知 |
| `scripting` | 向匹配页面注入网络钩子脚本 |
| `host_permissions: http(s)://*/*` | 在配置的订单站点运行 content script 与钩子 |

Manifest 中 content script 声明为 `http(s)://*/*`（便于多平台配置），但**仅当当前页 href 命中某启用平台的 `matchUrls` 时**才会注入 MAIN 世界网络钩子并改写 `fetch` / `XHR`；未匹配页面不会挂钩。钩子优先以 inline `textContent` 同步安装；若被页面 CSP 拦截则回退 `script.src`（需 `web_accessible_resources`）。

## 刷新间隔与 Chrome Alarm 限制

Popup 中「刷新间隔」最小可填 **15 秒**，但 Chrome MV3 的 `chrome.alarms` 对 `periodInMinutes` 有系统限制（通常 **最短约 30 秒～1 分钟**，因 Chrome 版本而异）。扩展会将间隔 clamp 到 ≥0.25 分钟；若你设置 15 秒，实际 alarm 触发频率仍受浏览器限制。

已打开的订单页若站点自身有轮询请求，网络钩子仍可实时捕获新单，alarm 主要作为「无标签时打开页面 / 保底刷新」机制。

## 测试

```bash
npm test
```

单元测试覆盖 JSON Path、订单去重、DOM 解析、邮件正文、URL 匹配等纯逻辑。

## 项目结构

```
├── index.html              # Popup 入口
├── vite.config.js          # Vite + CRXJS 配置（含 manifest）
├── vitest.config.js        # Vitest 配置
├── public/icons/           # 扩展图标
└── src/
    ├── popup/              # Popup Vue 应用（设置 / 平台 CRUD / 日志）
    ├── background/         # Service Worker（alarms、发信、去重）
    ├── content/            # Content Script + DOM 解析
    ├── injected/           # 页面世界 fetch/XHR 钩子
    └── shared/             # storage、邮件、JSON Path 等共享模块
```

## 手工端到端检查清单

以下步骤需操作者在有 Resend 账号与本机 Chrome 的环境下验证（CI 通常无真实 API Key）。

| # | 步骤 | 预期 | 状态 |
|---|------|------|------|
| 1 | 配置 Resend API Key、发件/收件邮箱并保存；点击「发送测试邮件」 | 收件箱收到测试信；Popup 邮件日志显示成功 | ☐ 操作者验证 |
| 2 | 配置 Demo 平台规则，打开 `demo/orders.html`，等待首次采集 | 不发历史单邮件；seen 基线建立（可开 SW DevTools 查看 storage） | ☐ 操作者验证 |
| 3 | 在 demo JSON 中新增一个 `orderNo`，刷新页面 | 指定邮箱收到含新订单字段的邮件；角标/通知（若启用） | ☐ 操作者验证 |
| 4 | 编辑平台：清空「API URL 包含」「订单号路径」，仅保留 DOM 选择器；页面改为表格 DOM | 刷新后仍能检出新订单行并上报 | ☐ 操作者验证 |
| 5 | 关闭订单列表标签；`autoOpenOrderListTab` 为开 → 等待 alarm | 自动重新打开 `orderListUrl` 标签 | ☐ 操作者验证 |
| 5b | 同上，但关闭「自动打开订单列表」 | 不自动开新标签，仅在有已打开标签时刷新 | ☐ 操作者验证 |

## 相关文档

- 设计规格：`docs/superpowers/specs/2026-08-10-order-monitor-extension-design.md`
- 实现计划：`docs/superpowers/plans/2026-08-10-order-monitor-extension.md`
