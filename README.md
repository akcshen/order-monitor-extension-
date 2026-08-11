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
5. 点击工具栏扩展图标，打开 Popup 配置邮件与平台规则

## Resend 邮件配置

1. 在 [Resend](https://resend.com) 注册账号
2. **验证发件域名**：Dashboard → Domains → 添加域名并完成 DNS 验证
3. **创建 API Key**：Dashboard → API Keys → Create API Key（权限选「Sending access」即可）
4. 在 Popup「邮件与总设置」中填写：
   - **Resend API Key**：`re_xxx`（见下方安全提醒）
   - **收件邮箱**：厂房侧接收新订单通知的地址
   - **发件邮箱**：已验证域名下的地址，如 `noreply@your-domain.com`
   - **发件人名称**：邮件显示名称，默认「订单监控助手」
5. 点击「保存设置」，再点「发送测试邮件」确认配置正确

> **安全提醒：** API Key 等同于发信凭证，仅保存在本机 `chrome.storage.local` 中，**切勿分享、提交到 Git 或截图外传**。泄露后请立即在 Resend 控制台撤销并重新创建。

## 配置平台规则示例

以下示例用于本地联调：用 `npx serve .` 在项目根目录起一个静态服务（如 `http://127.0.0.1:3000`），并创建测试页 `demo/orders.html`，页面内用 `fetch` 返回 JSON：

```html
<!-- demo/orders.html 示例 -->
<script>
fetch('/api/orders.json').then(r => r.json())
</script>
```

```json
// demo/api/orders.json
{
  "data": {
    "list": [
      { "orderNo": "ORD-001", "shopName": "测试超市", "amount": "128.00" }
    ]
  }
}
```

在 Popup「平台规则」中新增平台，参考配置：

| 字段 | 示例值 |
|------|--------|
| 名称 | 本地 Demo |
| 匹配 URL | `http://127.0.0.1:3000/*` |
| 订单列表 URL | `http://127.0.0.1:3000/demo/orders.html` |
| 刷新间隔（秒） | 60（UI 最小 15） |
| API URL 包含 | `/api/orders.json` |
| 订单号路径 | `data.list[].orderNo` |
| 订单字段 | `门店` → `data.list[].shopName`；`金额` → `data.list[].amount` |

**DOM 兜底模式**（关掉接口字段时）：配置「行选择器」「订单号选择器」及字段选择器，例如行 `.order-row`、订单号 `.order-id`，刷新页面后 content script 会解析 DOM 上报订单。

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

Content script 仅在你在 Popup 中配置的 **匹配 URL** 对应站点上运行，不会向未匹配站点注入脚本。

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
