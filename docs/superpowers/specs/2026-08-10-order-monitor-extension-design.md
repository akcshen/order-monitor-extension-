# 多平台订单监控 Chrome 扩展 — 设计文档

**日期：** 2026-08-10  
**状态：** 已实现（执行计划见 `docs/superpowers/plans/2026-08-10-order-monitor-extension.md`）  
**项目目录：** `BrowserPlugins/order-monitor-extension/`（独立子目录实现，不写在仓库根目录）

## 1. 背景与目标

供货商在多个第三方 B2B/订货平台接收超市订单，需要及时把新订单信息发给厂房侧邮箱。平台尚未最终确定，因此做成**可配置、多平台共用**的 Chrome 扩展。

**一期目标：**

- 电脑与浏览器常开、后台保持登录的前提下，定时刷新订单相关页
- 优先通过挂钩页面 `fetch` / `XMLHttpRequest` 获取订单接口响应；无合适接口时用 DOM 解析兜底
- 发现新订单后，通过 Resend HTTP API 发送真实邮件到指定邮箱
- 不自建后端、不直连 SMTP

**明确不做（一期）：**

- 关电脑后的云端离线监控
- 插件内直连 SMTP
- 可视化「点选录制」生成选择器
- 针对单一平台写死适配逻辑
- WebSocket / 加密私有协议平台

## 2. 约束

| 约束 | 选择 |
|------|------|
| 运行环境 | 常开电脑 + Chrome，Manifest V3 |
| 邮件 | Resend API（HTTPS）；SMTP 仅可作为二期中转 |
| 多平台 | 规则配置驱动，非硬编码平台名 |
| 代码位置 | 全部实现位于 `order-monitor-extension/` |

## 3. 架构

```
Content Script                Service Worker                 Resend
· 注入 page 世界钩子          · alarms 定时刷新标签页         · 发信
· 钩 fetch + XHR              · seenOrderIds 去重
· DOM 兜底解析                · 发信 / 重试 / 角标
· 上报候选订单       ◄──────► · 读写 chrome.storage
                                      ▲
                                      │
                               Popup (Vue3 + Element Plus)
                               · 全局邮件配置
                               · 平台规则 CRUD
                               · 启停 / 测试发信 / 日志
```

### 3.1 职责

- **Popup / Options：** 配置与状态展示
- **Content Script：** 在 `matchUrls` 匹配的页面中采集订单
- **Injected page script：** 在页面 JS 环境挂钩网络请求，克隆响应并解析 JSON
- **Service Worker：** 调度、去重、发信、通知、维护已见订单

### 3.2 为何能读到接口返回值

不使用 `webRequest` 读响应体（MV3 下不可用）。改为在**页面上下文**包装 `window.fetch` 与 `XMLHttpRequest`，对响应 `clone()` 后解析 JSON，再经桥接发给扩展。定时刷新是为了触发页面再次请求列表接口。

若页面既非 fetch 也非 XHR（极少），或整页服务端渲染，则走 DOM 规则。

## 4. 数据模型

### 4.1 全局配置 `settings`

```ts
{
  enabled: boolean
  resendApiKey: string
  toEmail: string
  fromEmail: string        // Resend 已验证发件域
  fromName: string
  mergeNewOrdersInOneEmail: boolean  // 默认 true
}
```

### 4.2 平台规则 `platforms[]`

```ts
{
  id: string
  name: string
  enabled: boolean
  matchUrls: string[]           // content_scripts / 动态注册匹配
  orderListUrl: string          // 定时打开/刷新的列表页
  refreshSeconds: number        // 默认 60，最小 15
  // 接口模式（优先）
  apiUrlIncludes: string        // URL 需包含的关键词
  orderIdPath: string           // 如 data.list[].orderNo
  orderFields: { label: string, path: string }[]
  // DOM 模式（兜底）
  rowSelector: string
  orderIdSelector: string       // 相对 row
  fieldSelectors: { label: string, selector: string }[]
  // 运行态提示用（可选）
  loginUrlIncludes?: string     // 检测到则视为未登录
}
```

