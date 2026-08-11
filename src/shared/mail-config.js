/**
 * 发信凭证（仅开发者 / 构建时配置）。
 * 优先读 Vite 环境变量（项目根目录 `.env` / `.env.local`），勿把真实 Key 提交公开仓库。
 *
 * .env 示例：
 *   VITE_RESEND_API_KEY=re_xxx
 *   VITE_MAIL_FROM=noreply@your-domain.com
 *   VITE_MAIL_FROM_NAME=订单监控助手
 */
export const MAIL_SENDER = {
  resendApiKey: import.meta.env.VITE_RESEND_API_KEY || '',
  fromEmail: import.meta.env.VITE_MAIL_FROM || '',
  fromName: import.meta.env.VITE_MAIL_FROM_NAME || '订单监控助手',
}

export function getMailSender() {
  return { ...MAIL_SENDER }
}

export function isMailSenderConfigured() {
  return Boolean(MAIL_SENDER.resendApiKey && MAIL_SENDER.fromEmail)
}
