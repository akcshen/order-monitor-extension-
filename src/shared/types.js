export const DEFAULT_SETTINGS = {
  enabled: true,
  /** 用户只需配置：接收新订单通知的邮箱 */
  toEmail: '',
  mergeNewOrdersInOneEmail: true,
  autoOpenOrderListTab: true,
}

/**
 * 一条监控配置。
 * 用户主要填：orderListUrl（访问路径）+ apiUrlIncludes（接口地址）。
 * matchUrls 由访问路径自动推导，一般无需手填。
 */
export function createEmptyPlatform() {
  return {
    id: crypto.randomUUID(),
    name: '',
    enabled: true,
    matchUrls: [],
    /** 访问路径：订单列表页 URL */
    orderListUrl: '',
    refreshSeconds: 60,
    /** 接口地址：订单接口 URL 需包含的片段 */
    apiUrlIncludes: '',
    orderIdPath: '',
    orderFields: [],
    rowSelector: '',
    orderIdSelector: '',
    fieldSelectors: [],
    loginUrlIncludes: '',
  }
}

export const DEFAULT_SEEN = {}
export const DEFAULT_MAIL_LOGS = []
export const DEFAULT_PENDING = []

export const DEFAULT_STATE = {
  settings: { ...DEFAULT_SETTINGS },
  platforms: [],
  seenOrders: { ...DEFAULT_SEEN },
  mailLogs: [...DEFAULT_MAIL_LOGS],
  pendingMails: [...DEFAULT_PENDING],
}