### 4.3 已见订单 `seenOrders`

```ts
{
  [platformId: string]: {
    ids: string[]               // 最近最多 5000
    baselineReady: boolean      // false 时只建基线不发信
  }
}
```

### 4.4 发信日志 `mailLogs`（最近 100 条）

记录时间、平台、订单号列表、成功/失败、错误信息。

## 5. 核心流程

### 5.1 采集

1. 页面加载后注入钩子；同时按 DOM 规则尝试解析（若已配置）
2. 钩子命中 `apiUrlIncludes` 时，用 `orderIdPath` / `orderFields` 抽取订单数组
3. 若本轮接口未产出有效 `orderId`，且配置了 DOM 选择器，则用 DOM 结果
4. 将 `{ platformId, orders[] }` 发给 Service Worker

### 5.2 新订单判定

1. 若该平台 `baselineReady === false`：把当前全部 `orderId` 写入 seen，置 `baselineReady = true`，**不发信**
2. 否则：`orderId` 不在 seen 中的为新单；写入 seen；进入发信
3. `mergeNewOrdersInOneEmail === true` 时同一批合并一封邮件

### 5.3 定时刷新

- `chrome.alarms` 按平台 `refreshSeconds` 触发
- 查找已打开且匹配 `orderListUrl`（或同 origin 订单页）的 tab → `tabs.reload`
- 若无 tab：默认打开 `orderListUrl` 新标签（可配置关闭）
- 检测到登录页：暂停该平台发信并 `notifications` 提醒

### 5.4 发信

- `POST https://api.resend.com/emails`
- 主题：`【新订单】{平台名} · {N} 单 · {本地时间}`
- 正文：文本 + 简单 HTML 表（字段来自规则映射）
- 失败重试 2 次；仍失败则桌面通知，订单进入「待补发」队列（Popup 可手动重试）

## 6. UI（Popup）

- 总开关、Resend Key、收/发件邮箱、测试发信
- 平台列表：启停、编辑规则、刷新间隔
- 状态：各平台「监控页是否打开 / 上次采集时间 / 今日新单」
- 最近邮件日志

一期配置以表单手填为主，不做点选录制器。

## 7. 错误处理

| 情况 | 行为 |
|------|------|
| Resend 失败 | 重试 2 次 → 通知 + 待补发 |
| 路径/选择器无效 | 不发信；Popup 提示规则可能有误；写调试日志 |
| 未登录 | 暂停该平台；通知重新登录 |
| seen 过大 | 每平台保留最近 5000 个 id |
| API Key 为空 | 禁止发信并提示 |

## 8. 技术选型

- Manifest V3
- Vue 3 + Vite + Element Plus（Popup）
- `@crxjs/vite-plugin`（或等价成熟 CRX + Vite 方案）
- `chrome.storage.local` / `alarms` / `tabs` / `notifications` / `scripting`
- 邮件：Resend

## 9. 目录约定

```
BrowserPlugins/
  order-monitor-extension/          ← 插件工程根目录
    docs/superpowers/specs/         ← 本设计文档
    package.json
    src/
      background/
      content/
      injected/                     ← page 世界钩子
      popup/
      shared/
    manifest.config / public
```

仓库根目录 `BrowserPlugins/` 不直接放置插件源码。

## 10. 成功标准

1. 配置一条模拟规则后，页面触发匹配的 fetch/XHR JSON 能被解析并去重
2. 首次开启只建基线，不把历史单发到邮箱
3. 人为制造「新 orderId」后，指定邮箱收到一封含订单字段的邮件
4. 关闭接口规则、仅配 DOM 时，刷新页面仍能检出新行
5. 监控标签关闭后，按配置能自动重新打开列表页（或明确提示）

## 11. 二期候选

- 公司 SMTP 中转服务替换 Resend
- 规则录制助手（自动猜测接口与字段）
- WebSocket 平台适配
- 云端常驻监控（不依赖本地电脑）
